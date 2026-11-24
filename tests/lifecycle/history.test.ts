import { describe, it, expect } from 'vitest';
import { memoryDb } from '../helpers/db.js';
import { createArticleService } from '../../server/services/articleService.js';
import type { AppError } from '../../server/services/errors.js';

// FR-007: versions listed newest first; any version can be opened.

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    return (e as AppError).code;
  }
  return undefined;
}

describe('version history (FR-007)', () => {
  it('lists versions newest first and opens any of them', () => {
    const service = createArticleService(memoryDb());
    const a = service.create({ title: 'T1', slug: 'guide', body: 'B1', tags: ['t1'] });
    let cur = service.publish(a.id, a.draftVersion);
    for (const n of [2, 3]) {
      cur = service.saveDraft(a.id, { title: `T${n}`, body: `B${n}`, tags: [`t${n}`], expectedDraftVersion: cur.draftVersion });
      cur = service.publish(a.id, cur.draftVersion);
    }

    expect(service.listVersions(a.id).map((v) => v.number)).toEqual([3, 2, 1]);
    const v1 = service.getVersion(a.id, 1);
    expect(v1.title).toBe('T1');
    expect(v1.body).toBe('B1');
    expect(v1.tags).toEqual(['t1']);
    expect(v1.createdAt).toEqual(expect.any(String));
  });

  it('reports an unknown version or article as not found', () => {
    const service = createArticleService(memoryDb());
    const a = service.create({ title: 'T', slug: 'guide', body: '', tags: [] });
    expect(codeOf(() => service.getVersion(a.id, 1))).toBe('NOT_FOUND');
    expect(codeOf(() => service.listVersions(9999))).toBe('NOT_FOUND');
  });
});
