import type { Db } from '../db/connection.js';
import { articleNotPublished, notFound, slugTaken, staleDraft, validationError } from './errors.js';

// Every lifecycle rule lives here (plan.md); the database enforces the same
// rules a second time (schema.sql).

export type Status = 'draft' | 'published' | 'unpublished';

export interface Article {
  id: number;
  slug: string;
  status: Status;
  title: string;
  body: string;
  tags: string[];
  draftVersion: number;
  lastPublishedVersionNumber: number | null;
  publishedAt: string | null;
}

export interface ArticleSummary {
  id: number;
  slug: string;
  status: Status;
  title: string;
}

export interface Version {
  number: number;
  title: string;
  body: string;
  tags: string[];
  createdAt: string;
}

export interface PublicSummary {
  slug: string;
  title: string;
  tags: string[];
  publishedAt: string;
}

export interface PublicArticle extends PublicSummary {
  body: string;
}

export interface CreateInput {
  title: string;
  slug: string;
  body: string;
  tags: string[];
}

export interface DraftInput {
  title: string;
  body: string;
  tags: string[];
  expectedDraftVersion: number;
}

export interface ArticleService {
  create(input: CreateInput): Article;
  get(id: number): Article;
  list(): ArticleSummary[];
  saveDraft(id: number, input: DraftInput): Article;
  publish(id: number, expectedDraftVersion: number): Article;
  unpublish(id: number): Article;
  listVersions(id: number): Version[];
  getVersion(id: number, number: number): Version;
  restore(id: number, number: number, expectedDraftVersion: number): Article;
  deleteVersion(id: number, number: number): void;
  listPublic(): PublicSummary[];
  getPublic(slug: string): PublicArticle;
}

interface ArticleRow {
  id: number;
  slug: string;
  status: Status;
  draft_title: string;
  draft_body: string;
  draft_tags: string;
  draft_version: number;
  last_published_version_id: number | null;
  last_published_version_number: number | null;
  published_at: string | null;
}

const SLUG_PATTERN = /^[a-z0-9-]+$/;

const notImplemented = (): never => {
  throw new Error('not implemented');
};

// FR-001: title required, not blank.
function checkTitle(title: unknown): string {
  if (typeof title !== 'string' || title.trim().length === 0) {
    throw validationError('Title is required.');
  }
  return title;
}

function checkContent(body: unknown, tags: unknown): { body: string; tags: string[] } {
  if (typeof body !== 'string') {
    throw validationError('Body must be text.');
  }
  if (!Array.isArray(tags) || !tags.every((t) => typeof t === 'string')) {
    throw validationError('Tags must be a list of text values.');
  }
  return { body, tags };
}

function isUniqueSlugError(e: unknown): boolean {
  const err = e as { code?: string; message?: string };
  return err.code === 'SQLITE_CONSTRAINT_UNIQUE' && (err.message ?? '').includes('articles.slug');
}

function toArticle(row: ArticleRow): Article {
  return {
    id: row.id,
    slug: row.slug,
    status: row.status,
    title: row.draft_title,
    body: row.draft_body,
    tags: JSON.parse(row.draft_tags) as string[],
    draftVersion: row.draft_version,
    lastPublishedVersionNumber: row.last_published_version_number,
    publishedAt: row.published_at,
  };
}

