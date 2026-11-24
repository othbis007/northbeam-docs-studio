import { describe, it, expect, beforeEach } from 'vitest';
import { memoryDb } from '../helpers/db.js';
import type { Db } from '../../server/db/connection.js';
import { createArticleService, type ArticleService } from '../../server/services/articleService.js';
import type { AppError } from '../../server/services/errors.js';

// FR-006, SC-006: unpublishing hides the article but keeps what was published.

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

describe('unpublish (FR-006, SC-006)', () => {
  it('hides the article and keeps the reference, the date and the versions', () => {
    const a = service.create({ title: 'Guide', slug: 'guide', body: 'Hello', tags: [] });
    const p = service.publish(a.id, a.draftVersion);
    const u = service.unpublish(a.id);
    expect(u.status).toBe('unpublished');
    expect(u.lastPublishedVersionNumber).toBe(p.lastPublishedVersionNumber);
    expect(u.publishedAt).toBe(p.publishedAt);
    expect(service.listVersions(a.id).map((v) => v.number)).toEqual([1]);
    expect(codeOf(() => service.getPublic('guide'))).toBe('NOT_FOUND');
  });

  it('refuses to unpublish an article that was never published', () => {
    const a = service.create({ title: 'Guide', slug: 'guide', body: '', tags: [] });
    expect(codeOf(() => service.unpublish(a.id))).toBe('ARTICLE_NOT_PUBLISHED');
  });

  it('refuses to unpublish an article that is already unpublished', () => {
    const a = service.create({ title: 'Guide', slug: 'guide', body: '', tags: [] });
    service.publish(a.id, a.draftVersion);
    service.unpublish(a.id);
    expect(codeOf(() => service.unpublish(a.id))).toBe('ARTICLE_NOT_PUBLISHED');
  });

  it('the database refuses a direct return to draft (constitution II)', () => {
    const a = service.create({ title: 'Guide', slug: 'guide', body: '', tags: [] });
    service.publish(a.id, a.draftVersion);
    service.unpublish(a.id);
    expect(() =>
      db
        .prepare(
          "UPDATE articles SET status = 'draft', last_published_version_id = NULL, published_at = NULL WHERE id = ?",
        )
        .run(a.id),
    ).toThrow();
  });
});
