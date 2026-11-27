import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Only public branding is exposed; writes remain in the admin-validated RPC.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const headers = { ...corsHeaders, "Cache-Control": "no-store" };
  const url = new URL(req.url);
  const backend = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY");
  if (!backend || !key) return new Response("Unavailable", { status: 503, headers });
  const { data, error } = await createClient(backend, key).rpc("get_app_appearance");
  if (error) return new Response("Unavailable", { status: 503, headers });
  const logo = data?.logo;
  if (url.searchParams.get("manifest") === "1") {
    let origin: string;
    try {
      const parsed = new URL(url.searchParams.get("origin") ?? "");
      if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && parsed.hostname === "localhost")) throw new Error();
      origin = parsed.origin;
    } catch { return new Response("Invalid origin", { status: 400, headers }); }
    const icon = new URL(`${backend}/functions/v1/app-icon`);
    icon.searchParams.set("v", url.searchParams.get("v") ?? "1");
    return new Response(JSON.stringify({
      id: `${origin}/`, name: "Atlas VIP", short_name: "Atlas VIP", description: "Painel premium de acesso por chave.",
      start_url: `${origin}/login`, scope: `${origin}/`, display: "standalone", orientation: "portrait",
      background_color: "#0a0a0a", theme_color: "#0a0a0a",
      icons: [{ src: icon.href, sizes: "512x512", type: "image/png", purpose: "any" }],
    }), { headers: { ...headers, "Content-Type": "application/manifest+json" } });
  }
  if (typeof logo !== "string" || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(logo)) {
    return new Response(null, { status: 302, headers: { ...headers, Location: "https://atlasxiters.lovable.app/pwa-192.png" } });
  }
  const bytes = Uint8Array.from(atob(logo.split(",")[1]), (c) => c.charCodeAt(0));
  return new Response(bytes, { headers: { ...headers, "Content-Type": "image/png" } });
});