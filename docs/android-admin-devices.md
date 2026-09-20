# Publicação: abertura Android e acessos ADM

Aplicar no projeto Cloud atual a migração `supabase/migrations/20260920191633_admin_access_sessions.sql` antes de publicar o frontend. Ela adiciona somente o registro privado de sessões e três RPCs, todas protegidas pela validação ADM existente. Nenhuma key, senha, prazo ou conexão é alterada. A sessão continua exigindo a senha ADM; este registro é auditoria, não revogação de credenciais.

Sem a migração ou sem conexão, o cartão informa indisponibilidade em vez de fingir que nenhum outro aparelho acessou. O login não é bloqueado se a auditoria estiver indisponível. Registros começam após a implantação; dispositivos antigos aparecem quando abrirem novamente o painel. A tabela mostra os últimos 100 acessos, aparelho/navegador, primeiro acesso da sessão, última atividade e saída explícita. Atividade recente não comprova presença online. Uma senha compartilhada não identifica o nome da pessoa. Não são coletados senha no registro, IP ou localização.

O botão de jogo agora usa links tocados diretamente, sem o temporizador de 4,5 segundos que perdia o gesto do usuário. O intent Android tem retorno explícito ao próprio painel, sem URL de loja e sem levar parâmetros sensíveis da página. Os esquemas existentes de Free Fire/Free Fire MAX são usados como tentativa de abertura; compatibilidade depende da versão instalada e do navegador. O retorno exibe orientação para abrir pelo ícone. Não há injeção real de arquivo ou alteração do jogo pelo navegador.

Referência: https://developer.chrome.com/docs/android/intents (gesto do usuário, browser_fallback_url e exigência de activity BROWSABLE).

Verificar em Android real após publicação: tocar na versão instalada; se não suportar link, permanecer/retornar ao painel sem encaminhamento à loja. Conferir também com o jogo ausente. Validar dois logins ADM em aparelhos distintos e saída em um deles. Conferir que senha inválida não consulta nem grava registros e que anon não acessa a tabela privada diretamente. O acesso ao banco original continua indisponível nesta sessão: migração, consultas reais, advisors e abertura em aparelho físico não foram executados daqui.
