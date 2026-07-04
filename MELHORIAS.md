# Melhorias planejadas

## Implementadas nesta rodada

- Data selecionada preservada ao voltar do modo de edição.
- Tipo e categoria preservados para cadastros em sequência.
- Categoria adicionada aos registros, com migração automática de colunas.
- Categorias cadastradas em guia própria `Categorias`.
- Filtros por tipo, status, categoria e busca por descrição.
- Totais de receitas recebidas, receitas pendentes, despesas pendentes, saldo realizado e percentual de despesas pagas.
- Saldos agrupados por categoria no resumo mensal.
- Aba de gráficos por categoria com barras e rosca.
- Status com texto adequado para receita e despesa: receber/recebido e pagar/pago.
- Registro de criação, atualização e data de pagamento/recebimento.
- Mensagens de sucesso e erro na tela em vez de alertas para operações principais.
- Renderização da tabela sem inserir descrição do usuário como HTML direto.
- Validação de valor maior que zero no frontend e no backend.
- Testes automatizados do backend com mocks de Google Apps Script e planilha.
- Modo de execução local com mock de `google.script.run`.

## Experiência de cadastro

- Manter a data selecionada ao voltar do modo de edição.
- Manter o tipo selecionado depois de adicionar registros em sequência.
- Adicionar botão para limpar campos do formulário.
- Permitir duplicar um registro existente.
- Adicionar atalhos de data como hoje, amanhã, próximo mês e último dia do mês.
- Evoluir recorrência com frequência mensal, semanal ou anual, parcelas e descrição automática.

## Organização dos registros

- Criar categoria para cada receita ou despesa.
- Adicionar filtros por tipo, status e categoria.
- Adicionar busca por descrição.
- Permitir ordenação por valor, data ou status.
- Separar visualmente receitas e despesas ou oferecer abas.

## Controle financeiro

- Mostrar saldo realizado com receitas confirmadas menos despesas pagas.
- Mostrar valores pendentes de receita e despesa.
- Mostrar percentual de despesas pagas no mês.
- Comparar o mês atual com o mês anterior.
- Criar previsão dos próximos 3 ou 6 meses.
- Adicionar orçamento mensal por categoria.
- Alertar quando despesas previstas passarem das receitas previstas.

## Status e fluxo de pagamento

- Usar textos diferentes para receita e despesa: recebido/receber e pago/pagar.
- Registrar a data real de pagamento ou recebimento.
- Permitir marcar várias despesas como pagas de uma vez.
- Permitir desfazer status em lote quando fizer sentido.

## Dados e segurança

- Validar valores negativos, zerados ou inválidos.
- Padronizar valores numéricos no backend.
- Evitar inserir dados incompletos diretamente na planilha.
- Criar migração automática para novas colunas.
- Adicionar colunas de criação e atualização.
- Evitar renderizar dados do usuário como HTML direto.

## Interface

- Trocar alertas simples por mensagens na própria tela.
- Exibir mensagens de sucesso e erro mais claras.
- Melhorar estados de carregamento.
- Melhorar a tabela no celular.
- Usar cores e textos mais claros para valores positivos, negativos, pagos e pendentes.

## Recursos úteis

- Exportar o mês para CSV.
- Criar resumo anual.
- Criar gráficos por mês.
- Criar gráficos por categoria.

## Qualidade técnica

- Separar melhor funções de formulário, renderização e API no JavaScript.
- Centralizar constantes de tipos, status, categorias e colunas.
- Melhorar tratamento de erros no backend.
- Manter compatibilidade com Google Apps Script V8 e sem dependências externas.
