CREATE OR REPLACE FUNCTION public.get_my_access_key()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select to_jsonb(k) || jsonb_build_object('customer_name', p.full_name)
  from public.access_keys k left join public.profiles p on p.id = k.user_id
  where auth.uid() is not null and k.user_id = auth.uid()
  order by k.revoked, k.expires_at desc nulls first limit 1
$$;
REVOKE ALL ON FUNCTION public.get_my_access_key() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_access_key() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_users(_password text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  perform public._require_admin(_password);
  return coalesce((select jsonb_agg(row_to_json(t) order by t.created_at desc) from (
    select u.id as user_id, coalesce(nullif(p.full_name,''), u.raw_user_meta_data->>'full_name') as username,
      u.email, u.created_at, u.last_sign_in_at, (p.id is not null) as has_profile,
      k.key, k.plan, k.device, k.device_id, k.activated_at as key_activated_at, k.expires_at as key_expires_at,
      case when k.id is null then 'no_key' when k.revoked then 'revoked'
           when k.expires_at is not null and k.expires_at < now() then 'expired' else 'active' end as status
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join lateral (select * from public.access_keys a where a.user_id = u.id order by a.created_at desc limit 1) k on true
    where coalesce(u.is_anonymous,false) = false
  ) t), '[]'::jsonb);
end $$;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.redeem_key(_key text, _device text, _device_id text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  rec public.access_keys%rowtype;
  k text := upper(trim(_key));
begin
  if k is null or k = '' then raise exception 'invalid_key'; end if;
  select * into rec from public.access_keys where key = k;
  if not found then raise exception 'invalid_key'; end if;
  if rec.revoked then raise exception 'revoked_key'; end if;

  if rec.is_master then
    update public.access_keys set device = coalesce(_device, device), device_id = coalesce(_device_id, device_id),
           activated_at = coalesce(activated_at, now()) where id = rec.id returning * into rec;
    return to_jsonb(rec);
  end if;

  if rec.user_id is not null and auth.uid() is distinct from rec.user_id then
    raise exception 'account_mismatch';
  end if;

  if rec.device_id is null and rec.device is not null and rec.activated_at is null
     and lower(rec.device) <> lower(coalesce(_device, '')) then
    raise exception 'device_mismatch';
  end if;

  if rec.activated_at is not null then
    if rec.device_id is not null and rec.device_id <> _device_id then raise exception 'device_mismatch'; end if;
    if rec.expires_at is not null and rec.expires_at < now() then raise exception 'expired_key'; end if;
    update public.access_keys set device = coalesce(_device, device), device_id = coalesce(rec.device_id, _device_id),
           user_id = coalesce(user_id, auth.uid())
     where id = rec.id returning * into rec;
    return to_jsonb(rec);
  end if;

  update public.access_keys
     set device = _device, device_id = _device_id, activated_at = now(), user_id = coalesce(user_id, auth.uid()),
         expires_at = case when lower(rec.plan) = 'demo' then null else now() + (rec.duration_days || ' days')::interval end
   where id = rec.id returning * into rec;
  return to_jsonb(rec);
end;
$function$;