import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { AccessToken } from "npm:livekit-server-sdk";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TOKEN_TTL_SEC = 600;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

function bearerFrom(req: Request) {
  const header = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(\S+)/i);
  return (match?.[1] || "").trim();
}

function appointmentIdOk(id: string) {
  return id.length > 0 && id.length <= 80;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Yalnızca POST" }, 405);

  const token = bearerFrom(req);
  if (!token) return json({ error: "Oturum gerekli" }, 401);

  const url = Deno.env.get("SUPABASE_URL") || "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!url || !anon) return json({ error: "Sunucu kimlik ayarı eksik" }, 503);

  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "Geçersiz veya süresi dolmuş oturum" }, 401);

  let body: { appointmentId?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Geçersiz istek" }, 400);
  }

  const appointmentId = String(body.appointmentId || "").trim();
  if (!appointmentIdOk(appointmentId)) return json({ error: "Geçersiz randevu" }, 400);

  const { data: canJoin, error: joinError } = await supabase.rpc("can_join_meeting", {
    p_appointment_id: appointmentId,
  });
  if (joinError) return json({ error: "Yetki kontrolü tamamlanamadı" }, 503);
  if (!canJoin) return json({ error: "Bu görüşmeye katılamazsın" }, 403);

  const { data: roomRow, error: roomError } = await supabase.rpc("ensure_meeting_room", {
    p_appointment_id: appointmentId,
  });
  if (roomError) return json({ error: "Oda açılamadı" }, 409);
  const room = roomRow && typeof roomRow === "object" ? roomRow as { id?: string; recording_enabled?: boolean } : null;
  const roomName = String(room?.id || "").trim();
  if (!roomName) return json({ error: "Oda açılamadı" }, 409);
  if (room?.recording_enabled) return json({ error: "Kayıt kapalı" }, 400);

  const livekitUrl = (Deno.env.get("LIVEKIT_URL") || "").trim();
  const apiKey = (Deno.env.get("LIVEKIT_API_KEY") || "").trim();
  const apiSecret = (Deno.env.get("LIVEKIT_API_SECRET") || "").trim();
  if (!livekitUrl || !apiKey || !apiSecret) {
    return json({ error: "Görüşme sunucusu ayarı yok" }, 503);
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity: authData.user.id,
    ttl: TOKEN_TTL_SEC,
    name: authData.user.id,
  });
  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    canUpdateOwnMetadata: false,
    hidden: false,
    recorder: false,
    roomAdmin: false,
    roomCreate: false,
    roomList: false,
  });

  const accessToken = await at.toJwt();
  return json({
    token: accessToken,
    url: livekitUrl,
    room: roomName,
    expiresAt: new Date(Date.now() + TOKEN_TTL_SEC * 1000).toISOString(),
    recording: false,
  });
});
