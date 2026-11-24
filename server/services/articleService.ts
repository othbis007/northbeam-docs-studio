import type { Db } from '../db/connection.js';

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

const notImplemented = (): never => {
  throw new Error('not implemented');
};

export function createArticleService(_db: Db): ArticleService {
  return {
    create: notImplemented,
    get: notImplemented,
    list: notImplemented,
    saveDraft: notImplemented,
    publish: notImplemented,
    unpublish: notImplemented,
    listVersions: notImplemented,
    getVersion: notImplemented,
    restore: notImplemented,
    deleteVersion: notImplemented,
    listPublic: notImplemented,
    getPublic: notImplemented,
  };
}
