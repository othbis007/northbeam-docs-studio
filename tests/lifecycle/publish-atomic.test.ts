import { describe, it, expect } from 'vitest';
import { memoryDb, fileDb } from '../helpers/db.js';
import { createArticleService } from '../../server/services/articleService.js';

// FR-004, FR-015, SC-002: publish is all or nothing; status and reference always agree.

describe('publish creates a version and moves the reference together (FR-004)', () => {
  it('first publish creates version 1 and sets status, reference and date', () => {
    const service = createArticleService(memoryDb());
    const a = service.create({ title: 'Guide', slug: 'guide', body: 'Hello', tags: ['x'] });
    const p = service.publish(a.id, a.draftVersion);
    expect(p.status).toBe('published');
    expect(p.lastPublishedVersionNumber).toBe(1);
    expect(p.publishedAt).not.toBeNull();
    expect(service.listVersions(a.id).map((v) => v.number)).toEqual([1]);
  });
});

describe('crash during publish leaves nothing changed (FR-015, SC-002)', () => {
  it('rolls back the new version when the reference update fails', () => {
    const { open } = fileDb();
    let db = open();
    let service = createArticleService(db);
    const a = service.create({ title: 'Guide', slug: 'guide', body: 'Hello', tags: [] });

    // Test-only trigger: make the update of the article's reference fail.
    db.exec(`
      CREATE TEMP TRIGGER simulate_crash
      BEFORE UPDATE OF last_published_version_id ON main.articles
      BEGIN SELECT RAISE(ABORT, 'SIMULATED_CRASH'); END;
    `);
    expect(() => service.publish(a.id, a.draftVersion)).toThrow();
    db.close();

    db = open();
    service = createArticleService(db);
    const after = service.get(a.id);
    expect(after.status).toBe('draft');
    expect(after.lastPublishedVersionNumber).toBeNull();
    expect(after.publishedAt).toBeNull();
    const count = db.prepare('SELECT COUNT(*) AS n FROM article_versions').get() as { n: number };
    expect(count.n).toBe(0);
    db.close();
  });
});

describe('two connections publishing the same article (FR-015, SC-002)', () => {
  it('keeps version numbers unique and status/reference consistent', () => {
    const { open } = fileDb();
    const db1 = open();
    const db2 = open();
    const s1 = createArticleService(db1);
    const s2 = createArticleService(db2);
    const a = s1.create({ title: 'Guide', slug: 'guide', body: 'Hello', tags: [] });

    s1.publish(a.id, a.draftVersion);
    s2.publish(a.id, a.draftVersion);

    const numbers = s1.listVersions(a.id).map((v) => v.number);
    expect(new Set(numbers).size).toBe(numbers.length);
    const final = s1.get(a.id);
    expect(final.status).toBe('published');
    expect(final.lastPublishedVersionNumber).toBe(Math.max(...numbers));
    db1.close();
    db2.close();
  });
});

describe('database refuses inconsistent status/reference written directly (constitution II)', () => {
  it('refuses published without a reference', () => {
    const db = memoryDb();
    const { lastInsertRowid } = db
      .prepare('INSERT INTO articles (slug, draft_title) VALUES (?, ?)')
      .run('guide', 'Guide');
    expect(() =>
      db.prepare("UPDATE articles SET status = 'published' WHERE id = ?").run(lastInsertRowid),
    ).toThrow();
  });

  it('refuses a reference to a version of another article', () => {
    const db = memoryDb();
    const insertArticle = db.prepare('INSERT INTO articles (slug, draft_title) VALUES (?, ?)');
    const a1 = Number(insertArticle.run('one', 'One').lastInsertRowid);
    const a2 = Number(insertArticle.run('two', 'Two').lastInsertRowid);
    const v = db
      .prepare(
        "INSERT INTO article_versions (article_id, version_number, title, body, tags, created_at) VALUES (?, 1, 'One', '', '[]', '2026-01-01T00:00:00.000Z')",
      )
      .run(a1);
    expect(() =>
      db
        .prepare(
          "UPDATE articles SET status = 'published', last_published_version_id = ?, published_at = '2026-01-01T00:00:00.000Z' WHERE id = ?",
        )
        .run(v.lastInsertRowid, a2),
    ).toThrow();
  });
});
