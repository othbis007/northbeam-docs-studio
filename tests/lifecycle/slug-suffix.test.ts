import { describe, it, expect } from 'vitest';
import { memoryDb } from '../helpers/db.js';
import { createArticleService } from '../../server/services/articleService.js';

// FR-017 (bonus): a slug already in use gets the next free suffix (-2, -3...),
// and the writer is told the final slug.

describe('slug already taken (FR-017)', () => {
  it('uses -2 then -3 and returns the final slug', () => {
    const service = createArticleService(memoryDb());
    expect(service.create({ title: 'One', slug: 'guide', body: '', tags: [] }).slug).toBe('guide');
    expect(service.create({ title: 'Two', slug: 'guide', body: '', tags: [] }).slug).toBe('guide-2');
    expect(service.create({ title: 'Three', slug: 'guide', body: '', tags: [] }).slug).toBe('guide-3');
  });

  it('skips suffixes already used by other articles', () => {
    const service = createArticleService(memoryDb());
    service.create({ title: 'One', slug: 'guide', body: '', tags: [] });
    service.create({ title: 'Other', slug: 'guide-2', body: '', tags: [] });
    expect(service.create({ title: 'Three', slug: 'guide', body: '', tags: [] }).slug).toBe('guide-3');
  });
});
