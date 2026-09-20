# Notificações no celular do ADM (Android e iPhone)

Quando um cliente mandar mensagem no suporte ou enviar um comprovante, o celular do administrador recebe um aviso na tela — mesmo com o app fechado.

## Como vai funcionar

1. No painel do admin aparece um cartão **Notificações no celular** com o botão "Ativar neste aparelho".
2. Ao tocar, o celular pede permissão e o aparelho fica cadastrado. Só o admin (com a senha) consegue cadastrar.
3. Cada aparelho cadastrado aparece numa lista, com a opção de remover.
4. O aviso chega com estes textos:
   - **Atlas VIP — Novo atendimento** · "Você recebeu uma nova mensagem no suporte."
   - **Atlas VIP — Novo comprovante** · "Um cliente enviou um comprovante."
5. Tocar no aviso abre direto o painel do admin.

## Importante no iPhone

No iPhone, o aviso só funciona se o app for adicionado à Tela de Início (Safari → Compartilhar → Adicionar à Tela de Início) e aberto por esse ícone. No Android funciona no navegador e no app instalado. O cartão explica isso em texto, e mostra uma mensagem clara se o aparelho não suportar.

## Comprovantes

Vou conferir no banco se o espaço de armazenamento `support-receipts` e as permissões de envio/leitura estão realmente aplicados, e corrigir o que faltar. Também vou testar um envio real de imagem pelo chat.

## Nada é alterado

Chaves, planos, pagamentos, chat de suporte e demais funções continuam iguais. Nada é apagado nem recriado.

## Detalhes técnicos

- **Web Push (VAPID)** — sem Firebase. Gero o par de chaves VAPID; a privada e o subject ficam como segredos no backend, a pública fica disponível para o app.
- **Tabela nova** `push_subscriptions` (endpoint único, p256dh, auth, device, created_at, last_seen_at), RLS ativa sem política pública; acesso apenas por RPCs `SECURITY DEFINER`: `admin_save_push_subscription`, `admin_list_push_subscriptions`, `admin_delete_push_subscription` — todas validando a senha via `_require_admin`.
- **Service worker** `public/sw.js` com handlers `push` e `notificationclick`, registrado no boot do app (não interfere no Vite dev/HMR: só cache-less push).
- **Edge Function `notify-admin`** (`verify_jwt = false`): recebe `{ kind: "message" | "receipt", key }`, valida a chave com `_valid_access_key`, monta o payload e envia para todas as inscrições usando `npm:web-push`. Inscrições que retornam 404/410 são removidas automaticamente.
- **Integração**: `SupportChat.tsx` chama `notify-admin` depois de `support_send_message` (mensagem e comprovante), sem bloquear a UI e sem falhar o envio se a notificação der erro.
- **Frontend novo**: `src/components/admin/PushNotificationsCard.tsx` + `src/lib/push.ts` (registro do SW, conversão da chave VAPID, tratamento de iOS não instalado / permissão negada).
- Nenhuma função, tabela ou chave existente é modificada.
