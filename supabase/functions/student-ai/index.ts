import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Body = {
  action?: string;
  q?: string;
  context?: unknown;
  instruction?: string;
  history?: { role?: string; content?: string }[];
  minutes?: number;
  focus?: string;
  pdf_text?: string;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
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

function pack(action: string, text: string, model: string) {
  const parsed = extractJson(text) || {};
  const reply = String(parsed.reply || "").trim() || (action === "chat" ? text.replace(/```[\s\S]*```/g, "").trim() : text.slice(0, 500));
  return {
    reply,
    summary: String(parsed.summary || ""),
    plan: parsed.plan,
    schedule: parsed.schedule,
    text,
    model,
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
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { user: null as null, error: "Geçersiz veya süresi dolmuş oturum" };
  return { user: data.user, error: null as string | null };
}

async function geminiGenerate(apiKey: string, system: string, user: string, history: { role?: string; content?: string }[]) {
  const models = (Deno.env.get("GEMINI_MODEL") || "gemini-flash-lite-latest,gemini-2.5-flash,gemini-2.0-flash,gemini-1.5-flash").split(",");
  const contents: { role: string; parts: { text: string }[] }[] = [];
  for (const h of history.slice(-6)) {
    if (!h.content) continue;
    contents.push({
      role: h.role === "assistant" ? "model" : "user",
      parts: [{ text: h.content.slice(0, 1800) }],
    });
  }
  contents.push({ role: "user", parts: [{ text: `${system}\n\n---\nÖğrenci: ${user}` }] });
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
        body: JSON.stringify({ contents, generationConfig: { temperature: 0.55, maxOutputTokens: 2048 } }),
      },
    );
    const payload = await res.json().catch(() => ({}));
    const text = String(payload?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).join("") || "").trim();
    if (res.ok && text) return { text, model: `Gemini · ${model}` };
    last = String(payload?.error?.message || res.status);
    if (/API key|invalid|PERMISSION|403/i.test(last)) break;
  }
  throw new Error(last || "Gemini yanıt vermedi");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const auth = await requireUser(req);
  if (!auth.user) return json({ error: auth.error || "Oturum gerekli" }, 401);

  let body: Body = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Geçersiz JSON" }, 400);
  }

  const action = body.action || "chat";
  const ctx = typeof body.context === "string" ? body.context : JSON.stringify(body.context || {});
  const system = [
    "Sen Türkiye’deki öğrencilere çalışan gerçek bir e-koçsun (YKS, KPSS, 1–12). Adın E-Koç.",
    "Kısa, somut, Türkçe cevap ver. Uydurma sıralama/puan tahmini yok. ÖSYM net = doğru − yanlış/4.",
    "Yaşa uygun blok: ilkokul 15–20 dk, ortaokul 30–40, lise/YKS 40–70.",
    "Plan verdiğinde sona JSON ekle: {\"plan\":[{\"text\":\"...\",\"minutes\":40,\"icon\":\"📚\"}]}",
    "Öğrenci bağlamı:",
    ctx,
  ].join("\n");

  let user = body.q || body.instruction || "Kısa koçluk ver.";
  if (action === "schedule") {
    user = `${body.instruction || "Haftalık program üret."}\nPDF/metin:\n${(body.pdf_text || "").slice(0, 12000)}\nSadece JSON döndür: {"summary":"...","schedule":{"days":[{"day":"Pazartesi","blocks":[{"title":"...","minutes":40,"icon":"📚"}]}]}}`;
  } else if (action === "plan") {
    user = `${body.instruction || "Günlük plan üret."}\nSadece JSON: {"summary":"...","plan":[{"text":"...","minutes":40,"icon":"📚"}]}`;
  }

  const geminiKey = (Deno.env.get("GEMINI_API_KEY") || "").trim();
  if (!geminiKey) return json({ error: "Sunucu model anahtarı yok" }, 503);

  try {
    const r = await geminiGenerate(geminiKey, system, user, body.history || []);
    return json(pack(action, r.text, r.model));
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 502);
  }
});
