# Acesso do admin ao painel e chaves rápidas

## Objetivo
Permitir que o administrador abra o painel de funções sem sair da sessão administrativa e agilizar a criação de acessos curtos para venda diária ou demonstração.

## O que será alterado
- Adicionar no topo do admin o botão **Abrir painel de funções**.
- Autorizar esse acesso no banco usando a senha administrativa já validada, sem expor nem gravar uma chave mestra no código.
- Ao sair do painel de funções, retornar ao admin quando o acesso tiver sido iniciado por ele.
- Adicionar no gerador os modos:
  - **Normal**: mantém plano e duração configuráveis.
  - **Diária**: cria chave com 1 dia de acesso.
  - **Demo**: cria chave de teste com 1 dia e identificação automática na nota.
- Manter quantidade, plano e cópia das chaves geradas funcionando como hoje.

## Regras
- O tempo começa somente no primeiro uso da chave, como no fluxo atual.
- Chaves diária e demo continuam presas a um único dispositivo.
- A demonstração usará o plano Basic por padrão; o administrador ainda poderá escolher outro plano antes de gerar.
- Todo acesso administrativo continuará sendo validado no banco.

## Detalhes técnicos
- Criar uma função protegida para entregar ao admin uma sessão de painel baseada na chave mestra existente.
- Ampliar o contexto de acesso para aceitar essa sessão e registrar que ela veio do admin.
- Ajustar o cabeçalho/saída do painel e o formulário de geração, sem mudar os demais fluxos.
- Validar login, entrada admin → painel, retorno ao admin e geração diária/demo em tela móvel.
