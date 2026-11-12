# PSX Portfolio

Upload a `trades.csv`, get current holdings with average cost, current value and unrealised P/L, with a 0.15% brokerage fee on every trade included in the cost.

## Run

Needs Node 20+.

```
npm install
npm start          # builds the UI and serves everything on http://localhost:3001
```

Then upload `sample/trades.csv`.

For development, run `npm run dev:server` and `npm run dev:client` in two terminals (Vite on :5173 proxies `/api` to :3001). `npm test` runs the calculation tests.

## Design

```
React (Vite)  --POST /api/portfolio, body = raw CSV-->  Express
                                                          csv.js        parse + validate rows
                                                          portfolio.js  pure calculation
              <--JSON {holdings, totals}--------------    data/current_prices.csv
```

- **All money logic lives on the server, in one pure function** (`server/src/portfolio.js`). It takes trades and prices and returns numbers. No Express, no file access. That makes it trivial to unit test, and the React side only formats what it receives, so there is exactly one place where a number can be wrong.
- **Prices stay on the server** in `server/data/current_prices.csv`, read on each request. The user uploads only trades. Swapping the file for a live price feed later changes one line in `index.js` and nothing else.
- **Stateless, no database.** The task is upload then view. Nothing needs to persist, so every request is self-contained.
- **The CSV is sent as the raw request body** (`Content-Type: text/csv`), not as a multipart form. A single small file does not need multipart, which removes a dependency (multer) and a layer of parsing.

## Calculation

Method: **weighted average cost**, the usual convention for equity holdings and the natural reading of "average cost".

| Event | Effect |
|---|---|
| BUY | cost basis += quantity × price × 1.0015 |
| SELL | cost basis reduced in proportion to shares sold (average cost per share unchanged). Realised P/L = proceeds × 0.9985 − cost removed |
| Position sold to zero | cost basis resets, so a later re-entry starts a fresh average (HBL in the sample) |

Per holding:

- average cost = cost basis / quantity
- current value = quantity × current price
- unrealised P/L = current value − cost basis, and % = that / cost basis

Decisions worth flagging:

1. **Sell fees go to realised P/L, not to the remaining shares.** A fee paid to sell 100 shares is a cost of that sale. Loading it onto the shares still held would distort their average cost. So the holdings table reflects buy fees, and sell fees show up in the realised P/L line under the table.
2. **Unrealised P/L does not subtract the future fee for selling.** It is a mark-to-market figure against cost. An "if liquidated today" figure would be 0.15% of current value lower. Easy to add, but it is a different number and should be labelled as such.
3. **Trades are sorted by date** before processing (file order kept within a day), so an unsorted file still gives the right answer.
4. **Bad input is rejected, not guessed at.** Malformed rows are all reported with line numbers. Selling more than is held, or holding a symbol with no current price, returns an error instead of a silently wrong table.
5. **Precision.** Calculations use JS doubles and round to 2 decimals only at output. Totals are summed from unrounded values and rounded once. At these magnitudes the float error is around 1e-9 PKR. The sample result is asserted in the tests against a separate calculation done with exact decimals. For a real ledger I would switch to a decimal library or integer minor units.

## Tools

| Choice | Why | Instead of |
|---|---|---|
| Express | Smallest well-known way to expose one endpoint and serve static files | NestJS/Fastify: more structure than one route needs |
| csv-parse | Handles BOM, CRLF and quoted fields that Excel-saved CSVs contain | Hand-rolled `split(',')`: breaks on exactly those cases |
| Vite + React, plain CSS | Fast setup, one component, one table | Next.js, UI kits, state libraries: nothing here needs them |
| `node:test` | Built in, zero config | Jest/Vitest: extra dependency for seven tests |
| npm workspaces | One `npm install` for both halves | Two separate installs, or a monorepo tool |

Runtime dependencies: express, csv-parse, react, react-dom.
