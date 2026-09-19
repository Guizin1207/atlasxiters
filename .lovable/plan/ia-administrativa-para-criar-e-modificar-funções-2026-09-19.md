# IA administrativa para criar e modificar funções

## Objetivo
Adicionar ao `/admin` uma conversa única com IA, salva no Lovable Cloud. A IA poderá criar, editar, remover e reorganizar as funções exibidas no painel, mas nenhuma mudança será aplicada sem confirmação explícita do administrador.

## Experiência no admin
- Adicionar uma área **IA do painel** dentro do admin, mantendo o visual dark compacto atual.
- Exibir respostas em conversa, indicador de processamento e campo de mensagem com foco automático.
- Mostrar propostas como uma prévia clara: ação, função afetada, nome, categoria, plano mínimo e posição.
- Oferecer botões **Aplicar alteração** e **Recusar** em cada proposta; ações destrutivas terão confirmação destacada.
- Manter uma única conversa e restaurar seu histórico em outros dispositivos após a senha mestra ser validada.
- Exibir erros reais de configuração, créditos ou indisponibilidade sem apagar a mensagem digitada.

## Catálogo dinâmico de funções
- Levar o catálogo editável para o Lovable Cloud, preservando inicialmente as oito funções atuais e sua ordem.
- Cada função terá identificador estável, nome, categoria, plano mínimo, ícone permitido, ordem e estado visível.
- O painel do usuário carregará esse catálogo e continuará aplicando bloqueio por plano e persistência dos botões ativos.
- Se a nuvem estiver temporariamente indisponível, o painel usará o catálogo atual como fallback somente de leitura.

## Segurança e controle
- Validar a senha mestra no servidor em toda leitura do histórico e em toda alteração administrativa.
- Manter tabelas fechadas para acesso direto e expor apenas operações `SECURITY DEFINER` validadas.
- A IA apenas gera propostas estruturadas; a mudança real ocorre somente após o clique do administrador.
- Validar identificadores, nomes, planos, ícones e ordem no servidor; impedir alterações fora do catálogo de funções.
- Registrar quem/qual proposta alterou o catálogo e conservar um histórico de auditoria para desfazer manualmente uma mudança.

## Lovable AI
- Criar uma função segura no Lovable Cloud usando `openai/gpt-6-astra`, streaming e histórico completo da conversa.
- Usar ferramentas estruturadas para propor criação, edição, remoção e reordenação.
- Salvar mensagens concluídas no histórico único e nunca expor a chave da IA no navegador.
- Renderizar a conversa com AI Elements, incluindo mensagens, raciocínio resumido, ferramenta recolhida e confirmação.

## Dados
- Criar tabelas para catálogo de funções, conversa administrativa e auditoria, com `GRANT`, RLS e acesso apenas por funções validadas.
- Criar operações para carregar/salvar o histórico, listar o catálogo para uma chave válida, aplicar uma proposta e consultar auditoria.
- Atualizar os tipos gerados após a migração.

## Verificação
- Testar criação, edição, remoção e reordenação, incluindo recusa e confirmação.
- Confirmar que usuários Basic, Pro e Master veem os bloqueios corretos após mudanças.
- Recarregar o admin e abrir em outra sessão para verificar a conversa persistida.
- Verificar em tela mobile e desktop que conversa, propostas e botões não se sobrepõem.
- Executar testes, verificação de tipos, build e lint; fazer uma chamada real à IA para validar streaming e ferramentas.
