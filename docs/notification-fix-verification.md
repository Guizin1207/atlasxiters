# Notificações: publicação e verificação

Esta correção não migra a base, não altera códigos/datas das keys e não redefine permissões de acesso.

## Publicação necessária

1. Publicar o frontend atualizado no projeto Lovable existente.
2. Publicar a Edge Function `notify-admin` com **os dois arquivos**, `index.ts` e `handler.ts`, no mesmo projeto Cloud usado atualmente pelo app.
3. Conferir no ambiente autorizado que os segredos VAPID existentes estão configurados e que a chave pública corresponde à usada em `src/lib/push.ts`. Não gerar outro par nem expor a chave privada em chat, código ou frontend.
4. Publicar usando a configuração por função em `supabase/config.toml`: este aplicativo autentica por senha ADM/key dentro do handler. A configuração `verify_jwt = false` preserva o comportamento atual desse endpoint, que já aceita chamadas sem sessão Supabase Auth. Não remover as validações de senha, key, conversa e destinatário do handler.

As RPCs existentes são reaproveitadas: não há nova migração SQL. ADM e usuário usam registros de service worker separados (`/push/admin/` e `/push/user/`), com endpoints independentes. A ativação de um papel não substitui o outro. Vários aparelhos continuam cadastrados como vários endpoints para o mesmo destinatário. Ao reativar, só se remove uma inscrição antiga da raiz quando ela pertence ao mesmo papel/aparelho; inscrições de outros aparelhos e todas as keys são preservadas.

## Causa confirmada do teste com falha

Em 20/09/2026, uma requisição de diagnóstico sem senha, key ou destinatário, com `kind: admin_test`, recebeu **HTTP 400 — Tipo de notificação inválido** da função em produção. Nenhuma notificação foi enviada. A versão antiga do servidor não reconhece o comando usado pelo frontend novo. Isso confirma que publicar apenas a interface não publicou a Edge Function atualizada.

Depois de publicar `index.ts` e `handler.ts`, essa mesma chamada incompleta deve receber HTTP 400 por **autenticação e destino ausentes**, com `version: 2`, e nunca enviar um push. O teste real exige a senha validada e o endpoint cadastrado como ADM. Não é necessário compartilhar nenhuma senha para verificar a versão.

Os diagnósticos da interface agora distinguem função antiga/ausente, rejeição de autenticação, configuração VAPID, cadastro expirado e ausência de destinatário. Corpos arbitrários de erros não são exibidos, para não expor segredos.

## No celular do administrador

- No iPhone, adicionar o app à Tela de Início e abri-lo pelo ícone instalado.
- Entrar com a autenticação de ADM, abrir **Notificações do ADM chefe**, tocar **Vincular este aparelho ao ADM** e permitir notificações.
- O login ADM fica em `/admin/login`, separado do login de usuário por key em `/login`. As credenciais e permissões existentes continuam sendo validadas no servidor.
- Verificar o rótulo **Este aparelho · ADM chefe** e tocar **Testar neste aparelho**.
- O teste usa o serviço remoto e limita o envio a esse endpoint; um retorno de envio aceito não prova a exibição pelo sistema operacional. Conferir também permissões/Foco no aparelho.
- No mesmo celular, é possível entrar também como usuário e ativar os avisos da key sem desligar os avisos do ADM. O perfil do usuário possui **Testar avisos desta key**. Nenhum desses vínculos concede acesso de ADM sem login.

## Compatibilidade do login ADM

O formulário antigo transformava o texto em maiúsculas antes de chamar `_check_admin`, cuja comparação no servidor diferencia maiúsculas e minúsculas. O login separado agora valida primeiro o texto informado; somente após uma recusa explícita tenta a conversão antiga. A sessão guarda exatamente o valor aceito pelo servidor para que as demais ações e os testes de push usem a mesma credencial. Nenhuma senha foi redefinida.

Falhas de conexão/RPC ou respostas inesperadas não são tratadas como chave inválida e não concedem acesso. Uma falha ao restaurar a sessão também não apaga a credencial salva; uma recusa explícita do servidor a remove. O botão de ADM ficou acima do formulário de usuário para reduzir entradas na tela errada.

Validação local: 76 testes passaram, incluindo compatibilidade do acesso antigo, preservação de senhas com caixa própria, recusa de credenciais incorretas, falhas de serviço e isolamento dos dois formulários. TypeScript e build passaram. O login com a chave real do administrador depende da validação no aparelho; nenhuma credencial foi solicitada nem testada nesta sessão.

## Cenários de aceitação no ambiente publicado

- Usuário com key ativa envia uma mensagem: o ADM recebe o push e a mensagem permanece no chat.
- Usuário com key expirada envia uma mensagem pelo suporte: o backend verifica a mensagem salva, sua conversa e a key antes de notificar o ADM.
- Expiração durante o uso ou antes de abrir o app: aparece **Sua key foi expirada** em vermelho; o sino e o suporte ficam acessíveis, as funções do painel ficam bloqueadas.
- Outra key não recebe esse aviso individual. Mensagens anteriores de outra key não aparecem ao trocar o acesso.
- Ativar ADM em dois celulares, enviar uma mensagem de usuário e conferir os dois aparelhos. Depois enviar resposta do ADM e conferir somente os aparelhos cadastrados para a key de destino.
- No mesmo navegador, ativar usuário e ADM; desativar apenas um e conferir que o outro vínculo foi preservado.
- Renovação confirmada pelo servidor remove o bloqueio e permite o próximo aviso de expiração.
- Falha/zero destinatários no push não é apresentada como sucesso. Remover outro aparelho da lista não desativa o aparelho atual.

## Limites de verificação

Os testes automatizados usam dados simulados. O acesso ao projeto Cloud original está indisponível nesta sessão; a função e o recebimento real no celular **não foram publicados/verificados daqui**.

Push de expiração com o aplicativo fechado depende da tarefa agendada já existente no servidor (`notify_expired_keys`). É necessário verificar sua execução, a autenticação da chamada e os logs HTTP no ambiente autorizado. Esta correção não presume que o cron esteja aplicado ou funcionando e não altera sua segurança.

Referências: [Web Push no iOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [registros de service worker](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register), [erros em Edge Functions](https://supabase.com/docs/guides/functions/error-handling) e [autenticação das funções](https://supabase.com/docs/guides/functions/auth-headers).
