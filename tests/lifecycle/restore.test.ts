import { describe, it, expect } from 'vitest';
import { memoryDb } from '../helpers/db.js';
import { createArticleService } from '../../server/services/articleService.js';

// FR-008, SC-004: restore copies a version into the draft; nothing is published,
// no version is added or removed.

describe('restore (FR-008, SC-004)', () => {
  it('copies the version into the draft and changes nothing else', () => {
    const service = createArticleService(memoryDb());
    const a = service.create({ title: 'A', slug: 'guide', body: 'Body A', tags: ['a'] });
    let cur = service.publish(a.id, a.draftVersion);
    cur = service.saveDraft(a.id, { title: 'B', body: 'Body B', tags: ['b'], expectedDraftVersion: cur.draftVersion });
    cur = service.publish(a.id, cur.draftVersion);

    const versionsBefore = service.listVersions(a.id);
    const restored = service.restore(a.id, 1, cur.draftVersion);

    expect(restored.title).toBe('A');
    expect(restored.body).toBe('Body A');
    expect(restored.tags).toEqual(['a']);
    expect(restored.draftVersion).toBe(cur.draftVersion + 1);
    expect(restored.status).toBe('published');
    expect(restored.lastPublishedVersionNumber).toBe(2);
    expect(service.getPublic('guide').title).toBe('B');
    expect(service.listVersions(a.id)).toEqual(versionsBefore);
  });
});
