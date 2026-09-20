# Notificações: publicação e verificação

Esta correção não migra a base, não altera códigos/datas das keys e não redefine permissões de acesso.

## Publicação necessária

1. Publicar o frontend atualizado no projeto Lovable existente.
2. Publicar a Edge Function `notify-admin` com **os dois arquivos**, `index.ts` e `handler.ts`, no mesmo projeto Cloud usado atualmente pelo app.
3. Conferir no ambiente autorizado que os segredos VAPID existentes estão configurados e que a chave pública corresponde à usada em `src/lib/push.ts`. Não gerar outro par nem expor a chave privada em chat, código ou frontend.
4. Manter a configuração atual de autenticação da função. Não desabilitar verificações de segurança para contornar um erro de acesso.

As RPCs existentes são reaproveitadas: não há nova migração SQL nesta correção. O botão de ativação do ADM consegue reparar o cadastro legado de usuário substituindo somente o registro de push do endpoint atual, depois de autenticar o ADM. Não remove outros aparelhos nem qualquer key.

## No celular do administrador

- No iPhone, adicionar o app à Tela de Início e abri-lo pelo ícone instalado.
- Entrar com a autenticação de ADM, abrir **Notificações do ADM chefe**, tocar **Vincular este aparelho ao ADM** e permitir notificações.
- Verificar o rótulo **Este aparelho · ADM chefe** e tocar **Testar neste aparelho**.
- O teste usa o serviço remoto e limita o envio a esse endpoint; um retorno de envio aceito não prova a exibição pelo sistema operacional. Conferir também permissões/Foco no aparelho.
- Um celular vinculado ao ADM não é automaticamente convertido em destinatário de usuário ao abrir o painel do cliente. Isso não concede acesso de ADM sem login.

## Cenários de aceitação no ambiente publicado

- Usuário com key ativa envia uma mensagem: o ADM recebe o push e a mensagem permanece no chat.
- Usuário com key expirada envia uma mensagem pelo suporte: o backend verifica a mensagem salva, sua conversa e a key antes de notificar o ADM.
- Expiração durante o uso ou antes de abrir o app: aparece **Sua key foi expirada** em vermelho; o sino e o suporte ficam acessíveis, as funções do painel ficam bloqueadas.
- Outra key não recebe esse aviso individual. Mensagens anteriores de outra key não aparecem ao trocar o acesso.
- Renovação confirmada pelo servidor remove o bloqueio e permite o próximo aviso de expiração.
- Falha/zero destinatários no push não é apresentada como sucesso. Remover outro aparelho da lista não desativa o aparelho atual.

## Limites de verificação

Os testes automatizados usam dados simulados. O acesso ao projeto Cloud original está indisponível nesta sessão; a função e o recebimento real no celular **não foram publicados/verificados daqui**.

Push de expiração com o aplicativo fechado depende da tarefa agendada já existente no servidor (`notify_expired_keys`). É necessário verificar sua execução, a autenticação da chamada e os logs HTTP no ambiente autorizado. Esta correção não presume que o cron esteja aplicado ou funcionando e não altera sua segurança.

Referências: [Web Push no iOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) e [erros em Edge Functions](https://supabase.com/docs/guides/functions/error-handling).
