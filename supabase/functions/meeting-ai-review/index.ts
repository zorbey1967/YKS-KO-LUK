import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
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
  if (!token) return json(req, { ok: false, error: "Oturum gerekli" }, 401);
  const url = Deno.env.get("SUPABASE_URL") || "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !anon || !service) return json(req, { ok: false, error: "Sunucu ayarı eksik" }, 503);

  const userClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) return json(req, { ok: false, error: "Geçersiz oturum" }, 401);
  const { data: adminOk } = await userClient.rpc("is_admin");
  const { data: ownerOk } = await userClient.rpc("is_platform_owner");
  if (adminOk !== true && ownerOk !== true) return json(req, { ok: false, error: "yetkisiz" }, 403);

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: queued, error: qErr } = await admin
    .from("meeting_ai_reviews")
    .select("id, recording_id, appointment_id, student_id, coach_id, analysis_status")
    .eq("analysis_status", "queued")
    .limit(5);
  if (qErr) return json(req, { ok: false, error: "Kuyruk okunamadı" }, 503);

  const gemini = Deno.env.get("GEMINI_API_KEY") || "";
  const processed: { id: string; status: string }[] = [];
  for (const row of queued || []) {
    await admin.from("meeting_ai_reviews").update({
      analysis_status: "running",
      updated_at: new Date().toISOString(),
    }).eq("id", row.id).eq("analysis_status", "queued");

    if (!gemini) {
      await admin.from("meeting_ai_reviews").update({
        analysis_status: "failed",
        error_text: "Model anahtarı yok; kesin hüküm yok; hesap kapatılmadı.",
        model_confidence: "uncertain",
        updated_at: new Date().toISOString(),
      }).eq("id", row.id);
      processed.push({ id: row.id, status: "failed" });
      continue;
    }

    await admin.from("meeting_ai_reviews").update({
      analysis_status: "failed",
      error_text: "LiveKit kayıt/transkript yok; analiz çalıştırılmadı. Hesap kapatılmadı.",
      rationale: "Kanıt yok. Otomatik suç veya aklama yok.",
      model_confidence: "uncertain",
      risk_level: "none",
      updated_at: new Date().toISOString(),
    }).eq("id", row.id);
    processed.push({ id: row.id, status: "failed" });
  }

  return json(req, { ok: true, auto_close: false, processed });
});
