import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { createNotifyHandler } from "./handler.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:suporte@atlasxiters.lovable.app";

if (publicKey && privateKey) webpush.setVapidDetails(subject, publicKey, privateKey);

Deno.serve(createNotifyHandler({
  admin: createClient(url, serviceRole, { auth: { persistSession: false } }),
  pushConfigured: Boolean(publicKey && privateKey),
  corsHeaders,
  sendNotification: (target, payload) => webpush.sendNotification(target, payload),
}));
