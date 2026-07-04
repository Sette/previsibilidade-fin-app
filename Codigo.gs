/**
 * @fileoverview Backend controller, service, and repository for the Financial Predictability App.
 * Implements clean architecture principles, dependency separation, and status mutation.
 */

const SHEET_NAME = 'Transactions';
const CATEGORY_SHEET_NAME = 'Categorias';
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

const HEADER_FIELD_MAP = {
  Id: 'id',
  Year: 'year',
  Month: 'month',
  Date: 'date',
  Type: 'type',
  Description: 'description',
  Amount: 'amount',
  Status: 'status',
  Category: 'category',
  CreatedAt: 'createdAt',
  UpdatedAt: 'updatedAt',
  SettledAt: 'settledAt'
};

const DEFAULT_CATEGORY = 'Geral';
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

/**
 * Controller: Serves the main HTML page.
 * @returns {GoogleAppsScript.HTML.HtmlOutput} The evaluated HTML content.
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('Previsibilidade Financeira Mensal')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Utility: Helper functions for data formatting and type conversion.
 */
const DateUtils = {
  /**
   * Converts a sheet date cell (Date object or string) into a standardized YYYY-MM-DD string.
   * @param {Date|string} dateVal - The raw value from the spreadsheet cell.
   * @returns {string} The formatted date string.
   */
  formatSheetDate: function(dateVal) {
    if (dateVal instanceof Date) {
      const yyyy = dateVal.getFullYear();
      const mm = String(dateVal.getMonth() + 1).padStart(2, '0');
      const dd = String(dateVal.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    return String(dateVal);
  },

  todayDateString: function() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  },

  nowIsoString: function() {
    return new Date().toISOString();
  }
};

/**
 * Repository Layer: Handles all direct interactions with the Google Spreadsheet.
 */
const TransactionRepository = {
  /**
   * Retrieves or creates the main database sheet.
   * @returns {GoogleAppsScript.Spreadsheet.Sheet} The sheet object.
   */
  getSheet: function() {
    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(SHEET_NAME);
    }
    this.ensureSchema(sheet);
    return sheet;
  },

  ensureSchema: function(sheet) {
    const lastColumn = sheet.getLastColumn();
    if (lastColumn === 0) {
      sheet.getRange(1, 1, 1, TRANSACTION_HEADERS.length).setValues([TRANSACTION_HEADERS]);
      sheet.getRange('1:1').setFontWeight('bold');
      return;
    }

    const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(String);
    const missingHeaders = TRANSACTION_HEADERS.filter(header => headers.indexOf(header) === -1);
    if (missingHeaders.length > 0) {
      sheet.getRange(1, lastColumn + 1, 1, missingHeaders.length).setValues([missingHeaders]);
    }
    sheet.getRange('1:1').setFontWeight('bold');
  },

  getHeaderMap: function(sheet) {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
    return headers.reduce((map, header, index) => {
      map[header] = index;
      return map;
    }, {});
  },

  rowToTransaction: function(row, headerMap) {
    return TRANSACTION_HEADERS.reduce((transaction, header) => {
      const field = HEADER_FIELD_MAP[header];
      const index = headerMap[header];
      transaction[field] = index === undefined ? '' : row[index];
      return transaction;
    }, {});
  },

  buildRow: function(transaction) {
    return TRANSACTION_HEADERS.map(header => {
      const field = HEADER_FIELD_MAP[header];
      if (field === 'amount') return Number(transaction[field]) || 0;
      return transaction[field] || '';
    });
  },

  /**
   * Persists a new transaction entity to the database.
   * @param {Object} transaction - The transaction data payload.
   */
  save: function(transaction) {
    const sheet = this.getSheet();
    const id = Utilities.getUuid();
    sheet.appendRow(this.buildRow(Object.assign({}, transaction, { id: id })));
  },

  /**
   * Updates an existing transaction in the database.
   * @param {string} id - The transaction UUID.
   * @param {Object} transaction - The updated transaction data.
   */
  update: function(id, transaction) {
    const sheet = this.getSheet();
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][headerMap.Id] === id) {
        const rowIndex = i + 1;
        const existing = this.rowToTransaction(data[i], headerMap);
        const updated = Object.assign({}, existing, transaction, { id: id });
        sheet.getRange(rowIndex, 1, 1, TRANSACTION_HEADERS.length).setValues([this.buildRow(updated)]);
        break;
      }
    }
  },

  /**
   * Toggles the payment status of a transaction between PAGO and PENDENTE.
   * @param {string} id - The transaction UUID.
   * @returns {string} The new status applied.
   */
  toggleStatus: function(id) {
    const sheet = this.getSheet();
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getDataRange().getValues();
    let newStatus = 'PENDENTE';
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][headerMap.Id] === id) {
        const rowIndex = i + 1;
        const currentStatus = data[i][headerMap.Status] || 'PENDENTE';
        newStatus = currentStatus === 'PAGO' ? 'PENDENTE' : 'PAGO';
        const transaction = this.rowToTransaction(data[i], headerMap);
        transaction.status = newStatus;
        transaction.updatedAt = DateUtils.nowIsoString();
        transaction.settledAt = newStatus === 'PAGO' ? DateUtils.todayDateString() : '';
        sheet.getRange(rowIndex, 1, 1, TRANSACTION_HEADERS.length).setValues([this.buildRow(transaction)]);
        break;
      }
    }
    return newStatus;
  },

  setStatusForIds: function(ids, status) {
    const sheet = this.getSheet();
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getDataRange().getValues();
    const idLookup = ids.reduce((lookup, id) => {
      lookup[id] = true;
      return lookup;
    }, {});
    let updatedCount = 0;

    for (let i = 1; i < data.length; i++) {
      const id = data[i][headerMap.Id];
      if (idLookup[id]) {
        const transaction = this.rowToTransaction(data[i], headerMap);
        transaction.status = status;
        transaction.updatedAt = DateUtils.nowIsoString();
        transaction.settledAt = status === 'PAGO' ? DateUtils.todayDateString() : '';
        sheet.getRange(i + 1, 1, 1, TRANSACTION_HEADERS.length).setValues([this.buildRow(transaction)]);
        updatedCount++;
      }
    }

    return updatedCount;
  },

  /**
   * Deletes a transaction from the database.
   * @param {string} id - The transaction UUID.
   */
  delete: function(id) {
    const sheet = this.getSheet();
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][headerMap.Id] === id) {
        sheet.deleteRow(i + 1);
        break;
      }
    }
  }
};

