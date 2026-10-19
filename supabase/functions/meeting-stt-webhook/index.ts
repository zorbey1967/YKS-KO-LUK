/**
 * Sunucu tarafı STT webhook.
 * İstemci transcript kabul etmez. LiveKit Egress + STT sağlayıcı + imza olmadan yaptırım yok.
 *
 * Gerekli env (değerler raporda gösterilmez):
 * - MEETING_STT_PROVIDER
 * - MEETING_STT_WEBHOOK_SECRET
 * - MEETING_STT_ENFORCE=1  (otomatik askı; yoksa yalnız inceleme kaydı)
 * - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Altyapı eksikse (Egress/STT yok): bu fonksiyon 503 döner; özellik “açık” sayılmaz.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { scanProfanity, shouldAutoSuspend } from "../_shared/profanity.ts";
import {
  hmacSha256Hex,
  parseSttWebhookBody,
  timingSafeEqualHex,
  voiceEnforcementEnabled,
} from "../_shared/meetingSttWebhook.ts";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  if (req.method !== "POST") return json({ ok: false, error: "Yalnızca POST" }, 405);

  const provider = (Deno.env.get("MEETING_STT_PROVIDER") || "").trim();
  const secret = (Deno.env.get("MEETING_STT_WEBHOOK_SECRET") || "").trim();
  const enforce = (Deno.env.get("MEETING_STT_ENFORCE") || "").trim();
  const url = Deno.env.get("SUPABASE_URL") || "";
  const service = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();

  if (!provider || !secret) {
    return json({
      ok: false,
      error: "STT webhook yapılandırılmadı. Ses denetimi kapalı.",
      configured: false,
    }, 503);
  }
  if (!url || !service) {
    return json({ ok: false, error: "Sunucu kimlik ayarı eksik", configured: false }, 503);
  }

  const raw = await req.text();
  const sig = (
    req.headers.get("x-meeting-stt-signature")
    || req.headers.get("x-webhook-signature")
    || ""
  ).trim().toLowerCase().replace(/^sha256=/, "");
  if (!sig) return json({ ok: false, error: "İmza yok" }, 401);
  const expected = await hmacSha256Hex(secret, raw);
  if (!timingSafeEqualHex(sig, expected)) {
    return json({ ok: false, error: "İmza geçersiz" }, 401);
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "Geçersiz JSON" }, 400);
  }
  const parsed = parseSttWebhookBody(parsedJson);
  if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400);

  const { data: payload } = parsed;
  // Belirsiz / düşük STT güveni → ceza yok
  if (payload.stt_confidence < 0.9) {
    return json({ ok: true, blocked: false, skipped: "low_stt_confidence" });
  }

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: rec, error: rpcErr } = await admin.rpc("service_record_voice_stt_violation", {
    p_event_id: payload.event_id,
    p_appointment_id: payload.appointment_id,
    p_speaker_user_id: payload.speaker_user_id,
    p_provider: provider,
    p_stt_confidence: payload.stt_confidence,
    p_snippet: payload.snippet,
  });

  if (rpcErr) {
    return json({ ok: false, error: "Kayıt yazılamadı", detail: rpcErr.message }, 503);
  }
  const recObj = rec && typeof rec === "object" ? rec as Record<string, unknown> : {};
  if (recObj.ok === false) {
    return json({ ok: false, error: String(recObj.error || "red") }, 403);
  }
  if (recObj.duplicate === true) {
    return json({ ok: true, duplicate: true, id: recObj.id, suspended: false });
  }
  if (recObj.blocked !== true) {
    return json({ ok: true, blocked: false, skipped: recObj.skipped || null });
  }
  if (recObj.admin_review_only === true) {
    return json({ ok: true, blocked: true, suspended: false, admin_review_only: true });
  }

  const enforceOn = voiceEnforcementEnabled({ provider, secret, enforce });
  const scan = scanProfanity(payload.snippet);
  const eligible = enforceOn
    && recObj.eligible_auto_suspend === true
    && shouldAutoSuspend({ ...scan, confidence: Number(recObj.confidence) || scan.confidence });

  if (!eligible || !recObj.id) {
    return json({
      ok: true,
      blocked: true,
      suspended: false,
      message: enforceOn ? "İnceleme kaydı" : "STTenforce kapalı; otomatik askı yok",
    });
  }

  const userId = String(recObj.speaker_user_id || payload.speaker_user_id);
  const violationId = String(recObj.id);

  const { data: prof } = await admin.from("profiles").select("role, account_status").eq("id", userId).maybeSingle();
  if (!prof || prof.role === "admin" || (prof.role !== "student" && prof.role !== "coach") || prof.account_status !== "active") {
    return json({ ok: true, blocked: true, suspended: false, reason: "askı uygun değil" });
  }

  const { error: pErr } = await admin.from("profiles").update({ account_status: "pasif" }).eq("id", userId).eq("account_status", "active");
  if (pErr) return json({ ok: false, error: "profil askı başarısız", suspended: false }, 503);

  const { data: coachRows } = await admin.from("coaches").select("id, status, status_before_suspend").eq("user_id", userId).eq("status", "active");
  for (const row of coachRows || []) {
    await admin.from("coaches").update({
      status_before_suspend: row.status_before_suspend || row.status,
      status: "pasif",
    }).eq("id", row.id);
  }
  await admin.from("moderation_violations").update({ status: "suspended" }).eq("id", violationId);
  await admin.from("admin_account_events").insert({ actor_id: userId, target_id: userId, action: "suspend" });

  const { error: banError } = await admin.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
  if (banError) {
    await admin.from("profiles").update({ account_status: "active" }).eq("id", userId).eq("account_status", "pasif");
    for (const row of coachRows || []) {
      const prev = row.status_before_suspend || row.status || "active";
      await admin.from("coaches").update({ status: prev, status_before_suspend: null }).eq("id", row.id);
    }
    await admin.from("moderation_violations").update({ status: "reviewing" }).eq("id", violationId).eq("status", "suspended");
    return json({
      ok: false,
      error: "Auth ban başarısız; DB geri alındı",
      suspended: false,
      auth_ban_ok: false,
    }, 503);
  }

  return json({ ok: true, blocked: true, suspended: true, auth_ban_ok: true, id: violationId });
});
