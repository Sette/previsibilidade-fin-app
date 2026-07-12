# Repository Guidelines

## Project Structure

This repository contains a Google Apps Script web app for monthly financial predictability.

- `Codigo.gs`: Apps Script backend. It serves the HTML, manages the `Transactions` sheet, and exposes `api*` functions for the client.
- `Index.html`: Single-page UI, inline styles, and client-side JavaScript that calls `google.script.run`.

The app stores data in a spreadsheet sheet named `Transactions` with these columns:

`Id`, `Year`, `Month`, `Date`, `Type`, `Description`, `Amount`, `Status`

## Development Notes

- Keep backend changes compatible with Google Apps Script V8 runtime.
- Do not introduce browser APIs or dependencies that require a bundler; `Index.html` is served directly by Apps Script.
- Preserve the `api*` function names unless you also update all matching `google.script.run` calls.
- Dates are stored and exchanged as `YYYY-MM-DD` strings where possible. Avoid parsing them in a way that shifts dates across time zones.
- Transaction `type` values are `INCOME` and `EXPENSE`; status values are `PAGO` and `PENDENTE`.
- UI text is in Brazilian Portuguese (`pt-BR`). Keep new user-facing copy consistent with that language.

## Validation

There is no automated test runner configured in this repository.

For meaningful manual validation after changes:

- Open the Apps Script project bound to the spreadsheet.
- Deploy or run the web app via `doGet`.
- Add, edit, delete, and toggle status for both income and expense transactions.
- Verify monthly filters, projected balance, paid expense total, and selected expense total.

## Git Hygiene

- Keep edits scoped to `Codigo.gs`, `Index.html`, or documentation unless new project tooling is intentionally being added.
- Do not commit generated Apps Script deployment artifacts or local editor metadata.
