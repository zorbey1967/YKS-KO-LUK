/** LiveKit / STT sağlayıcı webhook imza doğrulama (HMAC-SHA256 hex). */

export async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  const x = a.toLowerCase().trim();
  const y = b.toLowerCase().trim();
  if (x.length !== y.length || x.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

export type SttWebhookPayload = {
  event_id: string;
  appointment_id: string;
  speaker_user_id: string;
  stt_confidence: number;
  /** En fazla ~120 karakter; tam transcript kabul edilmez. */
  snippet: string;
  provider?: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseSttWebhookBody(raw: unknown): { ok: true; data: SttWebhookPayload } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "geçersiz gövde" };
  const b = raw as Record<string, unknown>;
  const event_id = String(b.event_id || "").trim();
  const appointment_id = String(b.appointment_id || "").trim();
  const speaker_user_id = String(b.speaker_user_id || "").trim();
  const stt_confidence = Number(b.stt_confidence);
  const snippet = String(b.snippet || "").trim();
  const provider = String(b.provider || "").trim();
  if (!event_id || event_id.length > 128) return { ok: false, error: "geçersiz event_id" };
  if (!appointment_id || appointment_id.length > 80) return { ok: false, error: "geçersiz appointment_id" };
  if (!UUID_RE.test(speaker_user_id)) return { ok: false, error: "geçersiz speaker_user_id" };
  if (!Number.isFinite(stt_confidence) || stt_confidence < 0 || stt_confidence > 1) {
    return { ok: false, error: "geçersiz stt_confidence" };
  }
  if (snippet.length > 120) return { ok: false, error: "snippet çok uzun; tam transcript yasak" };
  // İstemci sahte alanları yok say: transcript, text, full_text kabul edilmez.
  if (b.transcript != null || b.text != null || b.full_text != null) {
    return { ok: false, error: "tam transcript alanı reddedildi" };
  }
  return {
    ok: true,
    data: {
      event_id,
      appointment_id,
      speaker_user_id,
      stt_confidence,
      snippet,
      provider: provider || undefined,
    },
  };
}

export function voiceEnforcementEnabled(env: {
  provider: string;
  secret: string;
  enforce: string;
}): boolean {
  return Boolean(env.provider.trim() && env.secret.trim() && env.enforce.trim() === "1");
}
