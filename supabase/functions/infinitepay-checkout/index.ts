import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
const cors={ "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type" };
const prices={basic:1,pro:85.99,master:149.99};
serve(async(req)=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
 try{
  const {key,plan}=await req.json(); const price=prices[plan as keyof typeof prices];
  const handle=Deno.env.get("INFINITEPAY_HANDLE");
  if(!handle||!key||!price) throw new Error("Configuração de pagamento inválida");
  const orderNsu=`ATLAS|${String(key).trim().toUpperCase()}|${plan}`;
  const r=await fetch("https://api.checkout.infinitepay.io/links",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
   handle, order_nsu:orderNsu,
   redirect_url:"https://atlasxiters.lovable.app/painel",
   webhook_url:`${Deno.env.get("SUPABASE_URL")}/functions/v1/infinitepay-webhook`,
   items:[{quantity:1,price:Math.round(price*100),description:`Atlas VIP ${plan}`}]
  })});
  const data=await r.json(); if(!r.ok||!data?.url) throw new Error(data?.message||"Não foi possível criar o checkout");
  return new Response(JSON.stringify({url:data.url}),{headers:{...cors,"Content-Type":"application/json"}});
 }catch(e){return new Response(JSON.stringify({error:e instanceof Error?e.message:"Erro no checkout"}),{status:500,headers:{...cors,"Content-Type":"application/json"}})}
});