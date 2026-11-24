import { describe, it, expect, afterEach, vi } from 'vitest';
import { memoryDb } from '../helpers/db.js';
import { createArticleService } from '../../server/services/articleService.js';

// FR-005: the first publish date is set once and never changes.

afterEach(() => {
  vi.useRealTimers();
});

describe('first publish date (FR-005)', () => {
  it('is set on first publish and unchanged after republish, unpublish and publish again', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const service = createArticleService(memoryDb());

    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const a = service.create({ title: 'Guide', slug: 'guide', body: 'one', tags: [] });
    let cur = service.publish(a.id, a.draftVersion);
    expect(cur.publishedAt).toBe('2026-01-01T00:00:00.000Z');

    vi.setSystemTime(new Date('2026-02-01T00:00:00.000Z'));
    cur = service.saveDraft(a.id, { title: 'Guide', body: 'two', tags: [], expectedDraftVersion: cur.draftVersion });
    cur = service.publish(a.id, cur.draftVersion);
    expect(cur.publishedAt).toBe('2026-01-01T00:00:00.000Z');

    vi.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));
    cur = service.unpublish(a.id);
    expect(cur.publishedAt).toBe('2026-01-01T00:00:00.000Z');

    vi.setSystemTime(new Date('2026-04-01T00:00:00.000Z'));
    cur = service.saveDraft(a.id, { title: 'Guide', body: 'three', tags: [], expectedDraftVersion: cur.draftVersion });
    cur = service.publish(a.id, cur.draftVersion);
    expect(cur.publishedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('the database refuses a direct change once set (constitution II)', () => {
    const db = memoryDb();
    const service = createArticleService(db);
    const a = service.create({ title: 'Guide', slug: 'guide', body: '', tags: [] });
    service.publish(a.id, a.draftVersion);
    expect(() =>
      db.prepare("UPDATE articles SET published_at = '2030-01-01T00:00:00.000Z' WHERE id = ?").run(a.id),
    ).toThrow(/PUBLISHED_AT_IMMUTABLE/);
  });
});
