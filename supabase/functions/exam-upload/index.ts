import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { sniffExamMime } from "../_shared/sniffBytes.ts";

const MAX_BYTES = 8 * 1024 * 1024;

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
}

function bearerFrom(req: Request) {
  const header = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(\S+)/i);
  return (match?.[1] || "").trim();
}

function extFor(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "application/pdf") return "pdf";
  return "jpg";
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

  const { data: active, error: activeErr } = await userClient.rpc("caller_account_active");
  if (activeErr || active !== true) return json(req, { ok: false, error: "Hesap askıda veya doğrulanamadı." }, 403);

  let claimed = "";
  let bytes: Uint8Array;
  const ctype = (req.headers.get("Content-Type") || "").toLowerCase();
  if (ctype.includes("application/json")) {
    let body: { contentType?: unknown; base64?: unknown } = {};
    try { body = await req.json(); } catch { return json(req, { ok: false, error: "Geçersiz istek" }, 400); }
    claimed = String(body.contentType || "");
    try {
      bytes = Uint8Array.from(atob(String(body.base64 || "")), (c) => c.charCodeAt(0));
    } catch {
      return json(req, { ok: false, error: "Dosya çözülemedi" }, 400);
    }
  } else {
    const buf = new Uint8Array(await req.arrayBuffer());
    bytes = buf;
    claimed = ctype.split(";")[0].trim();
  }

  if (!bytes.length) return json(req, { ok: false, error: "Dosya boş." }, 400);
  if (bytes.length > MAX_BYTES) return json(req, { ok: false, error: "Dosya 8 MB’den küçük olsun." }, 413);
  const sniffed = sniffExamMime(bytes);
  if (!sniffed) return json(req, { ok: false, error: "Yalnızca JPEG, PNG, WebP veya PDF." }, 415);
  const mime = claimed.toLowerCase().split(";")[0].trim();
  if (mime && mime !== sniffed) return json(req, { ok: false, error: "Dosya türü ile içerik uyuşmuyor." }, 415);

  const path = `${authData.user.id}/${crypto.randomUUID()}.${extFor(sniffed)}`;
  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error: up } = await admin.storage.from("exam-scans").upload(path, bytes, {
    contentType: sniffed,
    upsert: false,
  });
  if (up) return json(req, { ok: false, error: "Yükleme reddedildi." }, 400);
  return json(req, { ok: true, path });
});
