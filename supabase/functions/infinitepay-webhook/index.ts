import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
serve(async(req)=>{
 try{
  const body=await req.json().catch(()=>({})); const order=String(body?.order_nsu||"");
  if(!order.startsWith("ATLAS|")) return new Response("ok",{status:200});
  const [,rawKey,plan]=order.split("|"); const key=String(rawKey||"").trim().toUpperCase();
  if(!key||!["basic","pro","master"].includes(plan)) return new Response("ok",{status:200});
  const expected=plan==="basic"?100:plan==="pro"?8599:14999;
  if(Number(body?.amount)!==expected && Number(body?.paid_amount||0)<expected) return new Response("ok",{status:200});
  const url=Deno.env.get("SUPABASE_URL"), role=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!role) throw new Error("Supabase não configurado");
  const days=plan==="basic"?30:plan==="pro"?90:0;
  const sb=createClient(url,role);
  const {error}=await sb.from("access_keys").update({plan,is_master:plan==="master",duration_days:days,activated_at:new Date().toISOString(),expires_at:plan==="master"?null:new Date(Date.now()+days*86400000).toISOString(),revoked:false}).eq("key",key);
  if(error) throw error; return new Response(JSON.stringify({success:true}),{status:200});
 }catch(e){console.error(e);return new Response("ok",{status:200})}
});