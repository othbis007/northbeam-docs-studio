import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase, type Db } from '../../server/db/connection.js';

// A fresh database with the same schema for each test (research.md D13).
export function memoryDb(): Db {
  return openDatabase(':memory:');
}

// A fresh database in a temporary file that can be closed and reopened
// (crash and persistence tests).
export function fileDb(): { file: string; open: () => Db } {
  const dir = mkdtempSync(join(tmpdir(), 'northbeam-test-'));
  const file = join(dir, 'test.db');
  return { file, open: () => openDatabase(file) };
}
