-- Permite ao ADM ajustar manualmente a versão exibida no painel.
create or replace function public.admin_set_app_version(
  _password text,
  _version text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text;
begin
  perform public._require_admin(_password);

  if not coalesce((public.get_maintenance()).enabled, false) then
    raise exception 'Ative o modo de manutenção antes de alterar a versão.';
  end if;

  normalized := btrim(coalesce(_version, ''));
  if normalized !~ '^([0-9]+)\\.([0-9]+)$' then
    raise exception 'Versão inválida. Use o formato X.Y, por exemplo 1.2 ou 2.0.';
  end if;

  insert into public.app_config (key, value, updated_at)
  values ('app_version', to_jsonb(normalized), now())
  on conflict (key) do update
    set value = excluded.value, updated_at = now();

  return normalized;
end;
$$;

grant execute on function public.admin_set_app_version(text, text) to anon, authenticated;
