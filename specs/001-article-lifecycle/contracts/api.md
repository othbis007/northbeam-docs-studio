# API Contract: Article Lifecycle

Routes agreed with the user during planning. Bodies are JSON. Requests are validated with
Zod in the routes; every lifecycle rule is decided in `articleService`.

## Error responses

| Status | Body | When |
|---|---|---|
| `400` | `{ "error": "VALIDATION_ERROR", "message": "..." }` | invalid request, missing title or slug, bad slug format |
| `404` | no body | reader: draft-only, unpublished or unknown slug; writer: unknown article or version id |
| `409` | `{ "error": "STALE_DRAFT", "message": "...", "draft": { "title", "body", "tags", "draftVersion" } }` | save, publish or restore with an outdated `expectedDraftVersion` |
| `409` | `{ "error": "LIVE_VERSION_DELETE_FORBIDDEN", "message": "..." }` | delete of the referenced version |
| `409` | `{ "error": "ARTICLE_NOT_PUBLISHED", "message": "..." }` | unpublish of an article that is not published |
| `409` | `{ "error": "SLUG_TAKEN", "message": "..." }` | create with a slug already in use, until the slug-suffix bonus is done (then replaced by the suffix) |

All request schemas are strict: unknown fields are refused with `400 VALIDATION_ERROR`.

## Writer endpoints

| Method & path | Request body | Success | Errors |
|---|---|---|---|
| `POST /api/articles` | `{ title, slug, body, tags }` | `201` article (with final slug) | `400`, `409 SLUG_TAKEN` (before the bonus) |
| `GET /api/articles` | — | `200` list of articles (status, slug, draft title) | — |
| `GET /api/articles/:id` | — | `200` article with draft, `draftVersion`, status, reference, `publishedAt` | `404` |
| `PUT /api/articles/:id/draft` | `{ title, body, tags, expectedDraftVersion }` | `200` updated article | `400`, `404`, `409 STALE_DRAFT` |
| `POST /api/articles/:id/publish` | `{ expectedDraftVersion }` | `200` article (+ version number) | `404`, `409 STALE_DRAFT` |
| `POST /api/articles/:id/unpublish` | — | `200` article | `404`, `409 ARTICLE_NOT_PUBLISHED` |
| `GET /api/articles/:id/versions` | — | `200` versions, newest first | `404` |
| `GET /api/articles/:id/versions/:n` | — | `200` one version (title, body, tags, number, date) | `404` |
| `POST /api/articles/:id/versions/:n/restore` | `{ expectedDraftVersion }` | `200` article with restored draft | `404`, `409 STALE_DRAFT` |
| `DELETE /api/articles/:id/versions/:n` | — | `204` | `404`, `409 LIVE_VERSION_DELETE_FORBIDDEN` |

The slug is not accepted in `PUT .../draft` (fixed after creation, FR-002): sending it is
refused with `400 VALIDATION_ERROR`.

`:id` is an integer article id; `:n` is the version number (1, 2, 3...).

## Reader endpoints

| Method & path | Success | Errors |
|---|---|---|
| `GET /api/public/articles` | `200` list of `{ slug, title, tags, publishedAt }` from referenced versions, newest `publishedAt` first | — |
| `GET /api/public/articles/:slug` | `200` `{ slug, title, body, tags, publishedAt }` from the referenced version | `404` no body |

Reader responses never contain draft columns.
