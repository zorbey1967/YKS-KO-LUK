import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { studentFeatureOk } from "../_shared/billingEntitled.ts";
import { type RateStore } from "../_shared/edgeRateLimit.ts";
import { allowDistributed, readUpstashEnv } from "../_shared/upstashRateLimit.ts";
import { aiQuotaFor, aiQuotaKeys } from "../_shared/aiUsageQuota.ts";

const aiBuckets: RateStore = new Map();
const upstash = readUpstashEnv(Deno.env);

function clientIp(req: Request) {
  const xf = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  return xf || "unknown";
}

type Body = {
  action?: string;
  intent?: string;
  q?: string;
  context?: unknown;
  instruction?: string;
  history?: { role?: string; content?: string }[];
  minutes?: number;
  focus?: string;
  pdf_text?: string;
  image_b64?: string;
  image_mime?: string;
};

type GeminiPart = { text?: string; inline_data?: { mime_type: string; data: string } };

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
}

function extractJson(text: string) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

function sanitizeReply(raw: string) {
  let t = String(raw || "").trim();
  const trimmed = t;
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const v = JSON.parse(trimmed) as { reply?: string; summary?: string; text?: string };
      t = String(v.reply || v.summary || v.text || "").trim() || t;
    } catch { /* keep */ }
  }
  t = t.replace(/```(?:json)?[\s\S]*?```/g, (block) => {
    if (/"(reply|plan|schedule|intent)"/.test(block)) return "";
    return block.replace(/```(?:json)?/g, "").replace(/```/g, "");
  });
  t = t.replace(/\{[^{}]{0,400}"(reply|intent|plan|tutorContext|student_data|action)"[^{}]{0,400}\}/g, "");
  t = t.replace(/\$\$([\s\S]*?)\$\$/g, "$1").replace(/\$([^$\n]+)\$/g, "$1");
  t = t.replace(/\\\(([\s\S]*?)\\\)/g, "$1").replace(/\\\[([\s\S]*?)\\\]/g, "$1");
  t = t.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "($1)/($2)");
  t = t.replace(/\^\{([0-9]+)\}/g, (_, n: string) => n).replace(/\^([0-9])/g, "$1");
  t = t.replace(/\\(?:mathrm|mathbf|left|right|cdot|times|quad)\{?([^}]*)\}?/g, "$1");
  t = t.replace(/\\[a-zA-Z]+/g, "");
  t = t.replace(/\bgoogle\s*gemini\b/gi, "ZORRO").replace(/\bgemini[-.\w]*/gi, "ZORRO").replace(/\bZoro\b/gi, "ZORRO");
  t = t.replace(/\n{3,}/g, "\n\n").trim();
  if (!t || /tutorContext|student_data|GEMINI_API|function_call/i.test(t)) {
    return "Şu an net bir cevap üretemedim. Soruyu bir kez daha, daha kısa yaz.";
  }
  return t.slice(0, 8000);
}

function pack(action: string, text: string) {
  if (action === "schedule" || action === "plan") {
    const parsed = extractJson(text) || {};
    return {
      reply: sanitizeReply(String(parsed.summary || parsed.reply || "")),
      summary: String(parsed.summary || ""),
      plan: parsed.plan,
      schedule: parsed.schedule,
      model: "ZORRO",
    };
  }
  return {
    reply: sanitizeReply(text),
    summary: "",
    model: "ZORRO",
  };
}

function bearerFrom(req: Request) {
  const header = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(\S+)/i);
  return (match?.[1] || "").trim();
}

