const SITE = "https://e-kocluk.vercel.app";

export function originAllowed(origin: string) {
  if (origin === SITE) return true;
  if (/^http:\/\/(localhost|127\.0\.0\.1):\d{2,5}$/.test(origin)) return true;
  if (/^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:\d{2,5}$/.test(origin)) return true;
  return false;
}

export function corsHeaders(req: Request) {
  const origin = (req.headers.get("Origin") || "").trim();
  const allow = originAllowed(origin) ? origin : SITE;
  return {
    "Access-Control-Allow-Origin": allow,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
}
