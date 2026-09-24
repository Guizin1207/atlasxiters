create or replace function public.get_my_access_key()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare r record;
begin
  if auth.uid() is null then
    raise exception 'login_required';
  end if;

  select id,key,duration_days,device,device_id,activated_at,expires_at,note,is_master,revoked,created_at,plan
    into r
  from public.access_keys
  where user_id = auth.uid()
  limit 1;

  if r.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'id', r.id,
    'key', r.key,
    'duration_days', r.duration_days,
    'device', r.device,
    'device_id', r.device_id,
    'activated_at', r.activated_at,
    'expires_at', r.expires_at,
    'note', r.note,
    'is_master', r.is_master,
    'revoked', r.revoked,
    'created_at', r.created_at,
    'plan', r.plan
  );
end;
$function$;

revoke all on function public.get_my_access_key() from public;
grant execute on function public.get_my_access_key() to authenticated;