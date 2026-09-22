-- 1) Helpers internos SECURITY DEFINER deixam de ser chamáveis pelo público.
--    Eles só são usados dentro de outras funções (mesmo owner) e pela service role.
--    _cfg_text/_cfg_bool liam app_config (inclusive a senha mestra) e _gen_key gerava chaves.
revoke execute on function public._cfg_text(text) from anon, authenticated, public;
revoke execute on function public._cfg_bool(text) from anon, authenticated, public;
revoke execute on function public._require_admin(text) from anon, authenticated, public;
revoke execute on function public._gen_key() from anon, authenticated, public;
revoke execute on function public._reward_cfg() from anon, authenticated, public;
revoke execute on function public._reward_key_id(text) from anon, authenticated, public;
revoke execute on function public._reward_state(uuid) from anon, authenticated, public;
revoke execute on function public._valid_access_key(text) from anon, authenticated, public;
revoke execute on function public.notify_expired_keys() from anon, authenticated, public;

grant execute on function public._cfg_text(text) to service_role;
grant execute on function public._cfg_bool(text) to service_role;
grant execute on function public._require_admin(text) to service_role;
grant execute on function public._reward_cfg() to service_role;
grant execute on function public._reward_key_id(text) to service_role;
grant execute on function public._reward_state(uuid) to service_role;
grant execute on function public._valid_access_key(text) to service_role;
grant execute on function public.notify_expired_keys() to service_role;

-- 2) Comprovantes do suporte: sem acesso anônimo direto ao bucket privado.
--    Envio e leitura passam pela edge function support-receipt, que valida
--    a chave do usuário (só a própria pasta) ou a senha do administrador
--    e devolve uma URL assinada temporária.
drop policy if exists "support_receipts_read" on storage.objects;
drop policy if exists "support_receipts_upload" on storage.objects;