const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

class FakeRange {
  constructor(sheet, row, column, numRows, numColumns) {
    this.sheet = sheet;
    this.row = row;
    this.column = column;
    this.numRows = numRows;
    this.numColumns = numColumns;
  }

  getValues() {
    const values = [];
    for (let r = 0; r < this.numRows; r++) {
      const sourceRow = this.sheet.rows[this.row - 1 + r] || [];
      const valuesRow = [];
      for (let c = 0; c < this.numColumns; c++) {
        valuesRow.push(sourceRow[this.column - 1 + c] ?? '');
      }
      values.push(valuesRow);
    }
    return values;
  }

  setValues(values) {
    for (let r = 0; r < values.length; r++) {
      const rowIndex = this.row - 1 + r;
      if (!this.sheet.rows[rowIndex]) this.sheet.rows[rowIndex] = [];
      for (let c = 0; c < values[r].length; c++) {
        this.sheet.rows[rowIndex][this.column - 1 + c] = values[r][c];
      }
    }
    return this;
  }

  setValue(value) {
    return this.setValues([[value]]);
  }

  setFontWeight() {
    return this;
  }
}

class FakeSheet {
  constructor(rows = []) {
    this.rows = rows.map(row => row.slice());
  }

  getLastColumn() {
    return this.rows.reduce((max, row) => Math.max(max, row.length), 0);
  }

  getRange(row, column, numRows, numColumns) {
    if (typeof row === 'string') return new FakeRange(this, 1, 1, 1, this.getLastColumn() || 1);
    return new FakeRange(this, row, column, numRows || 1, numColumns || 1);
  }

  appendRow(row) {
    this.rows.push(row.slice());
  }

  getDataRange() {
    return {
      getValues: () => this.rows.map(row => row.slice())
    };
  }

  deleteRow(rowIndex) {
    this.rows.splice(rowIndex - 1, 1);
  }
}

class FakeSpreadsheet {
  constructor(initialData) {
    this.sheets = {};
    if (Array.isArray(initialData)) {
      this.sheets.Transactions = new FakeSheet(initialData);
    } else if (initialData) {
      if (initialData.transactions) this.sheets.Transactions = new FakeSheet(initialData.transactions);
      if (initialData.categories) this.sheets.Categorias = new FakeSheet(initialData.categories);
    }
  }

  getSheetByName(name) {
    return this.sheets[name] || null;
  }

  insertSheet(name) {
    this.sheets[name] = new FakeSheet();
    return this.sheets[name];
  }
}

function loadBackend(initialData) {
  const code = readFileSync('Codigo.gs', 'utf8');
  const spreadsheet = new FakeSpreadsheet(initialData);
  let uuidCounter = 0;
  const context = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => spreadsheet
    },
    Utilities: {
      getUuid: () => `uuid-${++uuidCounter}`
    },
    HtmlService: {
      createHtmlOutputFromFile: () => ({
        setTitle() { return this; },
        addMetaTag() { return this; },
        setXFrameOptionsMode() { return this; }
      }),
      XFrameOptionsMode: {
        ALLOWALL: 'ALLOWALL'
      }
    }
  };

  vm.createContext(context);
  vm.runInContext(`${code}
    globalThis.__app = {
      DateUtils,
      TransactionRepository,
      TransactionService,
      apiAddTransaction,
      apiUpdateTransaction,
      apiToggleTransactionStatus,
      apiSetTransactionsStatus,
      apiDeleteTransaction,
      apiGetMonthlySummary,
      apiGetCategories,
      CategoryRepository,
      TRANSACTION_HEADERS
    };
  `, context);

  return {
    ...context.__app,
    spreadsheet
  };
}

