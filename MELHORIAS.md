# Melhorias planejadas

## Experiencia de cadastro

- Manter a data selecionada ao voltar do modo de edicao.
- Manter o tipo selecionado depois de adicionar registros em sequencia.
- Adicionar botao para limpar campos do formulario.
- Permitir duplicar um registro existente.
- Adicionar atalhos de data como hoje, amanha, proximo mes e ultimo dia do mes.
- Evoluir recorrencia com frequencia mensal, semanal ou anual, parcelas e descricao automatica.

## Organizacao dos registros

- Criar categoria para cada receita ou despesa.
- Adicionar filtros por tipo, status e categoria.
- Adicionar busca por descricao.
- Permitir ordenacao por valor, data ou status.
- Separar visualmente receitas e despesas ou oferecer abas.

## Controle financeiro

- Mostrar saldo realizado com receitas confirmadas menos despesas pagas.
- Mostrar valores pendentes de receita e despesa.
- Mostrar percentual de despesas pagas no mes.
- Comparar o mes atual com o mes anterior.
- Criar previsao dos proximos 3 ou 6 meses.
- Adicionar orcamento mensal por categoria.
- Alertar quando despesas previstas passarem das receitas previstas.

## Status e fluxo de pagamento

- Usar textos diferentes para receita e despesa: recebido/receber e pago/pagar.
- Registrar a data real de pagamento ou recebimento.
- Permitir marcar varias despesas como pagas de uma vez.
- Permitir desfazer status em lote quando fizer sentido.

## Dados e seguranca

- Validar valores negativos, zerados ou invalidos.
- Padronizar valores numericos no backend.
- Evitar inserir dados incompletos diretamente na planilha.
- Criar migracao automatica para novas colunas.
- Adicionar colunas de criacao e atualizacao.
- Evitar renderizar dados do usuario como HTML direto.

## Interface

- Trocar alertas simples por mensagens na propria tela.
- Exibir mensagens de sucesso e erro mais claras.
- Melhorar estados de carregamento.
- Melhorar a tabela no celular.
- Usar cores e textos mais claros para valores positivos, negativos, pagos e pendentes.

## Recursos uteis

- Exportar o mes para CSV.
- Criar resumo anual.
- Criar graficos por mes.
- Criar graficos por categoria.

## Qualidade tecnica

- Separar melhor funcoes de formulario, renderizacao e API no JavaScript.
- Centralizar constantes de tipos, status, categorias e colunas.
- Melhorar tratamento de erros no backend.
- Manter compatibilidade com Google Apps Script V8 e sem dependencias externas.