const CategoryRepository = {
  getSheet: function() {
    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CATEGORY_SHEET_NAME);
    if (!sheet) {
      sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(CATEGORY_SHEET_NAME);
      this.seedSheet(sheet);
      return sheet;
    }

    if (sheet.getLastColumn() === 0) {
      this.seedSheet(sheet);
    }
    return sheet;
  },

  seedSheet: function(sheet) {
    const rows = [['Categoria']].concat(DEFAULT_CATEGORIES.map(category => [category]));
    sheet.getRange(1, 1, rows.length, 1).setValues(rows);
    sheet.getRange('1:1').setFontWeight('bold');
  },

  getAll: function() {
    const sheet = this.getSheet();
    const data = sheet.getDataRange().getValues();
    const categories = [];
    const seen = {};

    data.forEach((row, index) => {
      const category = String(row[0] || '').trim();
      const normalized = category.toLowerCase();
      if (!category) return;
      if (index === 0 && (normalized === 'categoria' || normalized === 'category')) return;
      if (seen[normalized]) return;
      seen[normalized] = true;
      categories.push(category);
    });

    if (categories.length === 0) {
      return DEFAULT_CATEGORIES.slice();
    }

    return categories.sort((a, b) => a.localeCompare(b, 'pt-BR'));
  },

  ensureExists: function(category) {
    const normalizedCategory = String(category || '').trim();
    if (!normalizedCategory) return;

    const sheet = this.getSheet();
    const data = sheet.getDataRange().getValues();
    const exists = data.some((row, index) => {
      const existingCategory = String(row[0] || '').trim();
      if (!existingCategory) return false;
      if (index === 0 && existingCategory.toLowerCase() === 'categoria') return false;
      return existingCategory.toLowerCase() === normalizedCategory.toLowerCase();
    });

    if (!exists) {
      sheet.appendRow([normalizedCategory]);
    }
  }
};

/**
 * Service Layer: Encapsulates business logic, including date parsing, recurrence, and aggregation.
 */
