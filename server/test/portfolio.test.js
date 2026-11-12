import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { CsvError, parsePrices, parseTrades } from '../src/csv.js';
import { TradeError, computePortfolio } from '../src/portfolio.js';

const t = (date, symbol, side, quantity, price) => ({ date, symbol, side, quantity, price });

test('buy fee is added to cost', () => {
  const { holdings } = computePortfolio([t('2026-01-01', 'A', 'BUY', 100, 100)], { A: 110 });
  // cost = 10,000 + 15 fee
  assert.deepEqual(holdings[0], {
    symbol: 'A', quantity: 100, avgCost: 100.15, currentPrice: 110,
    costBasis: 10015, currentValue: 11000, unrealisedPnl: 985, unrealisedPct: 9.84,
  });
});

test('sell keeps average cost and books realised P/L net of fee', () => {
  const { holdings, totals } = computePortfolio(
    [t('2026-01-01', 'A', 'BUY', 100, 100), t('2026-01-02', 'A', 'SELL', 40, 120)],
    { A: 110 }
  );
  assert.equal(holdings[0].quantity, 60);
  assert.equal(holdings[0].avgCost, 100.15);
  assert.equal(holdings[0].costBasis, 6009);
  // proceeds 4800 - 7.20 fee - 4006 cost
  assert.equal(totals.realisedPnl, 786.8);
  assert.equal(totals.feesPaid, 22.2);
});

test('average cost resets after a position is fully closed', () => {
  const { holdings } = computePortfolio(
    [t('2026-01-01', 'A', 'BUY', 10, 100), t('2026-01-02', 'A', 'SELL', 10, 90), t('2026-01-03', 'A', 'BUY', 10, 200)],
    { A: 200 }
  );
  assert.equal(holdings[0].avgCost, 200.3);
});

test('trades are processed in date order, not file order', () => {
  const { holdings } = computePortfolio(
    [t('2026-01-02', 'A', 'SELL', 5, 100), t('2026-01-01', 'A', 'BUY', 10, 100)],
    { A: 100 }
  );
  assert.equal(holdings[0].quantity, 5);
});

test('overselling and missing prices are rejected', () => {
  assert.throws(() => computePortfolio([t('2026-01-01', 'A', 'SELL', 1, 1)], { A: 1 }), TradeError);
  assert.throws(() => computePortfolio([t('2026-01-01', 'A', 'BUY', 1, 1)], {}), TradeError);
});

test('bad rows are reported with line numbers', () => {
  assert.throws(
    () => parseTrades('date,symbol,side,quantity,price\n2026-01-01,A,HOLD,-1,x\n'),
    (e) => e instanceof CsvError && e.errors.length === 3 && e.errors[0].startsWith('Line 2')
  );
});

test('sample files: totals match an independent calculation', () => {
  const file = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
  const result = computePortfolio(
    parseTrades(file('../../sample/trades.csv')),
    parsePrices(file('../data/current_prices.csv'))
  );
  assert.deepEqual(result.holdings.map((h) => [h.symbol, h.quantity]), [
    ['ENGRO', 850], ['FFC', 300], ['HBL', 100], ['LUCK', 50], ['MCB', 650], ['OGDC', 550], ['PSO', 1100], ['SYS', 650],
  ]);
  // Cross-checked with exact decimal arithmetic outside this codebase.
  assert.deepEqual(result.totals, {
    costBasis: 1562402.65, currentValue: 1574700, unrealisedPnl: 12297.35, unrealisedPct: 0.79,
    realisedPnl: -3454.86, feesPaid: 3325.51,
  });
});