export function createArticleService(db: Db): ArticleService {
  const selectArticle = db.prepare(`
    SELECT a.*, v.version_number AS last_published_version_number
    FROM articles a
    LEFT JOIN article_versions v ON v.id = a.last_published_version_id
    WHERE a.id = ?
  `);

  function findRow(id: number): ArticleRow {
    const row = selectArticle.get(id) as ArticleRow | undefined;
    if (!row) {
      throw notFound();
    }
    return row;
  }

  // T025 (FR-001, FR-002): create a draft; slug already in use -> SLUG_TAKEN.
  function create(input: CreateInput): Article {
    const title = checkTitle(input.title);
    if (typeof input.slug !== 'string' || !SLUG_PATTERN.test(input.slug)) {
      throw validationError('Slug is required and may only contain lowercase letters, digits and hyphens.');
    }
    const { body, tags } = checkContent(input.body, input.tags);
    try {
      const result = db
        .prepare('INSERT INTO articles (slug, draft_title, draft_body, draft_tags) VALUES (?, ?, ?, ?)')
        .run(input.slug, title, body, JSON.stringify(tags));
      return toArticle(findRow(Number(result.lastInsertRowid)));
    } catch (e) {
      if (isUniqueSlugError(e)) {
        throw slugTaken(input.slug);
      }
      throw e;
    }
  }

  function get(id: number): Article {
    return toArticle(findRow(id));
  }

  function staleFor(row: ArticleRow) {
    const a = toArticle(row);
    return staleDraft({ title: a.title, body: a.body, tags: a.tags, draftVersion: a.draftVersion });
  }

  // T026 (FR-003, FR-010): the UPDATE only applies if the writer's copy is current.
  function saveDraft(id: number, input: DraftInput): Article {
    const title = checkTitle(input.title);
    const { body, tags } = checkContent(input.body, input.tags);
    const result = db
      .prepare(`
        UPDATE articles
        SET draft_title = ?, draft_body = ?, draft_tags = ?, draft_version = draft_version + 1
        WHERE id = ? AND draft_version = ?
      `)
      .run(title, body, JSON.stringify(tags), id, input.expectedDraftVersion);
    if (result.changes === 0) {
      throw staleFor(findRow(id));
    }
    return get(id);
  }

  // T027 (FR-004, FR-005, FR-015; research.md D6): one immediate transaction.
  // Either the version is inserted and the reference moved, or nothing changes.
  const publishTx = db.transaction((id: number, expectedDraftVersion: number) => {
    const row = findRow(id);
    if (row.draft_version !== expectedDraftVersion) {
      throw staleFor(row);
    }
    const { next } = db
      .prepare('SELECT COALESCE(MAX(version_number), 0) + 1 AS next FROM article_versions WHERE article_id = ?')
      .get(id) as { next: number };
    const now = new Date().toISOString();
    const version = db
      .prepare(`
        INSERT INTO article_versions (article_id, version_number, title, body, tags, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(id, next, row.draft_title, row.draft_body, row.draft_tags, now);
    db.prepare(`
      UPDATE articles
      SET status = 'published',
          last_published_version_id = ?,
          published_at = COALESCE(published_at, ?)
      WHERE id = ?
    `).run(version.lastInsertRowid, now, id);
  });

  function publish(id: number, expectedDraftVersion: number): Article {
    publishTx.immediate(id, expectedDraftVersion);
    return get(id);
  }

  // T028 (FR-006; research.md D9): only the status changes; reference and date stay.
  function unpublish(id: number): Article {
    const result = db
      .prepare("UPDATE articles SET status = 'unpublished' WHERE id = ? AND status = 'published'")
      .run(id);
    if (result.changes === 0) {
      findRow(id);
      throw articleNotPublished();
    }
    return get(id);
  }

  // T029 (FR-011, FR-012, FR-013; research.md D10): readers only get the referenced
  // version of a published article; anything else is not found.
  interface PublicRow {
    slug: string;
    title: string;
    body: string;
    tags: string;
    published_at: string;
  }

  const publicSelect = `
    SELECT a.slug, v.title, v.body, v.tags, a.published_at
    FROM articles a
    JOIN article_versions v ON v.id = a.last_published_version_id
    WHERE a.status = 'published'
  `;

  function listPublic(): PublicSummary[] {
    const rows = db.prepare(`${publicSelect} ORDER BY a.published_at DESC, a.id DESC`).all() as PublicRow[];
    return rows.map((r) => ({
      slug: r.slug,
      title: r.title,
      tags: JSON.parse(r.tags) as string[],
      publishedAt: r.published_at,
    }));
  }

  function getPublic(slug: string): PublicArticle {
    const r = db.prepare(`${publicSelect} AND a.slug = ?`).get(slug) as PublicRow | undefined;
    if (!r) {
      throw notFound();
    }
    return {
      slug: r.slug,
      title: r.title,
      body: r.body,
      tags: JSON.parse(r.tags) as string[],
      publishedAt: r.published_at,
    };
  }

  // T030 (FR-007): versions newest first; any version can be opened.
  interface VersionRow {
    id: number;
    version_number: number;
    title: string;
    body: string;
    tags: string;
    created_at: string;
  }

  const toVersion = (r: VersionRow): Version => ({
    number: r.version_number,
    title: r.title,
    body: r.body,
    tags: JSON.parse(r.tags) as string[],
    createdAt: r.created_at,
  });

  function findVersionRow(id: number, number: number): VersionRow {
    const r = db
      .prepare('SELECT * FROM article_versions WHERE article_id = ? AND version_number = ?')
      .get(id, number) as VersionRow | undefined;
    if (!r) {
      throw notFound();
    }
    return r;
  }

  function listVersions(id: number): Version[] {
    findRow(id);
    const rows = db
      .prepare('SELECT * FROM article_versions WHERE article_id = ? ORDER BY version_number DESC')
      .all(id) as VersionRow[];
    return rows.map(toVersion);
  }

  function getVersion(id: number, number: number): Version {
    findRow(id);
    return toVersion(findVersionRow(id, number));
  }

  function list(): ArticleSummary[] {
    const rows = db
      .prepare('SELECT id, slug, status, draft_title FROM articles ORDER BY id')
      .all() as Pick<ArticleRow, 'id' | 'slug' | 'status' | 'draft_title'>[];
    return rows.map((r) => ({ id: r.id, slug: r.slug, status: r.status, title: r.draft_title }));
  }

  return {
    create,
    get,
    list,
    saveDraft,
    publish,
    unpublish,
    listVersions,
    getVersion,
    restore: notImplemented,
    deleteVersion: notImplemented,
    listPublic,
    getPublic,
  };
}