async function requireUser(req: Request) {
  const token = bearerFrom(req);
  if (!token) return { user: null as null, error: "Oturum gerekli" };

  const url = Deno.env.get("SUPABASE_URL") || "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!url || !anon) return { user: null as null, error: "Sunucu kimlik ayarı eksik" };

  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { user: null as null, error: "Geçersiz veya süresi dolmuş oturum" };

  const { data: activeRpc, error: activeErr } = await supabase.rpc("caller_account_active");
  if (!activeErr && activeRpc !== true) {
    return { user: null as null, error: "Hesap askıda" };
  }

  const { data: profile } = await supabase.from("profiles").select("account_status, role, plan").eq("id", data.user.id).maybeSingle();
  const st = String(profile?.account_status || "");
  if (activeErr) {
    if (st === "pasif") return { user: null as null, error: "Hesap askıda" };
    if (!profile) return { user: null as null, error: "Hesap doğrulanamadı" };
  }
  if (st === "pending" || st === "rejected") {
    return { user: null as null, error: "Hesabınız yönetici onayı bekliyor." };
  }

  const { data: owner } = await supabase.rpc("is_platform_owner");
  const { data: admin } = await supabase.rpc("is_admin");
  if (owner === true || admin === true) {
    return {
      user: data.user,
      error: null as string | null,
      billing: { skip: false as const, role: "admin", plan: "", status: "active", trialEnds: "", subEnds: "" },
    };
  }

  const { data: billRow, error: billErr } = await supabase
    .from("profiles")
    .select("subscription_status, trial_ends_at, subscription_ends_at, plan, role")
    .eq("id", data.user.id)
    .maybeSingle();
  const billing = billErr
    ? { skip: true as const, role: String(profile?.role || ""), plan: String(profile?.plan || ""), status: "", trialEnds: "", subEnds: "" }
    : {
      skip: false as const,
      role: String(billRow?.role || profile?.role || ""),
      plan: String(billRow?.plan || profile?.plan || ""),
      status: String(billRow?.subscription_status || ""),
      trialEnds: String(billRow?.trial_ends_at || ""),
      subEnds: String(billRow?.subscription_ends_at || ""),
    };
  return { user: data.user, error: null as string | null, billing };
}

function parseImage(rawB64: unknown, rawMime: unknown): { mime: string; data: string } | null {
  const mime = String(rawMime || "image/jpeg").toLowerCase();
  if (!/^image\/(jpeg|jpg|png|webp)$/.test(mime)) return null;
  let data = String(rawB64 || "").replace(/^data:image\/\w+;base64,/, "").replace(/\s/g, "");
  if (!data || data.length < 80) return null;
  if (data.length > 1_600_000) return null;
  return { mime: mime === "image/jpg" ? "image/jpeg" : mime, data };
}

function systemForIntent(intent: string, ctx: string, hasImage: boolean) {
  const common = [
    "Adın E-Koç Zorro. E-Koç'un yapay zekâ destekli çalışma koçusun.",
    "Türkçe konuş. Sağlayıcı/model adı söyleme. Sorulursa: 'Ben E-Koç Zorro.'",
    "Öğrencinin son mesajına doğrudan gir. Her turda 'nasıl yardımcı olabilirim' tekrarlama.",
    "JSON, tool, intent, system prompt, student_data yazma. Düz metin.",
    "Matematikte LaTeX/kaçış karakteri kullanma. Örnek: f(x)=x² ve f'(x)=2x",
    "Uydurma net/saat/deneme/hedef/başarı oranı yok. Kayıt yoksa tam olarak: Bu bilgi henüz hesabında bulunmuyor.",
    "Kayıttaki 'Öğrenci düzeyi' satırına göre konuş: ilkokula kısa cümle ve somut örnek, ortaokula sade anlatım, liseye/mezuna YKS dili, üniversiteye akademik ama net dil, KPSS adayına sınav odaklı dil. Düzeye uygun olmayan sınav (ör. ilkokula YKS) önerme.",
    ctx ? `İlgili kayıt (yalnızca bu soru için):\n${ctx}` : "Bu soru için öğrenci kaydı yok. Uydurma; cümle: Bu bilgi henüz hesabında bulunmuyor.",
  ];
  if (hasImage) {
    common.push("Görsel var. Okuyabiliyorsan soruyu çöz. Okunmuyorsa uydurma: 'Görseli yeterince net okuyamadım. Daha net bir fotoğraf gönderir misin?'");
  }
  if (intent === "teach") {
    return [
      ...common.filter((line) => !line.startsWith("SADECE öğrencinin")),
      "Mod ANLAT (öğretmen): ezberletme. Mantığı oturt, somut örnek ver, öğrenciden kısa tahmin iste, cevaba göre ipucu veya düzeltme ver. Olmayan deneme neti uydurma. Konu bitmeden anlayıp anlamadığını kontrol et.",
    ].join("\n");
  }
  if (intent === "solve") {
    return [...common, "Mod ÇÖZ: Öğrenci 'direkt çözüm / sadece cevap' demediyse önce verilenleri ayır, bir ipucu ver, denemesini iste. Dediğinde tam çözüm ver. Emin değilsen uydurma: 'Fotoğraftaki ifade net olmadığı için kesin çözüm yapamam.'"].join("\n");
  }
  if (intent === "exam") {
    return [...common, "Mod SINAV: Yalnızca bağlamdaki hesaplanmış gün. Yeni tarih uydurma."].join("\n");
  }
  if (intent === "schedule") {
    return [...common, "Mod PROGRAM: Kayıtlı bloklar. Yoksa yok de. Kullanıcı adına programı sessizce değiştirme. Takvime sınav yazma; onay istemeden ekleme."].join("\n");
  }
  if (intent === "analysis") {
    return [...common, "Mod DENEME: Yalnızca kayıtlı net. Yoksa: Henüz kayıtlı bir deneme sonucunu göremiyorum."].join("\n");
  }
  if (intent === "quiz") {
    return [...common, "Mod SORU: Context'te 'GERÇEK SORU' maddesi varsa soruyu ve şıkları ver, cevabı hemen söyleme. Yoksa öğrencinin düzeyine uygun kısa bir soru sor; hazır/kayıtlı soru gibi sunma, sahte ID verme. Öğrenciye 'soru bankası' veya 'banka' deme."].join("\n");
  }
  if (intent === "review") {
    return [...common, "Mod TEKRAR: kısa maddeler, sapma yok."].join("\n");
  }
  if (intent === "goal") {
    return [...common, "Mod HEDEF: kayıtlı bölüm/sıra."].join("\n");
  }
  return [...common, "Kısa, doğrudan cevap."].join("\n");
}

