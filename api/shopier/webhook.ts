import { createClient } from "@supabase/supabase-js";
import { handleShopierWebhook } from "../_lib/shopierWebhook.ts";

declare const process: { env: Record<string, string | undefined> };

/** Edge: esbuild paketler (_shared .ts importları çözülür). dub1 = Supabase eu-west-1'e en yakın bölge. */
export const config = { runtime: "edge", regions: ["dub1"] };

export default function handler(req: Request): Promise<Response> {
  return handleShopierWebhook(req, {
    env: (name) => process.env[name],
    createAdmin: (url, key) => createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }),
  });
}
