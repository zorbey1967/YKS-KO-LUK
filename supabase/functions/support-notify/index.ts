import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

function bearerFrom(req: Request) {
  const header = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(\S+)/i);
  return (match?.[1] || "").trim();
}

function safeFail(req: Request) {
  return json(req, { ok: false, error: "Mesaj gönderilemedi. Lütfen tekrar deneyin." }, 400);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { ok: false, error: "Mesaj gönderilemedi. Lütfen tekrar deneyin." }, 405);

  const token = bearerFrom(req);
  if (!token) return json(req, { ok: false, error: "Mesaj gönderilemedi. Lütfen tekrar deneyin." }, 401);

  const url = Deno.env.get("SUPABASE_URL") || "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!url || !anon) return safeFail(req);

  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return json(req, { ok: false, error: "Mesaj gönderilemedi. Lütfen tekrar deneyin." }, 401);

  let body: { ticket_id?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return safeFail(req);
  }
  const ticketId = String(body.ticket_id || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(ticketId)) return safeFail(req);

  const { data: ticket, error: tErr } = await supabase
    .from("support_tickets")
    .select("id,user_id,first_name,last_name,email,subject,body,sender_role,created_at")
    .eq("id", ticketId)
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (tErr || !ticket) return safeFail(req);

  const adminEmail = String(Deno.env.get("ADMIN_SUPPORT_EMAIL") || "").trim().toLowerCase();
  const resendKey = String(Deno.env.get("RESEND_API_KEY") || "").trim();
  const fromEmail = String(Deno.env.get("SUPPORT_NOTIFY_FROM") || "Destek <onboarding@resend.dev>").trim();

  if (!adminEmail || !adminEmail.includes("@") || !resendKey) {
    // Kayıt panoda görünür; e-posta yapılandırması yoksa sessizce atlanır (secret sızdırılmaz).
    return json(req, { ok: true, emailed: false });
  }

  const name = `${String(ticket.first_name || "")} ${String(ticket.last_name || "")}`.trim() || "—";
  const roleLabel = String(ticket.sender_role || "") === "coach" ? "Koç" : "Öğrenci";
  const subject = `[Destek] ${roleLabel}: ${String(ticket.subject || "").slice(0, 120)}`;
  const text = [
    "Yeni destek mesajı",
    `Gönderen: ${name}`,
    `Rol: ${roleLabel}`,
    `E-posta: ${String(ticket.email || "")}`,
    `Konu: ${String(ticket.subject || "")}`,
    `Mesaj: ${String(ticket.body || "")}`,
    `Tarih: ${String(ticket.created_at || "")}`,
    "",
    "Yanıt için yönetici paneli → Gelen Destek Mesajları.",
  ].join("\n");

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [adminEmail],
        subject,
        text,
      }),
    });
    if (!res.ok) {
      // Ticket zaten yazıldı; kullanıcıya teknik detay yok.
      return json(req, { ok: true, emailed: false });
    }
    return json(req, { ok: true, emailed: true });
  } catch {
    return json(req, { ok: true, emailed: false });
  }
});
