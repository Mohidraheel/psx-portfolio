import express from 'express';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { CsvError, parsePrices, parseTrades } from './csv.js';
import { TradeError, computePortfolio } from './portfolio.js';

const path = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const PRICES_FILE = path('../data/current_prices.csv');
const CLIENT_DIST = path('../../client/dist');

const app = express();

// The browser sends the CSV as the raw request body, so no multipart parser is needed.
app.post('/api/portfolio', express.text({ type: 'text/csv', limit: '1mb' }), async (req, res) => {
  try {
    if (typeof req.body !== 'string') throw new CsvError(['Send the CSV with Content-Type: text/csv']);
    const trades = parseTrades(req.body);
    // Read per request so prices can be updated without a restart.
    const prices = parsePrices(await readFile(PRICES_FILE, 'utf8'));
    res.json(computePortfolio(trades, prices));
  } catch (e) {
    if (e instanceof CsvError) return res.status(400).json({ errors: e.errors });
    if (e instanceof TradeError) return res.status(422).json({ errors: [e.message] });
    console.error(e);
    res.status(500).json({ errors: ['Server error'] });
  }
});

// After `npm run build -w client`, the same server also serves the UI.
if (existsSync(CLIENT_DIST)) app.use(express.static(CLIENT_DIST));

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`http://localhost:${port}`));