test('adiciona transacoes recorrentes mensais preservando ultimo dia valido', () => {
  const app = loadBackend();

  const result = app.apiAddTransaction({
    date: '2026-01-31',
    type: 'EXPENSE',
    description: 'Aluguel',
    amount: 1500,
    category: 'Moradia',
    recurrence: 3
  });

  assert.equal(result.success, true);

  const rows = app.spreadsheet.getSheetByName('Transactions').rows;
  assert.deepEqual(rows[0], Array.from(app.TRANSACTION_HEADERS));
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.slice(1).map(row => row[3]), ['2026-01-31', '2026-02-28', '2026-03-31']);
  assert.deepEqual(rows.slice(1).map(row => row[8]), ['Moradia', 'Moradia', 'Moradia']);
});

test('valida dados obrigatorios e rejeita valor zerado', () => {
  const app = loadBackend();

  assert.throws(() => app.apiAddTransaction({
    date: '2026-07-04',
    type: 'EXPENSE',
    description: 'Conta',
    amount: 0,
    recurrence: 1
  }), /valor maior que zero/);

  assert.throws(() => app.apiAddTransaction({
    date: '04\/07\/2026',
    type: 'EXPENSE',
    description: 'Conta',
    amount: 10,
    recurrence: 1
  }), /data válida/);
});

test('migra planilha antiga adicionando colunas novas sem perder dados', () => {
  const oldRows = [
    ['Id', 'Year', 'Month', 'Date', 'Type', 'Description', 'Amount', 'Status'],
    ['old-1', '2026', '07', '2026-07-10', 'EXPENSE', 'Internet', 120, 'PENDENTE']
  ];
  const app = loadBackend(oldRows);

  const summary = app.apiGetMonthlySummary('2026', '07');
  const sheet = app.spreadsheet.getSheetByName('Transactions');

  assert.deepEqual(sheet.rows[0], Array.from(app.TRANSACTION_HEADERS));
  assert.equal(sheet.rows[1][5], 'Internet');
  assert.equal(summary.transactions.length, 1);
  assert.equal(summary.transactions[0].category, 'Geral');
});

test('calcula totais previstos, realizados e pendentes do mes', () => {
  const rows = [
    ['Id', 'Year', 'Month', 'Date', 'Type', 'Description', 'Amount', 'Status', 'Category', 'CreatedAt', 'UpdatedAt', 'SettledAt'],
    ['1', '2026', '07', '2026-07-01', 'INCOME', 'Salario', 5000, 'PAGO', 'Salário', '', '', '2026-07-01'],
    ['2', '2026', '07', '2026-07-05', 'EXPENSE', 'Aluguel', 1800, 'PAGO', 'Moradia', '', '', '2026-07-05'],
    ['3', '2026', '07', '2026-07-12', 'EXPENSE', 'Cartao', 700, 'PENDENTE', 'Cartão', '', '', ''],
    ['4', '2026', '07', '2026-07-20', 'INCOME', 'Freela', 1000, 'PENDENTE', 'Geral', '', '', '']
  ];
  const app = loadBackend({
    transactions: rows,
    categories: [
      ['Categoria'],
      ['Cartão'],
      ['Geral'],
      ['Moradia'],
      ['Salário']
    ]
  });

  const summary = app.apiGetMonthlySummary('2026', '07');

  assert.equal(summary.totalIncome, 6000);
  assert.equal(summary.totalExpense, 2500);
  assert.equal(summary.totalPaidIncome, 5000);
  assert.equal(summary.totalPaidExpenses, 1800);
  assert.equal(summary.pendingIncome, 1000);
  assert.equal(summary.pendingExpenses, 700);
  assert.equal(summary.expectedBalance, 3500);
  assert.equal(summary.realizedBalance, 3200);
  assert.equal(summary.paidExpensePercent, 72);
  assert.deepEqual(Array.from(summary.categories), ['Cartão', 'Geral', 'Moradia', 'Salário']);
});

test('le categorias cadastradas na guia Categorias', () => {
  const app = loadBackend({
    categories: [
      ['Categoria'],
      ['Moradia'],
      ['Cartão'],
      ['Moradia'],
      ['']
    ]
  });

  assert.deepEqual(Array.from(app.apiGetCategories()), ['Cartão', 'Moradia']);
});

