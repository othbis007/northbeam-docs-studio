import { describe, it, expect, beforeEach } from 'vitest';
import { memoryDb } from '../helpers/db.js';
import type { Db } from '../../server/db/connection.js';
import { createArticleService, type ArticleService } from '../../server/services/articleService.js';
import type { AppError } from '../../server/services/errors.js';

// FR-001, FR-002: title and slug required; slug lowercase letters, digits, hyphens.

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    return (e as AppError).code;
  }
  return undefined;
}

let db: Db;
let service: ArticleService;

beforeEach(() => {
  db = memoryDb();
  service = createArticleService(db);
});

describe('create: required fields and slug format (FR-001, FR-002)', () => {
  it('creates a draft with body and tags allowed to be empty', () => {
    const a = service.create({ title: 'Guide', slug: 'guide', body: '', tags: [] });
    expect(a.status).toBe('draft');
    expect(a.draftVersion).toBe(1);
    expect(a.body).toBe('');
    expect(a.tags).toEqual([]);
    expect(a.lastPublishedVersionNumber).toBeNull();
    expect(a.publishedAt).toBeNull();
  });

  it('refuses a missing or blank title', () => {
    expect(codeOf(() => service.create({ title: '', slug: 'a', body: '', tags: [] }))).toBe('VALIDATION_ERROR');
    expect(codeOf(() => service.create({ title: '   ', slug: 'a', body: '', tags: [] }))).toBe('VALIDATION_ERROR');
  });

  it('refuses a missing slug', () => {
    expect(codeOf(() => service.create({ title: 'T', slug: '', body: '', tags: [] }))).toBe('VALIDATION_ERROR');
  });

  it('refuses a slug outside lowercase letters, digits and hyphens', () => {
    for (const slug of ['Guide', 'my guide', 'guide_1', 'élan', 'a/b']) {
      expect(codeOf(() => service.create({ title: 'T', slug, body: '', tags: [] }))).toBe('VALIDATION_ERROR');
    }
  });

  it('refuses a slug already in use with SLUG_TAKEN (replaced by the suffix bonus, T046)', () => {
    service.create({ title: 'One', slug: 'guide', body: '', tags: [] });
    expect(codeOf(() => service.create({ title: 'Two', slug: 'guide', body: '', tags: [] }))).toBe('SLUG_TAKEN');
  });
});

describe('database refuses invalid rows written directly (constitution II)', () => {
  const insert = (slug: string, title: string) =>
    db.prepare('INSERT INTO articles (slug, draft_title) VALUES (?, ?)').run(slug, title);

  it('refuses an empty title', () => {
    expect(() => insert('ok', '  ')).toThrow();
  });

  it('refuses a badly formatted slug', () => {
    expect(() => insert('Bad Slug', 'Title')).toThrow();
    expect(() => insert('', 'Title')).toThrow();
  });

  it('accepts a valid row', () => {
    expect(() => insert('valid-slug-1', 'Title')).not.toThrow();
  });
});
