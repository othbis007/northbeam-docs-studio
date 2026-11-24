import { describe, it, expect, beforeEach } from 'vitest';
import { memoryDb } from '../helpers/db.js';
import type { Db } from '../../server/db/connection.js';
import { createArticleService, type ArticleService } from '../../server/services/articleService.js';
import type { AppError } from '../../server/services/errors.js';

// FR-010, SC-005: save, publish and restore from an outdated copy are refused.

function errorOf(fn: () => unknown): AppError | undefined {
  try {
    fn();
  } catch (e) {
    return e as AppError;
  }
  return undefined;
}

let db: Db;
let service: ArticleService;

beforeEach(() => {
  db = memoryDb();
  service = createArticleService(db);
});

describe('outdated copy is refused (FR-010, SC-005)', () => {
  it('refuses a save from an outdated copy and returns the current draft', () => {
    const a = service.create({ title: 'Start', slug: 'guide', body: '', tags: [] });
    const first = service.saveDraft(a.id, { title: 'First', body: 'b1', tags: [], expectedDraftVersion: 1 });
    expect(first.draftVersion).toBe(2);

    const e = errorOf(() =>
      service.saveDraft(a.id, { title: 'Second', body: 'b2', tags: [], expectedDraftVersion: 1 }),
    );
    expect(e?.code).toBe('STALE_DRAFT');
    expect(e?.draft).toEqual({ title: 'First', body: 'b1', tags: [], draftVersion: 2 });
    expect(service.get(a.id).title).toBe('First');
  });

  it('refuses a publish from an outdated copy and creates no version', () => {
    const a = service.create({ title: 'Start', slug: 'guide', body: '', tags: [] });
    service.saveDraft(a.id, { title: 'Changed', body: '', tags: [], expectedDraftVersion: 1 });
    expect(errorOf(() => service.publish(a.id, 1))?.code).toBe('STALE_DRAFT');
    expect(service.get(a.id).status).toBe('draft');
    expect(service.listVersions(a.id)).toEqual([]);
  });

  it('refuses a restore from an outdated copy and keeps the draft', () => {
    const a = service.create({ title: 'V1', slug: 'guide', body: '', tags: [] });
    const p = service.publish(a.id, a.draftVersion);
    const saved = service.saveDraft(a.id, { title: 'Newer', body: '', tags: [], expectedDraftVersion: p.draftVersion });
    expect(errorOf(() => service.restore(a.id, 1, p.draftVersion))?.code).toBe('STALE_DRAFT');
    expect(service.get(a.id).title).toBe('Newer');
    expect(service.get(a.id).draftVersion).toBe(saved.draftVersion);
  });
});

describe('database requires draft_version + 1 on every draft change (constitution II)', () => {
  it('refuses a draft change without the exact +1 step', () => {
    const id = db.prepare('INSERT INTO articles (slug, draft_title) VALUES (?, ?)').run('guide', 'Guide').lastInsertRowid;
    expect(() => db.prepare("UPDATE articles SET draft_title = 'X' WHERE id = ?").run(id)).toThrow(/DRAFT_VERSION_STEP/);
    expect(() =>
      db.prepare("UPDATE articles SET draft_title = 'X', draft_version = draft_version + 2 WHERE id = ?").run(id),
    ).toThrow(/DRAFT_VERSION_STEP/);
    expect(() =>
      db.prepare("UPDATE articles SET draft_title = 'X', draft_version = draft_version + 1 WHERE id = ?").run(id),
    ).not.toThrow();
  });
});
