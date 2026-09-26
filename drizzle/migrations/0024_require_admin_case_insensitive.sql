CREATE OR REPLACE FUNCTION public._require_admin(_password text)
 RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  if not public._check_admin(_password) then raise exception 'unauthorized'; end if;
end;
$function$;