const TransactionService = {
  normalizeTransactionInput: function(data) {
    const date = String(data.date || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error('Informe uma data válida.');
    }

    const type = String(data.type || '').trim();
    if (type !== 'INCOME' && type !== 'EXPENSE') {
      throw new Error('Informe um tipo válido.');
    }

    const description = String(data.description || '').trim();
    if (!description) {
      throw new Error('Informe uma descrição.');
    }

    const amount = Number(data.amount);
    if (!isFinite(amount) || amount <= 0) {
      throw new Error('Informe um valor maior que zero.');
    }

    const status = data.status === 'PAGO' ? 'PAGO' : 'PENDENTE';
    const category = String(data.category || DEFAULT_CATEGORY).trim() || DEFAULT_CATEGORY;

    return {
      date: date,
      type: type,
      description: description,
      amount: amount,
      status: status,
      category: category
    };
  },

  /**
   * Validates and routes a new transaction (or multiple, if recurring) to the repository.
   * @param {Object} data - Raw transaction data from the frontend.
   * @returns {Object} A standardized success response.
   */
  addTransaction: function(data) {
    const recurrenceCount = parseInt(data.recurrence, 10) || 1;
    if (recurrenceCount < 1 || recurrenceCount > 120) {
      throw new Error('A repetição deve ficar entre 1 e 120 meses.');
    }
    const normalized = this.normalizeTransactionInput(data);
    CategoryRepository.ensureExists(normalized.category);
    
    const [yyyy, mm, dd] = normalized.date.split('-');
    const baseYear = parseInt(yyyy, 10);
    const baseMonth = parseInt(mm, 10) - 1; 
    const day = parseInt(dd, 10);
    const nowIso = DateUtils.nowIsoString();

    for (let i = 0; i < recurrenceCount; i++) {
      let currentD = new Date(baseYear, baseMonth + i, day);
      
      if (currentD.getDate() !== day) {
        currentD.setDate(0); 
      }
      
      let tYear = String(currentD.getFullYear());
      let tMonth = String(currentD.getMonth() + 1).padStart(2, '0');
      let tDateStr = `${tYear}-${tMonth}-${String(currentD.getDate()).padStart(2, '0')}`;

      const transactionPayload = {
        date: tDateStr,
        year: tYear,
        month: tMonth,
        type: normalized.type,
        description: normalized.description,
        amount: normalized.amount,
        status: 'PENDENTE',
        category: normalized.category,
        createdAt: nowIso,
        updatedAt: nowIso,
        settledAt: ''
      };

      TransactionRepository.save(transactionPayload);
    }

    return { success: true };
  },

  /**
   * Updates an existing transaction. Extract year and month from the new date.
   * @param {Object} data - The updated transaction data containing the ID.
   * @returns {Object} A standardized success response.
   */
  updateTransaction: function(data) {
    const normalized = this.normalizeTransactionInput(data);
    CategoryRepository.ensureExists(normalized.category);
    const [yyyy, mm] = normalized.date.split('-');
    const transaction = Object.assign({}, normalized, {
      year: yyyy,
      month: mm,
      updatedAt: DateUtils.nowIsoString()
    });
    
    TransactionRepository.update(data.id, transaction);
    return { success: true };
  },

  /**
   * Toggles the transaction status.
   * @param {string} id - The transaction ID.
   * @returns {Object} Operation result with the new status.
   */
  toggleTransactionStatus: function(id) {
    const newStatus = TransactionRepository.toggleStatus(id);
    return { success: true, newStatus: newStatus };
  },

  /**
   * Deletes a transaction.
   * @param {string} id - The transaction ID to delete.
   * @returns {Object} A standardized success response.
   */
  deleteTransaction: function(id) {
    TransactionRepository.delete(id);
    return { success: true };
  },

  setTransactionsStatus: function(ids, status) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error('Selecione pelo menos um registro.');
    }
    const normalizedStatus = status === 'PAGO' ? 'PAGO' : 'PENDENTE';
    const updatedCount = TransactionRepository.setStatusForIds(ids, normalizedStatus);
    return { success: true, updatedCount: updatedCount };
  },

  /**
   * Aggregates transactions to compute monthly predictability metrics.
   * Normalizes values and sorts the result chronologically in ascending order.
   * @param {string} year - Target year.
   * @param {string} month - Target month.
   * @returns {Object} Summary payload containing transactions and calculated totals.
   */
  getMonthlySummary: function(year, month) {
    const sheet = TransactionRepository.getSheet();
    const headerMap = TransactionRepository.getHeaderMap(sheet);
    const data = sheet.getDataRange().getValues();
    const registeredCategories = CategoryRepository.getAll();
    
    let transactions = [];
    if (data.length > 1) {
      const paddedMonth = String(month).padStart(2, '0');
      const targetYear = String(year);
      
      transactions = data.slice(1)
        .map(row => {
          const item = TransactionRepository.rowToTransaction(row, headerMap);
          const normalizedDate = DateUtils.formatSheetDate(item.date);
          return {
            id: item.id,
            year: String(item.year),
            month: String(item.month).padStart(2, '0'),
            date: normalizedDate, 
            type: item.type,
            description: item.description,
            amount: Number(item.amount),
            status: item.status || 'PENDENTE',
            category: item.category || DEFAULT_CATEGORY,
            settledAt: DateUtils.formatSheetDate(item.settledAt || '')
          };
        })
        .filter(item => item.year === targetYear && item.month === paddedMonth);
    }

    transactions.sort((a, b) => a.date.localeCompare(b.date));

    let totalIncome = 0;
    let totalExpense = 0;
    let totalPaidIncome = 0;
    let totalPaidExpenses = 0;
    const categorySummaryMap = {};

    transactions.forEach(t => {
      const category = t.category || DEFAULT_CATEGORY;
      if (!categorySummaryMap[category]) {
        categorySummaryMap[category] = {
          category: category,
          totalIncome: 0,
          totalExpense: 0,
          totalPaidIncome: 0,
          totalPaidExpenses: 0,
          transactionCount: 0
        };
      }
      categorySummaryMap[category].transactionCount++;

      if (t.type === 'INCOME') {
        totalIncome += t.amount;
        categorySummaryMap[category].totalIncome += t.amount;
        if (t.status === 'PAGO') {
          totalPaidIncome += t.amount;
          categorySummaryMap[category].totalPaidIncome += t.amount;
        }
      }
      if (t.type === 'EXPENSE') {
        totalExpense += t.amount;
        categorySummaryMap[category].totalExpense += t.amount;
        if (t.status === 'PAGO') {
          totalPaidExpenses += t.amount;
          categorySummaryMap[category].totalPaidExpenses += t.amount;
        }
      }
    });

    const categorySummaries = Object.keys(categorySummaryMap)
      .map(category => {
        const item = categorySummaryMap[category];
        item.pendingIncome = item.totalIncome - item.totalPaidIncome;
        item.pendingExpenses = item.totalExpense - item.totalPaidExpenses;
        item.expectedBalance = item.totalIncome - item.totalExpense;
        item.realizedBalance = item.totalPaidIncome - item.totalPaidExpenses;
        item.paidExpensePercent = item.totalExpense > 0 ? (item.totalPaidExpenses / item.totalExpense) * 100 : 0;
        return item;
      })
      .sort((a, b) => {
        const amountDiff = b.totalExpense - a.totalExpense;
        if (amountDiff !== 0) return amountDiff;
        return a.category.localeCompare(b.category, 'pt-BR');
      });

    return {
      transactions: transactions,
      totalIncome: totalIncome,
      totalExpense: totalExpense,
      totalPaidIncome: totalPaidIncome,
      totalPaidExpenses: totalPaidExpenses,
      pendingIncome: totalIncome - totalPaidIncome,
      pendingExpenses: totalExpense - totalPaidExpenses,
      expectedBalance: totalIncome - totalExpense,
      realizedBalance: totalPaidIncome - totalPaidExpenses,
      paidExpensePercent: totalExpense > 0 ? (totalPaidExpenses / totalExpense) * 100 : 0,
      categories: registeredCategories,
      categorySummaries: categorySummaries
    };
  }
};

/* --- Proxy Endpoints for Google Client-Side API --- */

function apiAddTransaction(data) { return TransactionService.addTransaction(data); }
function apiUpdateTransaction(data) { return TransactionService.updateTransaction(data); }
function apiToggleTransactionStatus(id) { return TransactionService.toggleTransactionStatus(id); }
function apiSetTransactionsStatus(ids, status) { return TransactionService.setTransactionsStatus(ids, status); }
function apiDeleteTransaction(id) { return TransactionService.deleteTransaction(id); }
function apiGetMonthlySummary(year, month) { return TransactionService.getMonthlySummary(year, month); }
function apiGetCategories() { return CategoryRepository.getAll(); }
