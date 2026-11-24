import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { openDatabase } from './db/connection.js';
import { createApp } from './app.js';

// npm run dev: opens data/northbeam.db (created by npm install / npm run setup)
// and starts the API on one port. Vite middleware for the UI is added in T050.

const PORT = Number(process.env.PORT ?? 3000);
const DATA_DIR = resolve(process.cwd(), 'data');

mkdirSync(DATA_DIR, { recursive: true });
const db = openDatabase(resolve(DATA_DIR, 'northbeam.db'));
const app = createApp(db);

app.listen(PORT, () => {
  console.log(`Northbeam Docs Studio: http://localhost:${PORT}`);
});
