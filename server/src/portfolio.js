// Pure portfolio maths. No I/O, no Express: easy to test and to reuse.

export const FEE_RATE = 0.0015; // 0.15% of trade value, charged on every trade

export class TradeError extends Error {}

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Weighted average cost method.
 *  BUY : cost basis grows by trade value + fee.
 *  SELL: cost basis shrinks proportionally (average cost per share is unchanged);
 *        proceeds net of fee, minus the cost removed, is realised P/L.
 *
 * @param trades [{date, symbol, side, quantity, price}]
 * @param prices {SYMBOL: currentPrice}
 */
export function computePortfolio(trades, prices, feeRate = FEE_RATE) {
  // Process chronologically; keep file order for trades on the same day.
  const ordered = trades
    .map((t, i) => ({ ...t, i }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.i - b.i);

  const positions = new Map();
  for (const t of ordered) {
    const p = positions.get(t.symbol) ?? { quantity: 0, cost: 0, realised: 0, fees: 0 };
    positions.set(t.symbol, p);

    const value = t.quantity * t.price;
    const fee = value * feeRate;
    p.fees += fee;

    if (t.side === 'BUY') {
      p.quantity += t.quantity;
      p.cost += value + fee;
    } else {
      if (t.quantity > p.quantity) {
        throw new TradeError(
          `${t.date}: cannot sell ${t.quantity} ${t.symbol}, only ${p.quantity} held`
        );
      }
      const costRemoved = p.cost * (t.quantity / p.quantity);
      p.realised += value - fee - costRemoved;
      p.quantity -= t.quantity;
      // Fully closed: reset so float residue never leaks into a later re-entry.
      p.cost = p.quantity === 0 ? 0 : p.cost - costRemoved;
    }
  }

  const holdings = [];
  const totals = { cost: 0, value: 0, realised: 0, fees: 0 };
  for (const [symbol, p] of [...positions].sort(([a], [b]) => a.localeCompare(b))) {
    totals.realised += p.realised;
    totals.fees += p.fees;
    if (p.quantity === 0) continue;

    const price = prices[symbol];
    if (price === undefined) throw new TradeError(`No current price for ${symbol}`);

    const value = p.quantity * price;
    totals.cost += p.cost;
    totals.value += value;
    holdings.push({
      symbol,
      quantity: p.quantity,
      avgCost: round2(p.cost / p.quantity),
      currentPrice: price,
      costBasis: round2(p.cost),
      currentValue: round2(value),
      unrealisedPnl: round2(value - p.cost),
      unrealisedPct: round2(((value - p.cost) / p.cost) * 100),
    });
  }

  // Totals are summed from unrounded figures, then rounded once.
  const unrealised = totals.value - totals.cost;
  return {
    feeRate,
    holdings,
    totals: {
      costBasis: round2(totals.cost),
      currentValue: round2(totals.value),
      unrealisedPnl: round2(unrealised),
      unrealisedPct: totals.cost ? round2((unrealised / totals.cost) * 100) : 0,
      realisedPnl: round2(totals.realised),
      feesPaid: round2(totals.fees),
    },
  };
}
