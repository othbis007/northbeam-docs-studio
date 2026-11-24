import { describe, it, expect, beforeEach } from 'vitest';
import { memoryDb } from '../helpers/db.js';
import type { Db } from '../../server/db/connection.js';
import { createArticleService, type ArticleService } from '../../server/services/articleService.js';
import type { AppError } from '../../server/services/errors.js';

// FR-009, SC-003: the version an article refers to can never be deleted.

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    return (e as AppError).code;
  }
  return undefined;
}

let db: Db;
let service: ArticleService;

beforeEach(() => {
  db = memoryDb();
  service = createArticleService(db);
});

function publishTwice() {
  const a = service.create({ title: 'One', slug: 'guide', body: '1', tags: [] });
  let cur = service.publish(a.id, a.draftVersion);
  cur = service.saveDraft(a.id, { title: 'Two', body: '2', tags: [], expectedDraftVersion: cur.draftVersion });
  return service.publish(a.id, cur.draftVersion);
}

describe('protected version (FR-009, SC-003)', () => {
  it('deletes a version that is not the referenced one', () => {
    const a = publishTwice();
    service.deleteVersion(a.id, 1);
    expect(service.listVersions(a.id).map((v) => v.number)).toEqual([2]);
  });

  it('refuses to delete the referenced version', () => {
    const a = publishTwice();
    expect(codeOf(() => service.deleteVersion(a.id, 2))).toBe('LIVE_VERSION_DELETE_FORBIDDEN');
    expect(service.listVersions(a.id).map((v) => v.number)).toEqual([2, 1]);
  });

  it('still refuses after unpublish', () => {
    const a = publishTwice();
    service.unpublish(a.id);
    expect(codeOf(() => service.deleteVersion(a.id, 2))).toBe('LIVE_VERSION_DELETE_FORBIDDEN');
  });

  it('reports an unknown version as not found', () => {
    const a = publishTwice();
    expect(codeOf(() => service.deleteVersion(a.id, 99))).toBe('NOT_FOUND');
  });

  it('the database refuses a direct delete of the referenced version (constitution II)', () => {
    const a = publishTwice();
    const row = db.prepare('SELECT last_published_version_id AS id FROM articles WHERE id = ?').get(a.id) as { id: number };
    expect(() => db.prepare('DELETE FROM article_versions WHERE id = ?').run(row.id)).toThrow();
  });
});
