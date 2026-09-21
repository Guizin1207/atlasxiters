-- Um único aparelho pode ficar vinculado ao ADM geral.
-- Uma única inscrição pode ficar vinculada a cada key de usuário.
create unique index if not exists push_subscriptions_one_admin_idx
on public.push_subscriptions (scope)
where scope = 'admin';

create unique index if not exists push_subscriptions_one_user_key_idx
on public.push_subscriptions (key_id)
where scope = 'user' and key_id is not null;