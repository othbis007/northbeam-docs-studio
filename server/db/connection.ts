import Database from 'better-sqlite3';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type Db = Database.Database;

// schema.sql sits next to this file in the sources; when running the compiled
// code from dist/server/db, it is read from the sources folder.
function schemaPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, 'schema.sql'),
    join(here, '..', '..', '..', 'server', 'db', 'schema.sql'),
  ];
  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    throw new Error('schema.sql not found');
  }
  return found;
}

export function applySchema(db: Db): void {
  // Every statement uses IF NOT EXISTS: existing tables and data are kept.
  db.exec(readFileSync(schemaPath(), 'utf8'));
}

// Opens a database (file path or ':memory:'), turns foreign keys on
// (research.md D4) and applies the schema.
export function openDatabase(file: string): Db {
  const db = new Database(file);
  db.pragma('foreign_keys = ON');
  applySchema(db);
  return db;
}
