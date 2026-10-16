import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { examAnalyticsAllowed, studentFeatureOk } from "../_shared/billingEntitled.ts";
import { type RateStore } from "../_shared/edgeRateLimit.ts";
import { allowDistributed, readUpstashEnv } from "../_shared/upstashRateLimit.ts";

const MAX_BYTES = 8 * 1024 * 1024;
const HOUR_LIMIT = 8;
const scanBuckets: RateStore = new Map();
const upstash = readUpstashEnv(Deno.env);

const UNREADABLE =
  "Dosya yeterince net okunamadı. Daha net bir fotoğraf veya PDF yükleyebilirsiniz.";

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
}

function bearerFrom(req: Request) {
  const header = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(\S+)/i);
  return (match?.[1] || "").trim();
}

function pathOwned(userId: string, path: string) {
  if (!userId || path.includes("..") || path.includes("\\")) return false;
  return path.startsWith(`${userId}/`);
}

function sniffMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "application/pdf";
  const riff = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
  const webp = bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  if (riff && webp) return "image/webp";
  return null;
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { ok: false, error: "Yalnızca POST" }, 405);

  const token = bearerFrom(req);
  if (!token) return json(req, { ok: false, error: "Oturum gerekli" }, 401);
  const url = Deno.env.get("SUPABASE_URL") || "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!url || !anon) return json(req, { ok: false, error: "Sunucu ayarı eksik" }, 503);

  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return json(req, { ok: false, error: "Geçersiz oturum" }, 401);

  const { data: active, error: activeErr } = await supabase.rpc("caller_account_active");
  if (activeErr || active !== true) {
    return json(req, { ok: false, error: "Hesap askıda veya doğrulanamadı." }, 403);
  }

  const { data: owner } = await supabase.rpc("is_platform_owner");
  const { data: admin } = await supabase.rpc("is_admin");
  const privileged = owner === true || admin === true;
  const { data: billRow, error: billErr } = await supabase
    .from("profiles")
    .select("subscription_status, trial_ends_at, subscription_ends_at, plan, role")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (!privileged && String(billRow?.role || "") === "coach") {
    return json(req, { ok: false, error: "Bu özellik öğrenci hesabına özel." }, 403);
  }
  const bill = privileged
    ? { entitled: true, tier: "premium" as const }
    : studentFeatureOk(billErr
      ? { skip: true, role: "", status: "", trialEnds: "", subEnds: "", plan: "" }
      : {
        skip: false,
        role: String(billRow?.role || ""),
        plan: String(billRow?.plan || ""),
        status: String(billRow?.subscription_status || ""),
        trialEnds: String(billRow?.trial_ends_at || ""),
        subEnds: String(billRow?.subscription_ends_at || ""),
      });
  if (!examAnalyticsAllowed(privileged, bill)) {
    return json(req, { ok: false, error: "Analiz Premium veya 14 günlük denemede açılır." }, 402);
  }

  const { data: slot, error: slotErr } = await supabase.rpc("take_exam_scan_slot");
  if (slotErr) {
    const msg = String(slotErr.message || "");
    if (/kota/i.test(msg)) return json(req, { ok: false, error: "Saatlik analiz kotası doldu." }, 429);
    if (/askıda/i.test(msg)) return json(req, { ok: false, error: "Hesap askıda." }, 403);
    if (/does not exist|schema cache/i.test(msg)) {
      return json(req, { ok: false, error: "Analiz kotası tanımlı değil. İstek reddedildi." }, 503);
    }
    return json(req, { ok: false, error: "Kota doğrulanamadı." }, 503);
  }
  if (slot == null) return json(req, { ok: false, error: "Kota doğrulanamadı." }, 503);

  if (!await allowDistributed({
    memory: scanBuckets,
    key: `exam:${authData.user.id}`,
    limit: HOUR_LIMIT,
    windowMs: 60 * 60 * 1000,
    upstash,
    fetchImpl: upstash ? fetch : undefined,
  })) {
    return json(req, { ok: false, error: "Saatlik analiz kotası doldu." }, 429);
  }

  let body: { path?: unknown; mode?: unknown; context?: unknown } = {};
  try { body = await req.json(); } catch { return json(req, { ok: false, error: "Geçersiz istek" }, 400); }
  const path = String(body.path || "");
  if (!pathOwned(authData.user.id, path)) {
    return json(req, { ok: false, error: "Dosya yolu geçersiz" }, 400);
  }
  const mode = String(body.mode || "marks") === "document_analysis" ? "document_analysis" : "marks";
  const studentCtx = String(body.context || "").slice(0, 4000);

  const { data: file, error: dl } = await supabase.storage.from("exam-scans").download(path);
  if (dl || !file) return json(req, { ok: false, error: "Dosya okunamadı veya depo yok." }, 404);

  const apiKey = Deno.env.get("GEMINI_API_KEY") || "";
  if (!apiKey) return json(req, { ok: false, error: "Görsel model anahtarı yok. İşaret uydurulmadı." }, 503);

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length > MAX_BYTES) return json(req, { ok: false, error: "Dosya 8 MB’den küçük olsun. Anahtar uydurulmadı." }, 413);
  const sniffed = sniffMime(bytes);
  if (!sniffed) return json(req, { ok: false, error: "Yalnızca JPEG, PNG, WebP veya PDF. Anahtar uydurulmadı." }, 415);

  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + 8192, bytes.length)));
  }
  const b64 = btoa(binary);

  const marksPrompt = `Optik form veya sonuç belgesi. JSON: {"marks":[(0-4 veya null)],"warning":"..."}.
Belirsiz işaret için null kullan. Cevap anahtarı uydurma. Resmî sınav adı emin değilsen warning yaz.`;

  const docPrompt = `Sınav/deneme fotoğrafı veya PDF. SADECE gördüğün soruları analiz et.
JSON:
{
  "unreadable": false,
  "message": "",
  "summary": "kısa özet",
  "advice": "yalnızca okunan sorulara dayalı çalışma önerisi",
  "unreadableQuestions": ["Soru 4"],
  "questions": [
    {
      "number": 1,
      "subject": "Matematik",
      "topic": "Fonksiyonlar",
      "subtopic": "Belirlenemedi",
      "verdict": "yanlis",
      "errorType": "Belirlenemedi",
      "readable": true
    }
  ]
}
Kurallar:
- Dosyada olmayan soru üretme. Net/sonuç uydurma.
- Konu görünmüyorsa topic = "Konusu belirlenemedi".
- Doğru/yanlış/boş okunmuyorsa verdict = "belirlenemedi"; tahmin etme.
- Hata türü görünmüyorsa errorType = "Belirlenemedi".
- Tamamen okunamıyorsa unreadable=true, questions=[], message tam olarak: "${UNREADABLE}"
- Kısmi okumada okunamayanları unreadableQuestions’a yaz.
${studentCtx ? `Öğrenci bağlamı (karşılaştırma; uydurma yok):\n${studentCtx}` : ""}`;

  const prompt = mode === "document_analysis" ? docPrompt : marksPrompt;
  const model = (Deno.env.get("GEMINI_MODEL") || "gemini-2.0-flash").split(",")[0].trim();
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }, { inline_data: { mime_type: sniffed, data: b64 } }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: mode === "document_analysis" ? 4096 : 1024,
      },
    }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    return json(req, { ok: false, error: "Görsel model yanıt vermedi. İşaret uydurulmadı." }, 502);
  }
  const text = String(payload?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).join("") || "");
  const parsed = extractJsonObject(text);
  if (!parsed) {
    if (mode === "document_analysis") {
      return json(req, {
        ok: true,
        mode: "document_analysis",
        analysis: { unreadable: true, message: UNREADABLE, questions: [], unreadableQuestions: [] },
      });
    }
    return json(req, { ok: false, error: "Görsel yeterince okunamadı. İşaret uydurulmadı." }, 422);
  }

  if (mode === "document_analysis") {
    return json(req, { ok: true, mode: "document_analysis", analysis: parsed });
  }

  try {
    const marks = Array.isArray(parsed.marks)
      ? parsed.marks.map((m) => (m === 0 || m === 1 || m === 2 || m === 3 || m === 4 ? m : null))
      : [];
    return json(req, { ok: true, marks, warning: String(parsed.warning || "Belirsiz kutular boş bırakıldı.") });
  } catch {
    return json(req, { ok: false, error: "Çıktı ayrıştırılamadı. Anahtar uydurulmadı." }, 422);
  }
});
