import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { memoryDb } from '../helpers/db.js';
import { createArticleService, type ArticleService } from '../../server/services/articleService.js';

// FR-011: readers list published articles with title, tags and first publish date,
// newest first publish date first.

let service: ArticleService;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  service = createArticleService(memoryDb());
});

afterEach(() => {
  vi.useRealTimers();
});

function publishAt(slug: string, title: string, tags: string[], iso: string) {
  vi.setSystemTime(new Date(iso));
  const a = service.create({ title, slug, body: 'body', tags });
  return service.publish(a.id, a.draftVersion);
}

describe('public list (FR-011)', () => {
  it('lists only published articles, newest first publish date first', () => {
    publishAt('old', 'Old', ['a'], '2026-01-01T00:00:00.000Z');
    publishAt('new', 'New', ['b'], '2026-03-01T00:00:00.000Z');
    const gone = publishAt('gone', 'Gone', [], '2026-02-01T00:00:00.000Z');
    service.unpublish(gone.id);
    service.create({ title: 'Draft', slug: 'draft', body: '', tags: [] });

    expect(service.listPublic()).toEqual([
      { slug: 'new', title: 'New', tags: ['b'], publishedAt: '2026-03-01T00:00:00.000Z' },
      { slug: 'old', title: 'Old', tags: ['a'], publishedAt: '2026-01-01T00:00:00.000Z' },
    ]);
  });

  it('shows the title and tags of the referenced version, not of the draft', () => {
    const p = publishAt('guide', 'Published', ['pub'], '2026-01-01T00:00:00.000Z');
    service.saveDraft(p.id, { title: 'Draft', body: 'x', tags: ['draft'], expectedDraftVersion: p.draftVersion });
    const [item] = service.listPublic();
    expect(item?.title).toBe('Published');
    expect(item?.tags).toEqual(['pub']);
  });
});