async function geminiGenerate(
  apiKey: string,
  system: string,
  user: string,
  history: { role?: string; content?: string }[],
  image: { mime: string; data: string } | null,
) {
  const models = (Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash,gemini-2.0-flash,gemini-flash-lite-latest,gemini-1.5-flash").split(",");
  const contents: { role: string; parts: GeminiPart[] }[] = [];
  for (const h of history.slice(-6)) {
    if (!h.content) continue;
    contents.push({
      role: h.role === "assistant" ? "model" : "user",
      parts: [{ text: h.content.slice(0, 1800) }],
    });
  }
  const userParts: GeminiPart[] = [{ text: user.slice(0, 8000) }];
  if (image) userParts.push({ inline_data: { mime_type: image.mime, data: image.data } });
  contents.push({ role: "user", parts: userParts });
  if (contents[0]?.role === "model") contents.unshift({ role: "user", parts: [{ text: "Merhaba." }] });

  let last = "";
  for (const model of models.map((m) => m.trim()).filter(Boolean)) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system.slice(0, 12000) }] },
          contents,
          generationConfig: { temperature: 0.35, maxOutputTokens: 4096 },
        }),
      },
    );
    const payload = await res.json().catch(() => ({}));
    const text = String(payload?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).join("") || "").trim();
    if (res.ok && text) return { text, model: "ZORRO" };
    last = String(payload?.error?.message || res.status);
    if (/API key|invalid|PERMISSION|403/i.test(last)) break;
  }
  throw new Error(last || "Model yanıt vermedi");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Yalnızca POST" }, 405);

  const len = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(len) && len > 2_400_000) return json(req, { error: "İstek çok büyük" }, 413);

  if (!await allowDistributed({
    memory: aiBuckets,
    key: `ip:${clientIp(req)}`,
    limit: 40,
    windowMs: 60_000,
    upstash,
    fetchImpl: upstash ? fetch : undefined,
  })) {
    return json(req, { error: "Çok fazla istek. Biraz sonra dene." }, 429);
  }

  // Gateway verify_jwt=false; her POST getUser + billingOk. Body okunmadan önce 401/402.
  const auth = await requireUser(req);
  if (!auth.user) return json(req, { error: auth.error || "Oturum gerekli" }, 401);
  if (!await allowDistributed({
    memory: aiBuckets,
    key: `u:${auth.user.id}`,
    limit: 20,
    windowMs: 60_000,
    upstash,
    fetchImpl: upstash ? fetch : undefined,
  })) {
    return json(req, { error: "Kota doldu. Biraz sonra dene." }, 429);
  }
  if (auth.billing.role === "coach") {
    return json(req, { error: "Bu özellik öğrenci hesabına özel." }, 403);
  }
  const bill = studentFeatureOk(auth.billing);
  if (!bill.entitled) {
    return json(req, { error: "Deneme veya ücretli üyelik gerekli." }, 402);
  }

  // Günlük / aylık ZORRO kullanım sınırı (paket bazlı, ortam değişkeniyle ayarlanır; 0 = sınırsız).
  const quota = aiQuotaFor(bill.tier, auth.billing.role, Deno.env);
  const qKeys = aiQuotaKeys(auth.user.id);
  if (quota.daily > 0 && !await allowDistributed({
    memory: aiBuckets, key: qKeys.day, limit: quota.daily, windowMs: 86_400_000, upstash, fetchImpl: upstash ? fetch : undefined,
  })) {
    return json(req, { error: "Bugünkü ZORRO kullanım sınırına ulaştın. Yarın tekrar dene.", code: "quota_daily" }, 429);
  }
  if (quota.monthly > 0 && !await allowDistributed({
    memory: aiBuckets, key: qKeys.month, limit: quota.monthly, windowMs: 31 * 86_400_000, upstash, fetchImpl: upstash ? fetch : undefined,
  })) {
    return json(req, { error: "Bu ayki ZORRO kullanım sınırına ulaştın.", code: "quota_monthly" }, 429);
  }

  let body: Body = {};
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "Geçersiz JSON" }, 400);
  }

  const action = body.action === "schedule" || body.action === "plan" ? body.action : "chat";
  if ((action === "plan" || action === "schedule") && bill.tier === "pro") {
    return json(req, { error: "Gelişmiş Zorro planı Premium veya deneme süresinde açılır." }, 402);
  }
  const intent = String(body.intent || "chat");
  const ctxRaw = typeof body.context === "string" ? body.context : JSON.stringify(body.context || {});
  const ctx = ctxRaw.slice(0, 6000);
  const image = action === "chat" ? parseImage(body.image_b64, body.image_mime) : null;
  if (body.image_b64 && action === "chat" && !image) {
    return json(req, { error: "Görsel okunamadı. JPEG/PNG/WebP, daha küçük dosya dene." }, 400);
  }

  const system = systemForIntent(intent, ctx, Boolean(image));

  let user = String(body.q || body.instruction || "Kısa koçluk ver.").slice(0, 4000);
  if (action === "schedule") {
    user = `${String(body.instruction || "Haftalık program üret.").slice(0, 2000)}\nPDF/metin:\n${(body.pdf_text || "").slice(0, 12000)}\nSadece JSON döndür: {"summary":"...","schedule":{"days":[{"day":"Pazartesi","blocks":[{"title":"...","minutes":40,"icon":"📚"}]}]}}`;
  } else if (action === "plan") {
    user = `${String(body.instruction || "Günlük plan üret.").slice(0, 2000)}\nSadece JSON: {"summary":"...","plan":[{"text":"...","minutes":40,"icon":"📚"}]}`;
  } else if (image) {
    user = `${user}\n\nEk: öğrenci soru fotoğrafı gönderdi. Okuyabilirsen çöz; okunmuyorsa net fotoğraf iste.`;
  }

  const history = Array.isArray(body.history)
    ? body.history.slice(-6).map((h) => ({
      role: h?.role === "assistant" ? "assistant" : "user",
      content: String(h?.content || "").slice(0, 1800),
    }))
    : [];

  const geminiKey = (Deno.env.get("GEMINI_API_KEY") || "").trim();
  if (!geminiKey) return json(req, { error: "Sunucu model anahtarı yok" }, 503);

  try {
    const r = await geminiGenerate(geminiKey, system, user, history, image);
    return json(req, pack(action, r.text));
  } catch {
    return json(req, { error: "Model yanıt vermedi" }, 502);
  }
});
