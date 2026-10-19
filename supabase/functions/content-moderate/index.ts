import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { scanProfanity, shouldAutoSuspend } from "../_shared/profanity.ts";

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

function bearerFrom(req: Request) {
  const header = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(\S+)/i);
  return (match?.[1] || "").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { ok: false, error: "Yalnızca POST" }, 405);

  const token = bearerFrom(req);
  const url = Deno.env.get("SUPABASE_URL") || "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const service = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (!url || !anon) return json(req, { ok: false, error: "Sunucu kimlik ayarı eksik", configured: false }, 503);

  let body: {
    action?: unknown;
    text?: unknown;
    first_name?: unknown;
    last_name?: unknown;
    appointment_id?: unknown;
  } = {};
  try {
    body = await req.json();
  } catch {
    return json(req, { ok: false, error: "Geçersiz istek" }, 400);
  }

  const action = String(body.action || "").trim();

  // Yapılandırma sızıntısını azalt: status için de oturum ister.
  if (!token) return json(req, { ok: false, error: "Oturum gerekli" }, 401);

  const userClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) return json(req, { ok: false, error: "Geçersiz oturum" }, 401);

  if (action === "status") {
    const sttProvider = (Deno.env.get("MEETING_STT_PROVIDER") || "").trim();
    const sttSecret = (Deno.env.get("MEETING_STT_WEBHOOK_SECRET") || "").trim();
    const sttEnforce = (Deno.env.get("MEETING_STT_ENFORCE") || "").trim() === "1";
    const voiceReady = Boolean(sttProvider && sttSecret);
    return json(req, {
      ok: true,
      configured: true,
      lexicon: true,
      gemini: Boolean((Deno.env.get("GEMINI_API_KEY") || "").trim()),
      auth_ban: Boolean(service),
      voice_stt: voiceReady,
      voice_enforcement: voiceReady && sttEnforce,
      note: voiceReady
        ? (sttEnforce
          ? "Sunucu STT webhook hazır; otomatik ses askısı MEETING_STT_ENFORCE=1 ile açık."
          : "STT webhook yapılandırıldı; otomatik ses askısı kapalı (MEETING_STT_ENFORCE≠1).")
        : "Ses denetimi kapalı: MEETING_STT_PROVIDER + MEETING_STT_WEBHOOK_SECRET ve LiveKit Egress/STT gerekir. check_voice istemci metni reddedilir.",
    });
  }

  function adminDb() {
    return createClient(url, service, { auth: { persistSession: false } });
  }

  async function applyAuthBan(userId: string): Promise<{ ok: boolean; error: string }> {
    if (!service) return { ok: false, error: "Auth yönetim anahtarı yok" };
    const { error: banError } = await adminDb().auth.admin.updateUserById(userId, { ban_duration: "876000h" });
    if (banError) return { ok: false, error: "Auth ban başarısız" };
    return { ok: true, error: "" };
  }

  /** Otomatik askı yalnızca service_role ile; Auth ban başarısızsa geri alınır. */
  async function applyAutoSuspend(userId: string, violationId: string): Promise<{ ok: boolean; error: string }> {
    if (!service) return { ok: false, error: "Auth yönetim anahtarı yok" };
    const admin = adminDb();
    const { data: prof } = await admin.from("profiles").select("role, account_status").eq("id", userId).maybeSingle();
    if (!prof || prof.role === "admin" || prof.account_status !== "active") {
      return { ok: false, error: "askı uygun değil" };
    }
    if (prof.role !== "student" && prof.role !== "coach") {
      return { ok: false, error: "askı uygun değil" };
    }
    const { error: pErr } = await admin.from("profiles").update({ account_status: "pasif" }).eq("id", userId).eq("account_status", "active");
    if (pErr) return { ok: false, error: "profil askı başarısız" };
    const { data: coachRows } = await admin.from("coaches").select("id, status, status_before_suspend").eq("user_id", userId).eq("status", "active");
    for (const row of coachRows || []) {
      await admin.from("coaches").update({
        status_before_suspend: row.status_before_suspend || row.status,
        status: "pasif",
      }).eq("id", row.id);
    }
    await admin.from("moderation_violations").update({ status: "suspended" }).eq("id", violationId);
    await admin.from("admin_account_events").insert({ actor_id: userId, target_id: userId, action: "suspend" });
    const ban = await applyAuthBan(userId);
    if (!ban.ok) {
      await revertAutoSuspend(userId, violationId);
      return { ok: false, error: ban.error };
    }
    return { ok: true, error: "" };
  }

  async function revertAutoSuspend(userId: string, violationId: string | null): Promise<void> {
    if (!service) return;
    const admin = adminDb();
    await admin.from("profiles").update({ account_status: "active" }).eq("id", userId).eq("account_status", "pasif");
    const { data: coachRows } = await admin.from("coaches").select("id, status_before_suspend").eq("user_id", userId).eq("status", "pasif");
    for (const row of coachRows || []) {
      const prev = row.status_before_suspend ? String(row.status_before_suspend) : "active";
      await admin.from("coaches").update({ status: prev, status_before_suspend: null }).eq("id", row.id);
    }
    if (violationId) {
      await admin.from("moderation_violations").update({ status: "reviewing" }).eq("id", violationId).eq("status", "suspended");
    }
  }

  async function maybeAutoSuspend(
    userId: string,
    recObj: Record<string, unknown>,
    scanEligible: boolean,
  ): Promise<{ suspended: boolean; authBan: boolean; authBanError: string }> {
    const eligible = scanEligible && recObj.eligible_auto_suspend === true && Boolean(recObj.id);
    if (!eligible || !service) {
      return { suspended: false, authBan: true, authBanError: "" };
    }
    const applied = await applyAutoSuspend(userId, String(recObj.id));
    return {
      suspended: applied.ok,
      authBan: applied.ok,
      authBanError: applied.ok ? "" : applied.error,
    };
  }

  if (action === "check_name") {
    const first = String(body.first_name || "").trim();
    const last = String(body.last_name || "").trim();
    const full = `${first} ${last}`.trim() || String(body.text || "").trim();
    if (full.length < 2 || full.length > 500) {
      return json(req, { ok: false, error: "Ad gerekli", blocked: false }, 400);
    }
    const scan = scanProfanity(full);
    if (!scan.blocked) {
      return json(req, {
        ok: true,
        blocked: false,
        severe: false,
        confidence: 0,
        message: "",
        suspended: false,
      });
    }
    // Yalnızca çağıranın auth.uid() kaydı; target user_id body’de yok.
    const autoHint = shouldAutoSuspend(scan) && Boolean(service);
    const { data: rec, error: rpcErr } = await userClient.rpc("record_moderation_violation", {
      p_kind: "display_name",
      p_text: full,
      p_appointment_id: null,
      p_auto_suspend: autoHint,
    });
    if (rpcErr) {
      return json(req, {
        ok: true,
        blocked: true,
        severe: scan.severe,
        confidence: scan.confidence,
        message: "Bu ad veya soyad kullanılamaz. Lütfen uygun bir ad seçin.",
        suspended: false,
        rpc: false,
      });
    }
    const recObj = rec && typeof rec === "object" ? rec as Record<string, unknown> : {};
    const sus = await maybeAutoSuspend(authData.user.id, recObj, autoHint);
    return json(req, {
      ok: true,
      blocked: true,
      severe: scan.severe,
      confidence: scan.confidence,
      message: "Bu ad veya soyad kullanılamaz. Lütfen uygun bir ad seçin.",
      suspended: sus.suspended,
      auth_ban_ok: sus.authBan,
      auth_ban_error: sus.authBan ? undefined : sus.authBanError,
      admin_review_only: recObj.admin_review_only === true,
    });
  }

  // İstemci transcript ile ses ihlali / otomatik askı KESİNLİKLE kapalı.
  // Gerçek yol: meeting-stt-webhook (HMAC + service_record_voice_stt_violation).
  if (action === "check_voice") {
    return json(req, {
      ok: false,
      error: "İstemci konuşma metni kabul edilmez. Ses denetimi yalnızca imzalı sunucu STT webhook ile yapılır.",
      blocked: false,
      suspended: false,
      configured: false,
      client_transcript_rejected: true,
    }, 403);
  }

  return json(req, { ok: false, error: "Bilinmeyen işlem" }, 400);
});
