import { describe, it, expect, beforeEach } from 'vitest';
import { memoryDb } from '../helpers/db.js';
import { createArticleService, type ArticleService } from '../../server/services/articleService.js';
import type { AppError } from '../../server/services/errors.js';

// FR-012, FR-013, SC-007: readers only see the referenced version of a published article.

function errorOf(fn: () => unknown): AppError | undefined {
  try {
    fn();
  } catch (e) {
    return e as AppError;
  }
  return undefined;
}

let service: ArticleService;

beforeEach(() => {
  service = createArticleService(memoryDb());
});

describe('non-public articles are not found (FR-013, SC-007)', () => {
  it('a draft-only article is not found', () => {
    service.create({ title: 'Draft', slug: 'draft', body: 'secret', tags: [] });
    expect(errorOf(() => service.getPublic('draft'))?.code).toBe('NOT_FOUND');
  });

  it('an unpublished article is not found', () => {
    const a = service.create({ title: 'Guide', slug: 'guide', body: 'Hello', tags: [] });
    service.publish(a.id, a.draftVersion);
    service.unpublish(a.id);
    expect(errorOf(() => service.getPublic('guide'))?.code).toBe('NOT_FOUND');
  });

  it('draft-only, unpublished and unknown slugs give the same answer', () => {
    service.create({ title: 'Draft', slug: 'draft', body: '', tags: [] });
    const a = service.create({ title: 'Gone', slug: 'gone', body: '', tags: [] });
    service.publish(a.id, a.draftVersion);
    service.unpublish(a.id);
    const errors = ['draft', 'gone', 'does-not-exist'].map((slug) => errorOf(() => service.getPublic(slug)));
    for (const e of errors) {
      expect(e?.code).toBe('NOT_FOUND');
      expect(e?.message).toBe(errors[0]?.message);
    }
  });
});

describe('readers read the referenced version, never the draft (FR-012, SC-007)', () => {
  it('shows published content even after the draft is edited', () => {
    const a = service.create({ title: 'V1 title', slug: 'guide', body: 'V1 body', tags: ['v1'] });
    const p = service.publish(a.id, a.draftVersion);
    service.saveDraft(a.id, {
      title: 'Draft title',
      body: 'Draft body',
      tags: ['draft'],
      expectedDraftVersion: p.draftVersion,
    });
    const read = service.getPublic('guide');
    expect(read.title).toBe('V1 title');
    expect(read.body).toBe('V1 body');
    expect(read.tags).toEqual(['v1']);
  });
});
