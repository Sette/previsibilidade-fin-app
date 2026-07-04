const { createServer } = require('node:http');
const { randomUUID } = require('node:crypto');
const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const vm = require('node:vm');

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || 3000);
const DATA_FILE = 'dev-data.json';
const CSV_FILE = 'dados.csv';
const TRANSACTION_HEADERS = [
  'Id',
  'Year',
  'Month',
  'Date',
  'Type',
  'Description',
  'Amount',
  'Status',
  'Category',
  'CreatedAt',
  'UpdatedAt',
  'SettledAt'
];
const DEFAULT_CATEGORIES = [
  'Geral',
  'Salário',
  'Moradia',
  'Alimentação',
  'Transporte',
  'Saúde',
  'Educação',
  'Cartão',
  'Lazer',
  'Investimentos',
  'Impostos'
];

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
  constructor(sheets) {
    this.sheets = {};
    Object.keys(sheets || {}).forEach(name => {
      this.sheets[name] = new FakeSheet(sheets[name]);
    });
  }

  getSheetByName(name) {
    return this.sheets[name] || null;
  }

  insertSheet(name) {
    this.sheets[name] = new FakeSheet();
    return this.sheets[name];
  }

  toJSON() {
    return Object.keys(this.sheets).reduce((data, name) => {
      data[name] = this.sheets[name].rows;
      return data;
    }, {});
  }
}

function parseCsvLine(line) {
  const cells = [];
  let value = '';
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (ch === ',' && !quoted) {
      cells.push(value);
      value = '';
    } else {
      value += ch;
    }
  }

  cells.push(value);
  return cells;
}

function loadInitialSheets() {
  if (existsSync(DATA_FILE)) {
    return JSON.parse(readFileSync(DATA_FILE, 'utf8')).sheets || {};
  }

  if (!existsSync(CSV_FILE)) {
    return {};
  }

  const rows = readFileSync(CSV_FILE, 'utf8')
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map(parseCsvLine);

  if (rows.length === 0) return {};

  const header = rows[0];
  const transactions = header.join(',') === TRANSACTION_HEADERS.join(',')
    ? rows
    : [TRANSACTION_HEADERS].concat(rows.slice(1).map(row => row.slice(0, TRANSACTION_HEADERS.length)));

  const categorySet = new Set(DEFAULT_CATEGORIES);
  transactions.slice(1).forEach(row => {
    if (row[8]) categorySet.add(row[8]);
  });

  return {
    Transactions: transactions,
    Categorias: [['Categoria']].concat(Array.from(categorySet).sort((a, b) => a.localeCompare(b, 'pt-BR')).map(category => [category]))
  };
}

function saveSpreadsheet(spreadsheet) {
  writeFileSync(DATA_FILE, JSON.stringify({ sheets: spreadsheet.toJSON() }, null, 2), 'utf8');
}

function loadAppsScript(spreadsheet) {
  const code = readFileSync('Codigo.gs', 'utf8');
  const context = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => spreadsheet
    },
    Utilities: {
      getUuid: () => randomUUID()
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
      apiAddTransaction,
      apiUpdateTransaction,
      apiToggleTransactionStatus,
      apiSetTransactionsStatus,
      apiDeleteTransaction,
      apiGetMonthlySummary,
      apiGetCategories
    };
  `, context);
  return context.__app;
}

function injectDevRuntime(html) {
  const script = `
    <script>
      (function() {
        function createRunner(successHandler, failureHandler) {
          return new Proxy({}, {
            get: function(_, prop) {
              if (prop === 'withSuccessHandler') {
                return function(handler) { return createRunner(handler, failureHandler); };
              }
              if (prop === 'withFailureHandler') {
                return function(handler) { return createRunner(successHandler, handler); };
              }
              return function() {
                var args = Array.prototype.slice.call(arguments);
                fetch('/api/' + prop, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ args: args })
                })
                  .then(function(response) {
                    return response.json().then(function(payload) {
                      if (!response.ok) throw new Error(payload.error || 'Erro local');
                      return payload.result;
                    });
                  })
                  .then(function(result) {
                    if (successHandler) successHandler(result);
                  })
                  .catch(function(error) {
                    if (failureHandler) failureHandler(error);
                    else console.error(error);
                  });
              };
            }
          });
        }
        window.google = { script: { run: createRunner(null, null) } };
      }());
    </script>
  `;

  return html.replace('</head>', `${script}\n</head>`);
}

function send(res, statusCode, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(statusCode, { 'Content-Type': contentType });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error('Payload muito grande.'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const spreadsheet = new FakeSpreadsheet(loadInitialSheets());
const app = loadAppsScript(spreadsheet);

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/Index.html')) {
    const html = injectDevRuntime(readFileSync('Index.html', 'utf8'));
    send(res, 200, html, 'text/html; charset=utf-8');
    return;
  }

  if (req.method === 'GET' && url.pathname === '/dev-data.json') {
    send(res, 200, JSON.stringify({ sheets: spreadsheet.toJSON() }, null, 2), 'application/json; charset=utf-8');
    return;
  }

  if (req.method === 'POST' && url.pathname.startsWith('/api/')) {
    const method = decodeURIComponent(url.pathname.slice('/api/'.length));
    if (!Object.prototype.hasOwnProperty.call(app, method)) {
      send(res, 404, JSON.stringify({ error: `Método local não encontrado: ${method}` }), 'application/json; charset=utf-8');
      return;
    }

    try {
      const payload = await readJsonBody(req);
      const result = app[method].apply(null, payload.args || []);
      saveSpreadsheet(spreadsheet);
      send(res, 200, JSON.stringify({ result: result }), 'application/json; charset=utf-8');
    } catch (err) {
      send(res, 500, JSON.stringify({ error: err.message || String(err) }), 'application/json; charset=utf-8');
    }
    return;
  }

  send(res, 404, 'Não encontrado');
});

server.listen(PORT, HOST, () => {
  console.log(`Servidor local em http://${HOST}:${PORT}`);
  console.log(`Dados locais em ${DATA_FILE}`);
});
