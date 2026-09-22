-- Versão automática do Atlas VIP.
insert into public.app_config (key, value, updated_at)
values ('app_version', to_jsonb('1.0'::text), now())
on conflict (key) do nothing;

create or replace function public.get_app_version()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public._cfg_text('app_version'), '1.0')
$$;

grant execute on function public.get_app_version() to anon, authenticated;

create or replace function public.admin_set_maintenance(
  _enabled boolean, _message text, _password text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_enabled boolean;
  current_version text;
  major int;
  minor int;
  next_version text;
begin
  perform public._require_admin(_password);

  previous_enabled := coalesce(public._cfg_bool('maintenance_enabled'), false);

  -- Cada nova entrada em manutenção representa uma nova atualização.
  -- Salvar novamente enquanto já estiver em manutenção não aumenta a versão.
  if coalesce(_enabled, false) and not previous_enabled then
    current_version := coalesce(public._cfg_text('app_version'), '1.0');

    begin
      major := split_part(current_version, '.', 1)::int;
      minor := split_part(current_version, '.', 2)::int;
    exception when others then
      major := 1;
      minor := 0;
    end;

    minor := minor + 1;
    if minor >= 10 then
      major := major + 1;
      minor := 0;
    end;

    next_version := major::text || '.' || minor::text;

    insert into public.app_config (key, value, updated_at)
    values ('app_version', to_jsonb(next_version), now())
    on conflict (key) do update
      set value = excluded.value, updated_at = now();
  end if;

  insert into public.app_config (key, value, updated_at)
  values ('maintenance_enabled', to_jsonb(coalesce(_enabled, false)), now())
  on conflict (key) do update set value = excluded.value, updated_at = now();

  insert into public.app_config (key, value, updated_at)
  values ('maintenance_message', to_jsonb(coalesce(_message, '')), now())
  on conflict (key) do update set value = excluded.value, updated_at = now();

  return jsonb_build_object(
    'enabled', coalesce(_enabled, false),
    'message', coalesce(_message, ''),
    'version', coalesce(public._cfg_text('app_version'), '1.0')
  );
end;
$$;

grant execute on function public.admin_set_maintenance(boolean, text, text) to anon, authenticated;
