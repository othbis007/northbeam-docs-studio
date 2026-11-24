// Calls to every endpoint in contracts/api.md. Error bodies expose `error`
// and `message`; STALE_DRAFT also carries the current draft.

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

export interface DraftSnapshot {
  title: string;
  body: string;
  tags: string[];
  draftVersion: number;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly draft: DraftSnapshot | undefined;

  constructor(status: number, code: string | undefined, message: string, draft?: DraftSnapshot) {
    super(message);
    this.status = status;
    this.code = code;
    this.draft = draft;
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as { error?: string; message?: string; draft?: DraftSnapshot }) : undefined;
  if (!res.ok) {
    const message = data?.message ?? (res.status === 404 ? 'Not found.' : 'Request failed.');
    throw new ApiError(res.status, data?.error, message, data?.draft);
  }
  return data as T;
}

export const api = {
  listArticles: () => call<ArticleSummary[]>('GET', '/api/articles'),
  createArticle: (input: { title: string; slug: string; body: string; tags: string[] }) =>
    call<Article>('POST', '/api/articles', input),
  getArticle: (id: number) => call<Article>('GET', `/api/articles/${id}`),
  saveDraft: (id: number, input: { title: string; body: string; tags: string[]; expectedDraftVersion: number }) =>
    call<Article>('PUT', `/api/articles/${id}/draft`, input),
  publish: (id: number, expectedDraftVersion: number) =>
    call<Article>('POST', `/api/articles/${id}/publish`, { expectedDraftVersion }),
  unpublish: (id: number) => call<Article>('POST', `/api/articles/${id}/unpublish`),
  listVersions: (id: number) => call<Version[]>('GET', `/api/articles/${id}/versions`),
  getVersion: (id: number, n: number) => call<Version>('GET', `/api/articles/${id}/versions/${n}`),
  restore: (id: number, n: number, expectedDraftVersion: number) =>
    call<Article>('POST', `/api/articles/${id}/versions/${n}/restore`, { expectedDraftVersion }),
  deleteVersion: (id: number, n: number) => call<void>('DELETE', `/api/articles/${id}/versions/${n}`),
  listPublic: () => call<PublicSummary[]>('GET', '/api/public/articles'),
  getPublic: (slug: string) => call<PublicArticle>('GET', `/api/public/articles/${slug}`),
};

// Tags are edited as a comma-separated text field.
export const parseTags = (text: string): string[] =>
  text
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
