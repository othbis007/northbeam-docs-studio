import { describe, it, expect } from 'vitest';
import { memoryDb } from '../helpers/db.js';
import { createArticleService } from '../../server/services/articleService.js';

// FR-014, SC-001: a published version never changes.

describe('published versions never change (FR-014, SC-001)', () => {
  it('keeps version 1 identical after edits, publishes and restores', () => {
    const service = createArticleService(memoryDb());
    const a = service.create({ title: 'One', slug: 'guide', body: 'Body one', tags: ['one'] });
    let cur = service.publish(a.id, a.draftVersion);
    const v1 = service.getVersion(a.id, 1);

    cur = service.saveDraft(a.id, { title: 'Two', body: 'Body two', tags: ['two'], expectedDraftVersion: cur.draftVersion });
    cur = service.publish(a.id, cur.draftVersion);
    cur = service.restore(a.id, 1, cur.draftVersion);
    cur = service.saveDraft(a.id, { title: 'Three', body: 'Body three', tags: [], expectedDraftVersion: cur.draftVersion });
    service.publish(a.id, cur.draftVersion);

    expect(service.getVersion(a.id, 1)).toEqual(v1);
  });
});

describe('database refuses any update of a version (constitution II)', () => {
  it('refuses UPDATE on article_versions', () => {
    const db = memoryDb();
    const articleId = Number(
      db.prepare('INSERT INTO articles (slug, draft_title) VALUES (?, ?)').run('guide', 'Guide').lastInsertRowid,
    );
    const versionId = db
      .prepare(
        "INSERT INTO article_versions (article_id, version_number, title, body, tags, created_at) VALUES (?, 1, 'Guide', '', '[]', '2026-01-01T00:00:00.000Z')",
      )
      .run(articleId).lastInsertRowid;
    expect(() =>
      db.prepare("UPDATE article_versions SET title = 'Changed' WHERE id = ?").run(versionId),
    ).toThrow(/VERSION_IMMUTABLE/);
  });
});
