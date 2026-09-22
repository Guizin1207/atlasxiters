import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { createNotifyHandler } from "./handler.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:suporte@atlasxiters.lovable.app";

let pushConfigCode: "PUSH_NOT_CONFIGURED" | "PUSH_CONFIG_INVALID" | undefined;
if (!publicKey || !privateKey) pushConfigCode = "PUSH_NOT_CONFIGURED";
else {
  try { webpush.setVapidDetails(subject, publicKey, privateKey); }
  catch { pushConfigCode = "PUSH_CONFIG_INVALID"; }
}

const handler = createNotifyHandler({
  admin: createClient(url, serviceRole, { auth: { persistSession: false } }),
  pushConfigured: !pushConfigCode,
  pushConfigCode,
  corsHeaders,
  sendNotification: (target, payload) => webpush.sendNotification(target, payload, { TTL: 300, timeout: 8_000 }),
});

Deno.serve(async (req) => {
  const requestUrl = new URL(req.url);
  // A chave pública VAPID não é segredo: o app precisa dela para cadastrar aparelhos.
  if (req.method === "GET" && requestUrl.searchParams.get("info") === "vapid") {
    return new Response(JSON.stringify({ publicKey: publicKey ?? null, version: 6 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return handler(req);
});
