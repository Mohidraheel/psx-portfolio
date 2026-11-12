import { parse } from 'csv-parse/sync';

export class CsvError extends Error {
  constructor(errors) {
    super('Invalid CSV');
    this.errors = errors;
  }
}

const read = (text) =>
  parse(text, { columns: (h) => h.map((c) => c.trim().toLowerCase()), bom: true, trim: true, skip_empty_lines: true });

function requireColumns(rows, columns) {
  const missing = columns.filter((c) => !(c in (rows[0] ?? {})));
  if (rows.length === 0) throw new CsvError(['File has no data rows']);
  if (missing.length) throw new CsvError([`Missing column(s): ${missing.join(', ')}`]);
}

// Validate every row and report all problems at once, with line numbers.
export function parseTrades(text) {
  let rows;
  try {
    rows = read(text);
  } catch (e) {
    throw new CsvError([e.message]);
  }
  requireColumns(rows, ['date', 'symbol', 'side', 'quantity', 'price']);

  const errors = [];
  const trades = rows.map((r, i) => {
    const line = i + 2; // header is line 1
    const trade = {
      date: r.date,
      symbol: r.symbol.toUpperCase(),
      side: r.side.toUpperCase(),
      quantity: Number(r.quantity),
      price: Number(r.price),
    };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trade.date) || Number.isNaN(Date.parse(trade.date)))
      errors.push(`Line ${line}: date "${r.date}" must be YYYY-MM-DD`);
    if (!trade.symbol) errors.push(`Line ${line}: symbol is empty`);
    if (trade.side !== 'BUY' && trade.side !== 'SELL')
      errors.push(`Line ${line}: side "${r.side}" must be BUY or SELL`);
    if (!Number.isInteger(trade.quantity) || trade.quantity <= 0)
      errors.push(`Line ${line}: quantity "${r.quantity}" must be a positive whole number`);
    if (!(trade.price > 0)) errors.push(`Line ${line}: price "${r.price}" must be a positive number`);
    return trade;
  });
  if (errors.length) throw new CsvError(errors);
  return trades;
}

export function parsePrices(text) {
  const rows = read(text);
  requireColumns(rows, ['symbol', 'current_price']);
  return Object.fromEntries(rows.map((r) => [r.symbol.toUpperCase(), Number(r.current_price)]));
}
