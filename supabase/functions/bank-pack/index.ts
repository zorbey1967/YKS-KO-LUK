import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { studentFeatureOk } from "../_shared/billingEntitled.ts";
import { parseBankPack, questionsForPackLevel, type BankPackFile } from "../_shared/bankPackSchema.ts";

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
}

function bearerFrom(req: Request) {
  const header = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(\S+)/i);
  return (match?.[1] || "").trim();
}

let packCache: BankPackFile | null | undefined;

async function readPack(): Promise<BankPackFile | null> {
  if (packCache !== undefined) return packCache;
  try {
    const mod = await import("./pack.json", { with: { type: "json" } });
    packCache = parseBankPack((mod as { default?: unknown }).default ?? mod);
    if (packCache) return packCache;
  } catch {
    /* dosya yok veya paketleyici dahil etmedi */
  }
  try {
    const raw = await Deno.readTextFile(new URL("./pack.json", import.meta.url));
    packCache = parseBankPack(JSON.parse(raw));
  } catch {
    packCache = null;
  }
  return packCache;
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
  if (!bill.entitled) {
    return json(req, { ok: false, error: "Deneme veya ücretli üyelik gerekli." }, 402);
  }

  const pack = await readPack();
  if (!pack) {
    return json(req, {
      ok: false,
      pack: false,
      error: "Soru paketi yok. npm run pack:bank çalıştırılıp bank-pack deploy edilmeden içerik sunulmaz.",
    }, 503);
  }

  let body: { action?: unknown; slug?: unknown; level?: unknown } = {};
  try { body = await req.json(); } catch { return json(req, { ok: false, error: "Geçersiz istek" }, 400); }
  const action = String(body.action || "manifest");

  if (action === "manifest") {
    return json(req, { ok: true, entitled: true, pack: true, manifest: pack.manifest });
  }

  const slug = String(body.slug || "");
  const level = String(body.level || "");
  const questions = questionsForPackLevel(pack, slug, level);
  if (!questions) {
    return json(req, { ok: false, error: "Bu seviye pakette yok." }, 404);
  }
  return json(req, { ok: true, entitled: true, pack: true, questions });
});
