/**
 * @fileoverview Backend controller, service, and repository for the Financial Predictability App.
 * Implements clean architecture principles, dependency separation, and status mutation.
 */

const SHEET_NAME = 'Transactions';

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
      sheet.appendRow(['Id', 'Year', 'Month', 'Date', 'Type', 'Description', 'Amount', 'Status']);
      sheet.getRange('1:1').setFontWeight('bold');
    }
    return sheet;
  },

  /**
   * Persists a new transaction entity to the database.
   * @param {Object} transaction - The transaction data payload.
   */
  save: function(transaction) {
    const sheet = this.getSheet();
    const id = Utilities.getUuid();
    sheet.appendRow([
      id,
      transaction.year,
      transaction.month,
      transaction.date,
      transaction.type,
      transaction.description,
      transaction.amount,
      'PENDENTE'
    ]);
  },

  /**
   * Updates an existing transaction in the database.
   * @param {string} id - The transaction UUID.
   * @param {Object} transaction - The updated transaction data.
   */
  update: function(id, transaction) {
    const sheet = this.getSheet();
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        const rowIndex = i + 1;
        sheet.getRange(rowIndex, 2, 1, 7).setValues([[
          transaction.year,
          transaction.month,
          transaction.date,
          transaction.type, 
          transaction.description, 
          transaction.amount,
          transaction.status
        ]]);
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
    const data = sheet.getDataRange().getValues();
    let newStatus = 'PENDENTE';
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        const rowIndex = i + 1;
        const currentStatus = data[i][7] || 'PENDENTE';
        newStatus = currentStatus === 'PAGO' ? 'PENDENTE' : 'PAGO';
        sheet.getRange(rowIndex, 8).setValue(newStatus);
        break;
      }
    }
    return newStatus;
  },

  /**
   * Deletes a transaction from the database.
   * @param {string} id - The transaction UUID.
   */
  delete: function(id) {
    const sheet = this.getSheet();
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        sheet.deleteRow(i + 1);
        break;
      }
    }
  }
};

/**
 * Service Layer: Encapsulates business logic, including date parsing, recurrence, and aggregation.
 */
const TransactionService = {
  /**
   * Validates and routes a new transaction (or multiple, if recurring) to the repository.
   * @param {Object} data - Raw transaction data from the frontend.
   * @returns {Object} A standardized success response.
   */
  addTransaction: function(data) {
    const recurrenceCount = parseInt(data.recurrence, 10) || 1;
    
    const [yyyy, mm, dd] = data.date.split('-');
    const baseYear = parseInt(yyyy, 10);
    const baseMonth = parseInt(mm, 10) - 1; 
    const day = parseInt(dd, 10);

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
        type: data.type,
        description: data.description,
        amount: data.amount
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
    const [yyyy, mm] = data.date.split('-');
    data.year = yyyy;
    data.month = mm;
    
    TransactionRepository.update(data.id, data);
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

  /**
   * Aggregates transactions to compute monthly predictability metrics.
   * Normalizes values and sorts the result chronologically in ascending order.
   * @param {string} year - Target year.
   * @param {string} month - Target month.
   * @returns {Object} Summary payload containing transactions and calculated totals.
   */
  getMonthlySummary: function(year, month) {
    const sheet = TransactionRepository.getSheet();
    const data = sheet.getDataRange().getValues();
    
    let transactions = [];
    if (data.length > 1) {
      const paddedMonth = String(month).padStart(2, '0');
      const targetYear = String(year);
      
      transactions = data.slice(1)
        .map(row => {
          const normalizedDate = DateUtils.formatSheetDate(row[3]);
          return {
            id: row[0],
            year: String(row[1]),
            month: String(row[2]).padStart(2, '0'),
            date: normalizedDate, 
            type: row[4],
            description: row[5],
            amount: Number(row[6]),
            status: row[7] || 'PENDENTE'
          };
        })
        .filter(item => item.year === targetYear && item.month === paddedMonth);
    }

    transactions.sort((a, b) => a.date.localeCompare(b.date));

    let totalIncome = 0;
    let totalExpense = 0;
    let totalPaidExpenses = 0;

    transactions.forEach(t => {
      if (t.type === 'INCOME') totalIncome += t.amount;
      if (t.type === 'EXPENSE') {
        totalExpense += t.amount;
        if (t.status === 'PAGO') {
          totalPaidExpenses += t.amount;
        }
      }
    });

    return {
      transactions: transactions,
      totalIncome: totalIncome,
      totalExpense: totalExpense,
      totalPaidExpenses: totalPaidExpenses,
      expectedBalance: totalIncome - totalExpense
    };
  }
};

/* --- Proxy Endpoints for Google Client-Side API --- */

function apiAddTransaction(data) { return TransactionService.addTransaction(data); }
function apiUpdateTransaction(data) { return TransactionService.updateTransaction(data); }
function apiToggleTransactionStatus(id) { return TransactionService.toggleTransactionStatus(id); }
function apiDeleteTransaction(id) { return TransactionService.deleteTransaction(id); }
function apiGetMonthlySummary(year, month) { return TransactionService.getMonthlySummary(year, month); }