test('cria guia Categorias com valores padrao quando ela nao existe', () => {
  const app = loadBackend();

  const categories = Array.from(app.apiGetCategories());
  const sheet = app.spreadsheet.getSheetByName('Categorias');

  assert.ok(categories.includes('Geral'));
  assert.ok(categories.includes('Moradia'));
  assert.equal(sheet.rows[0][0], 'Categoria');
  assert.equal(sheet.rows[1][0], 'Geral');
});

test('cadastra categoria nova na guia Categorias ao adicionar registro', () => {
  const app = loadBackend({
    categories: [
      ['Categoria'],
      ['Geral']
    ]
  });

  app.apiAddTransaction({
    date: '2026-07-04',
    type: 'EXPENSE',
    description: 'Consulta',
    amount: 250,
    category: 'Pets',
    recurrence: 1
  });

  const categories = Array.from(app.apiGetCategories());
  const sheet = app.spreadsheet.getSheetByName('Categorias');
  assert.deepEqual(categories, ['Geral', 'Pets']);
  assert.equal(sheet.rows.filter(row => row[0] === 'Pets').length, 1);
});

test('cadastra categoria nova na guia Categorias ao editar registro', () => {
  const app = loadBackend({
    transactions: [
      ['Id', 'Year', 'Month', 'Date', 'Type', 'Description', 'Amount', 'Status', 'Category', 'CreatedAt', 'UpdatedAt', 'SettledAt'],
      ['1', '2026', '07', '2026-07-01', 'EXPENSE', 'Conta A', 100, 'PENDENTE', 'Geral', '', '', '']
    ],
    categories: [
      ['Categoria'],
      ['Geral']
    ]
  });

  app.apiUpdateTransaction({
    id: '1',
    date: '2026-07-01',
    type: 'EXPENSE',
    description: 'Conta A',
    amount: 100,
    status: 'PENDENTE',
    category: 'Viagem'
  });

  assert.deepEqual(Array.from(app.apiGetCategories()), ['Geral', 'Viagem']);
});

test('atualiza, alterna status, marca em lote e exclui registros', () => {
  const app = loadBackend([
    ['Id', 'Year', 'Month', 'Date', 'Type', 'Description', 'Amount', 'Status', 'Category', 'CreatedAt', 'UpdatedAt', 'SettledAt'],
    ['1', '2026', '07', '2026-07-01', 'EXPENSE', 'Conta A', 100, 'PENDENTE', 'Geral', '', '', ''],
    ['2', '2026', '07', '2026-07-02', 'EXPENSE', 'Conta B', 200, 'PENDENTE', 'Geral', '', '', '']
  ]);

  app.apiUpdateTransaction({
    id: '1',
    date: '2026-08-15',
    type: 'INCOME',
    description: 'Receita ajustada',
    amount: 350,
    status: 'PENDENTE',
    category: 'Freela'
  });
  let sheet = app.spreadsheet.getSheetByName('Transactions');
  assert.equal(sheet.rows[1][1], '2026');
  assert.equal(sheet.rows[1][2], '08');
  assert.equal(sheet.rows[1][4], 'INCOME');
  assert.equal(sheet.rows[1][8], 'Freela');

  const toggleResult = app.apiToggleTransactionStatus('2');
  assert.equal(toggleResult.success, true);
  assert.equal(toggleResult.newStatus, 'PAGO');
  assert.equal(sheet.rows[2][7], 'PAGO');
  assert.match(sheet.rows[2][11], /^\d{4}-\d{2}-\d{2}$/);

  const batchResult = app.apiSetTransactionsStatus(['1', '2'], 'PENDENTE');
  assert.equal(batchResult.success, true);
  assert.equal(batchResult.updatedCount, 2);
  assert.equal(sheet.rows[1][7], 'PENDENTE');
  assert.equal(sheet.rows[2][7], 'PENDENTE');
  assert.equal(sheet.rows[2][11], '');

  app.apiDeleteTransaction('2');
  sheet = app.spreadsheet.getSheetByName('Transactions');
  assert.equal(sheet.rows.length, 2);
  assert.equal(sheet.rows[1][0], '1');
});
