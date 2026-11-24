import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer as createViteServer } from 'vite';
import { openDatabase } from './db/connection.js';
import { createApp } from './app.js';

// npm run dev: opens data/northbeam.db (created by npm install / npm run setup)
// and serves the API and the UI on one port: Express runs Vite in middleware
// mode (research.md D14).

const PORT = Number(process.env.PORT ?? 3000);
const DATA_DIR = resolve(process.cwd(), 'data');

mkdirSync(DATA_DIR, { recursive: true });
const db = openDatabase(resolve(DATA_DIR, 'northbeam.db'));
const app = createApp(db);

const vite = await createViteServer({
  root: resolve(process.cwd(), 'web'),
  server: { middlewareMode: true },
  appType: 'spa',
});
app.use(vite.middlewares);

app.listen(PORT, () => {
  console.log(`Northbeam Docs Studio: http://localhost:${PORT}`);
});
