import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { sniffMeetingMime } from "../_shared/sniffBytes.ts";

const MAX_BYTES = 100 * 1024 * 1024;

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

  const { data: ready } = await userClient.rpc("meeting_recording_pipeline_ready");
  if (ready !== true) {
    return json(req, {
      ok: false,
      error: "LiveKit Egress bağlı değil. Kayıt yüklenmedi.",
      pipeline_ready: false,
    }, 503);
  }

  const bytes = new Uint8Array(await req.arrayBuffer());
  if (!bytes.length) return json(req, { ok: false, error: "Kayıt boş." }, 400);
  if (bytes.length > MAX_BYTES) return json(req, { ok: false, error: "Kayıt 100 MB’den küçük olsun." }, 413);
  const sniffed = sniffMeetingMime(bytes);
  if (!sniffed) return json(req, { ok: false, error: "Dosya imzası WebM/MP4/MPEG değil." }, 415);
  return json(req, { ok: false, error: "Kayıt hattı kapalı." }, 503);
});
