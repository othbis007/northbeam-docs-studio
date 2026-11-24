import { describe, it, expect } from 'vitest';
import { memoryDb } from '../helpers/db.js';
import { createArticleService } from '../../server/services/articleService.js';

// FR-016 (bonus): publishing a draft identical to the referenced version does not
// create a new version; an unpublished article simply becomes published again.

describe('publish without changes (FR-016)', () => {
  it('creates no new version when the draft equals the referenced version', () => {
    const service = createArticleService(memoryDb());
    const a = service.create({ title: 'Guide', slug: 'guide', body: 'Hello', tags: ['x'] });
    const first = service.publish(a.id, a.draftVersion);
    const again = service.publish(a.id, first.draftVersion);
    expect(again.lastPublishedVersionNumber).toBe(1);
    expect(again.status).toBe('published');
    expect(service.listVersions(a.id).map((v) => v.number)).toEqual([1]);
  });

  it('makes an unpublished article published again without a new version', () => {
    const service = createArticleService(memoryDb());
    const a = service.create({ title: 'Guide', slug: 'guide', body: 'Hello', tags: [] });
    const first = service.publish(a.id, a.draftVersion);
    service.unpublish(a.id);
    const again = service.publish(a.id, first.draftVersion);
    expect(again.status).toBe('published');
    expect(again.lastPublishedVersionNumber).toBe(1);
    expect(again.publishedAt).toBe(first.publishedAt);
    expect(service.listVersions(a.id)).toHaveLength(1);
    expect(service.getPublic('guide').body).toBe('Hello');
  });

  it('still creates a new version when the draft changed', () => {
    const service = createArticleService(memoryDb());
    const a = service.create({ title: 'Guide', slug: 'guide', body: 'Hello', tags: [] });
    const first = service.publish(a.id, a.draftVersion);
    const saved = service.saveDraft(a.id, { title: 'Guide', body: 'Changed', tags: [], expectedDraftVersion: first.draftVersion });
    const again = service.publish(a.id, saved.draftVersion);
    expect(again.lastPublishedVersionNumber).toBe(2);
  });

  it('a draft restored to the referenced content creates no new version', () => {
    const service = createArticleService(memoryDb());
    const a = service.create({ title: 'Guide', slug: 'guide', body: 'Hello', tags: [] });
    const first = service.publish(a.id, a.draftVersion);
    const edited = service.saveDraft(a.id, { title: 'Guide', body: 'Other', tags: [], expectedDraftVersion: first.draftVersion });
    const restored = service.restore(a.id, 1, edited.draftVersion);
    const again = service.publish(a.id, restored.draftVersion);
    expect(again.lastPublishedVersionNumber).toBe(1);
    expect(service.listVersions(a.id)).toHaveLength(1);
  });
});
