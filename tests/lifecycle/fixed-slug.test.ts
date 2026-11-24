import { describe, it, expect } from 'vitest';
import { memoryDb } from '../helpers/db.js';
import { createArticleService } from '../../server/services/articleService.js';

// FR-002: the slug never changes after creation.
// Sending a slug to "save draft" is refused by the API (tests/api/writer.test.ts, T033).

describe('the slug is fixed (FR-002)', () => {
  it('saving the draft never changes the slug', () => {
    const service = createArticleService(memoryDb());
    const a = service.create({ title: 'Guide', slug: 'guide', body: '', tags: [] });
    const saved = service.saveDraft(a.id, { title: 'New title', body: 'x', tags: [], expectedDraftVersion: 1 });
    expect(saved.slug).toBe('guide');
    expect(service.get(a.id).slug).toBe('guide');
  });

  it('the database refuses a direct slug change (constitution II)', () => {
    const db = memoryDb();
    const id = db.prepare('INSERT INTO articles (slug, draft_title) VALUES (?, ?)').run('guide', 'Guide').lastInsertRowid;
    expect(() => db.prepare("UPDATE articles SET slug = 'other' WHERE id = ?").run(id)).toThrow(/SLUG_IMMUTABLE/);
  });
});
