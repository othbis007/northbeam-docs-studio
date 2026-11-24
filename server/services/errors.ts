// Error codes of the lifecycle (contracts/api.md). The service throws them;
// the routes map them to HTTP statuses.

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'STALE_DRAFT'
  | 'LIVE_VERSION_DELETE_FORBIDDEN'
  | 'ARTICLE_NOT_PUBLISHED'
  | 'SLUG_TAKEN';

export interface DraftSnapshot {
  title: string;
  body: string;
  tags: string[];
  draftVersion: number;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly draft?: DraftSnapshot;

  constructor(code: ErrorCode, message: string, draft?: DraftSnapshot) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.draft = draft;
  }
}

export const validationError = (message: string) =>
  new AppError('VALIDATION_ERROR', message);

export const notFound = () => new AppError('NOT_FOUND', 'Not found.');

export const staleDraft = (draft: DraftSnapshot) =>
  new AppError(
    'STALE_DRAFT',
    'The draft was changed since you loaded it. Reload the current draft and try again.',
    draft,
  );

export const liveVersionDeleteForbidden = () =>
  new AppError(
    'LIVE_VERSION_DELETE_FORBIDDEN',
    'This version is the one the article refers to and cannot be deleted.',
  );

export const articleNotPublished = () =>
  new AppError(
    'ARTICLE_NOT_PUBLISHED',
    'The article is not published, so it cannot be unpublished.',
  );

export const slugTaken = (slug: string) =>
  new AppError('SLUG_TAKEN', `The slug "${slug}" is already used by another article.`);
