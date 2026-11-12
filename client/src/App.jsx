import { useState } from 'react';

const money = new Intl.NumberFormat('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = new Intl.NumberFormat('en-PK');
const signed = (n) => (n > 0 ? '+' : '') + money.format(n);
const tone = (n) => (n > 0 ? 'gain' : n < 0 ? 'loss' : undefined);

export default function App() {
  const [state, setState] = useState({ status: 'idle' });

  async function upload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setState({ status: 'loading' });
    try {
      // Content-Type is set explicitly: Windows often labels .csv as application/vnd.ms-excel.
      const res = await fetch('/api/portfolio', { method: 'POST', headers: { 'Content-Type': 'text/csv' }, body: file });
      const body = await res.json();
      setState(res.ok ? { status: 'done', data: body, name: file.name } : { status: 'error', errors: body.errors });
    } catch {
      setState({ status: 'error', errors: ['Could not reach the server. Is it running?'] });
    }
    e.target.value = ''; // allow re-uploading the same file
  }

  const { status, data, errors, name } = state;
  return (
    <main>
      <h1>PSX Portfolio</h1>
      <label className="upload">
        Upload trades.csv
        <input type="file" accept=".csv,text/csv" onChange={upload} />
      </label>
      {status === 'idle' && <p className="hint">Columns: date, symbol, side, quantity, price</p>}
      {status === 'loading' && <p className="hint">Calculating…</p>}
      {status === 'error' && (
        <ul className="errors" role="alert">
          {errors.map((msg) => <li key={msg}>{msg}</li>)}
        </ul>
      )}
      {status === 'done' && <Holdings data={data} name={name} />}
    </main>
  );
}

function Holdings({ data: { holdings, totals, feeRate }, name }) {
  return (
    <>
      <div className="scroll">
        <table>
          <caption>Current holdings from {name}. Amounts in PKR.</caption>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Quantity</th>
              <th>Avg cost</th>
              <th>Current price</th>
              <th>Cost basis</th>
              <th>Current value</th>
              <th>Unrealised P/L</th>
              <th>P/L %</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => (
              <tr key={h.symbol}>
                <th scope="row">{h.symbol}</th>
                <td>{qty.format(h.quantity)}</td>
                <td>{money.format(h.avgCost)}</td>
                <td>{money.format(h.currentPrice)}</td>
                <td>{money.format(h.costBasis)}</td>
                <td>{money.format(h.currentValue)}</td>
                <td className={tone(h.unrealisedPnl)}>{signed(h.unrealisedPnl)}</td>
                <td className={tone(h.unrealisedPnl)}>{signed(h.unrealisedPct)}%</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={4}>Total</th>
              <td>{money.format(totals.costBasis)}</td>
              <td>{money.format(totals.currentValue)}</td>
              <td className={tone(totals.unrealisedPnl)}>{signed(totals.unrealisedPnl)}</td>
              <td className={tone(totals.unrealisedPnl)}>{signed(totals.unrealisedPct)}%</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="hint">
        Average cost includes the {(feeRate * 100).toFixed(2)}% brokerage fee on buys. Realised P/L on closed
        quantities, net of fees: <span className={tone(totals.realisedPnl)}>{signed(totals.realisedPnl)}</span>.
        Total fees paid: {money.format(totals.feesPaid)}.
      </p>
    </>
  );
}
