-- Reset completo da recompensa: inicia um novo ciclo no dia oficial de São Paulo.
CREATE OR REPLACE FUNCTION public.admin_reward_reset(_key_id uuid, _clear_history boolean, _password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  PERFORM public._require_admin(_password);

  INSERT INTO public.atlas_rewards(key_id,coins,last_daily_claim,total_claims,current_streak,best_streak,updated_at)
  VALUES(_key_id,0,NULL,0,0,0,0,now())
  ON CONFLICT(key_id) DO UPDATE SET
    coins=0,last_daily_claim=NULL,total_claims=0,current_streak=0,best_streak=0,updated_at=now();

  DELETE FROM public.atlas_reward_claims WHERE key_id=_key_id;

  RETURN jsonb_build_object(
    'ok',true,'coins',0,'last_daily_claim',NULL,'claimed_today',false,
    'current_streak',0,'best_streak',0,'today',today
  );
END;
$function$;
