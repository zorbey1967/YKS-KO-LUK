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

function isUuid(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { ok: false, error: "Yalnızca POST" }, 405);

  const token = bearerFrom(req);
  if (!token) return json(req, { ok: false, error: "Oturum gerekli" }, 401);

  const url = Deno.env.get("SUPABASE_URL") || "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !anon) return json(req, { ok: false, error: "Sunucu kimlik ayarı eksik" }, 503);

  const userClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) return json(req, { ok: false, error: "Geçersiz veya süresi dolmuş oturum" }, 401);

  let body: { user_id?: unknown; status?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return json(req, { ok: false, error: "Geçersiz istek" }, 400);
  }

  const userId = String(body.user_id || "").trim();
  const status = String(body.status || "").trim();
  if (!UUID_RE.test(userId) && !isUuid(userId)) return json(req, { ok: false, error: "Geçersiz hesap" }, 400);
  if (status !== "active" && status !== "pasif") return json(req, { ok: false, error: "Geçersiz durum" }, 400);

  const { error: rpcError } = await userClient.rpc("admin_set_account_status", {
    p_id: userId,
    p_status: status,
  });
  if (rpcError) {
    const msg = String(rpcError.message || "Hesap güncellenemedi");
    const statusCode = /yetkisiz/i.test(msg)
      ? 403
      : /kendi hesabı|son aktif|platform sahibi/i.test(msg)
        ? 409
        : 400;
    return json(req, { ok: false, error: msg, db: false }, statusCode);
  }

  if (!service) {
    const revert = status === "pasif" ? "active" : "pasif";
    await userClient.rpc("admin_set_account_status", { p_id: userId, p_status: revert });
    return json(req, { ok: false, error: "Auth yönetim anahtarı yok; işlem geri alındı.", db: false, auth: false }, 503);
  }

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const banDuration = status === "pasif" ? "876000h" : "none";
  const { error: banError } = await admin.auth.admin.updateUserById(userId, { ban_duration: banDuration });
  if (banError) {
    const revert = status === "pasif" ? "active" : "pasif";
    const { error: revertError } = await userClient.rpc("admin_set_account_status", {
      p_id: userId,
      p_status: revert,
    });
    return json(req, {
      ok: false,
      error: revertError
        ? "Auth ban başarısız; veritabanı geri alınamadı. Durumu kontrol edin."
        : "Auth ban başarısız; veritabanı geri alındı.",
      db: !revertError,
      auth: false,
    }, 503);
  }

  return json(req, { ok: true, db: true, auth: true });
});
