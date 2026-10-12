/** Resmî IYZWSv2: HMAC-SHA256(randomKey + uriPath + body, secretKey) hex, sonra Base64(apiKey:&randomKey:&signature:). https://docs.iyzico.com/en/getting-started/preliminaries/authentication/hmacsha256-auth */

const enc = new TextEncoder();

export function iyzicoBaseUrl(apiKey: string) {
  const override = (Deno.env.get("IYZICO_BASE_URL") || "").trim().replace(/\/$/, "");
  if (override) return override;
  return apiKey.startsWith("sandbox-") ? "https://sandbox-api.iyzipay.com" : "https://api.iyzipay.com";
}

async function hmacSha256Hex(secret: string, data: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function iyzicoAuthHeader(apiKey: string, secretKey: string, uriPath: string, body: string, randomKey: string) {
  const signature = await hmacSha256Hex(secretKey, `${randomKey}${uriPath}${body}`);
  const packed = `apiKey:${apiKey}&randomKey:${randomKey}&signature:${signature}`;
  return `IYZWSv2 ${btoa(packed)}`;
}

export async function iyzicoPost(path: string, payload: Record<string, unknown>) {
  const apiKey = (Deno.env.get("IYZICO_API_KEY") || "").trim();
  const secretKey = (Deno.env.get("IYZICO_SECRET_KEY") || "").trim();
  if (!apiKey || !secretKey) return { ok: false as const, error: "IYZICO_API_KEY / IYZICO_SECRET_KEY yok" };
  const body = JSON.stringify(payload);
  const randomKey = `${Date.now()}${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const auth = await iyzicoAuthHeader(apiKey, secretKey, path, body, randomKey);
  const res = await fetch(`${iyzicoBaseUrl(apiKey)}${path}`, {
    method: "POST",
    headers: {
      Authorization: auth,
      "x-iyzi-rnd": randomKey,
      "Content-Type": "application/json",
    },
    body,
  });
  let json: Record<string, unknown> = {};
  try {
    json = await res.json();
  } catch {
    return { ok: false as const, error: `iyzico HTTP ${res.status}` };
  }
  if (String(json.status || "") !== "success") {
    return { ok: false as const, error: String(json.errorMessage || json.status || "iyzico hata"), json };
  }
  return { ok: true as const, json };
}
