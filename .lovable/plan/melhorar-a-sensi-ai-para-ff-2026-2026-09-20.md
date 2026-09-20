# Melhorar a Sensi AI para FF 2026

## Resultado
Um chat mais compacto, legível e confortável no celular, que identifica melhor o aparelho e explica uma sensibilidade personalizada para o Free Fire 2026.

## Interface
- Reorganizar a tela em três áreas claras: identificação do aparelho, conversa e configuração gerada.
- Usar os componentes de chat já presentes no projeto para mensagens, rolagem, carregamento e campo de envio.
- Manter a mensagem do usuário com alto contraste e a resposta da IA sem balão colorido.
- Criar atalhos rápidos para pedidos comuns: “Mais capa”, “Mais controle”, “Rush” e “AWM”.
- Ajustar alturas, espaçamentos, áreas de toque e quebra de texto para telas estreitas, incluindo 360–430 px.
- Trocar o símbolo genérico de IA por uma identidade visual própria da Sensi AI, sem alterar a identidade geral do Atlas VIP.

## Calibração FF 2026
- Melhorar a leitura do modelo informado e pedir esclarecimento quando o aparelho estiver incompleto.
- Considerar plataforma, proporção/tamanho da tela, taxa de atualização, resposta ao toque e desempenho conhecido, sem inventar especificações.
- Tratar pedidos seguintes como refinamentos da configuração atual, mudando apenas o necessário.
- Separar recomendações de Android e iOS; não recomendar DPI no iPhone/iPad.
- Retornar notas mais úteis: perfil escolhido, motivo dos ajustes e instruções curtas de teste fino.

## Comportamento
- Manter o histórico da conversa durante a sessão atual, sem criar novas tabelas ou alterar chaves.
- Rolar automaticamente para a mensagem mais recente e manter o campo pronto para digitar.
- Preservar copiar configuração, tratamento de erros e chamada existente da função `sensi-ai`.
- Publicar somente a atualização da função `sensi-ai`; não alterar `admin-ai` nem o banco.

## Verificação
- Conferir a interface em celular e desktop sem sobreposição ou cortes.
- Testar uma geração inicial e um refinamento posterior.
- Confirmar que copiar configuração funciona e que iOS não exibe DPI.
