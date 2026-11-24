import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { openDatabase } from './connection.js';

// npm run setup (also run by npm install): creates data/northbeam.db and
// applies the schema. Existing data is never erased (research.md D13).
export const DATA_FILE = resolve(process.cwd(), 'data', 'northbeam.db');

mkdirSync(resolve(process.cwd(), 'data'), { recursive: true });
const db = openDatabase(DATA_FILE);
db.close();
console.log(`Database ready: ${DATA_FILE}`);
