import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { AccessToken } from "npm:livekit-server-sdk";
import { corsHeaders } from "../_shared/cors.ts";

const TOKEN_TTL_MAX_SEC = 600;

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
}

function bearerFrom(req: Request) {
  const header = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(\S+)/i);
  return (match?.[1] || "").trim();
}

function appointmentIdOk(id: string) {
  return /^[A-Za-z0-9_-]{1,80}$/.test(id);
}

function connectionIdOk(id: string) {
  return /^[a-f0-9]{32}$/.test(id);
}

function livekitUrlOk(u: string) {
  return /^wss:\/\/\S+$/i.test(u) || /^https:\/\/\S+$/i.test(u);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Yalnızca POST" }, 405);

  const token = bearerFrom(req);
  if (!token) return json(req, { error: "Oturum gerekli" }, 401);

  const url = Deno.env.get("SUPABASE_URL") || "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!url || !anon) return json(req, { error: "Sunucu kimlik ayarı eksik" }, 503);

  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return json(req, { error: "Geçersiz veya süresi dolmuş oturum" }, 401);

  let body: { appointmentId?: unknown; connectionId?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "Geçersiz istek" }, 400);
  }

  const appointmentId = String(body.appointmentId || "").trim();
  if (!appointmentIdOk(appointmentId)) return json(req, { error: "Geçersiz randevu" }, 400);
  const connectionId = String(body.connectionId || "").trim();
  if (!connectionIdOk(connectionId)) return json(req, { error: "Geçersiz bağlantı" }, 400);

  const { data: canJoin, error: joinError } = await supabase.rpc("can_join_meeting", {
    p_appointment_id: appointmentId,
  });
  if (joinError) return json(req, { error: "Yetki kontrolü tamamlanamadı" }, 503);
  if (!canJoin) return json(req, { error: "Bu görüşmeye katılamazsın" }, 403);

  const { data: roomRow, error: roomError } = await supabase.rpc("ensure_meeting_room", {
    p_appointment_id: appointmentId,
  });
  if (roomError) return json(req, { error: "Oda açılamadı" }, 409);
  const room = roomRow && typeof roomRow === "object"
    ? roomRow as { id?: string; recording_enabled?: boolean; status?: string }
    : null;
  const roomName = String(room?.id || "").trim();
  if (!roomName) return json(req, { error: "Oda açılamadı" }, 409);
  if (room?.recording_enabled) return json(req, { error: "Kayıt kapalı" }, 400);
  if (room?.status === "ended" || room?.status === "blocked") {
    return json(req, { error: "Bu görüşmeye katılamazsın" }, 403);
  }

  const { data: sessionRaw, error: sessionError } = await supabase.rpc("meeting_session_state", {
    p_appointment_id: appointmentId,
  });
  if (sessionError) return json(req, { error: "Oturum durumu alınamadı" }, 503);
  const session = sessionRaw && typeof sessionRaw === "object"
    ? sessionRaw as { status?: string; join_remaining_sec?: unknown }
    : null;
  if (session?.status === "ended" || session?.status === "blocked") {
    return json(req, { error: "Bu görüşmeye katılamazsın" }, 403);
  }
  const joinLeft = Math.floor(Number(session?.join_remaining_sec));
  if (!Number.isFinite(joinLeft) || joinLeft <= 0) {
    return json(req, { error: "Bu görüşmeye katılamazsın" }, 403);
  }
  const tokenTtlSec = Math.max(1, Math.min(TOKEN_TTL_MAX_SEC, joinLeft));

  const livekitUrl = (Deno.env.get("LIVEKIT_URL") || "").trim();
  const apiKey = (Deno.env.get("LIVEKIT_API_KEY") || "").trim();
  const apiSecret = (Deno.env.get("LIVEKIT_API_SECRET") || "").trim();
  if (!livekitUrlOk(livekitUrl) || !apiKey || !apiSecret) {
    return json(req, { error: "Görüşme sunucusu ayarı yok" }, 503);
  }

  const userId = authData.user.id;
  const at = new AccessToken(apiKey, apiSecret, {
    identity: `${userId}:${connectionId}`,
    ttl: tokenTtlSec,
    name: userId,
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
  const { error: logError } = await supabase.rpc("log_meeting_token_ok", {
    p_appointment_id: appointmentId,
  });
  if (logError) return json(req, { error: "Katılım kaydı yazılamadı" }, 503);
  return json(req, {
    token: accessToken,
    url: livekitUrl,
    room: roomName,
    expiresAt: new Date(Date.now() + tokenTtlSec * 1000).toISOString(),
    recording: false,
  });
});
