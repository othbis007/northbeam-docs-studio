# Northbeam Docs Studio

A small content service for documentation articles. A writer edits a **draft**,
publishes it into **frozen, numbered versions**, can unpublish, browse the history,
restore and delete versions. Anonymous readers only ever see the version an article
refers to, and only while the article is published.

## Spec-Driven Development artifacts

Built with Spec Kit. These files were committed before the code (see the git history):

- Constitution: [`.specify/memory/constitution.md`](.specify/memory/constitution.md)
- Spec: [`specs/001-article-lifecycle/spec.md`](specs/001-article-lifecycle/spec.md)
- Plan: [`specs/001-article-lifecycle/plan.md`](specs/001-article-lifecycle/plan.md)
- Tasks: [`specs/001-article-lifecycle/tasks.md`](specs/001-article-lifecycle/tasks.md)

Supporting design documents (research, data model, API contract, quickstart) are in
[`specs/001-article-lifecycle/`](specs/001-article-lifecycle/).

Sequence followed (one commit per step, visible in `git log`):

1. `/speckit-constitution`: 5 core principles
2. `/speckit-specify`: spec.md (user stories, requirements FR-001..FR-017, edge cases)
3. `/speckit-clarify`: 5 questions answered and written back into the spec
4. `/speckit-plan`: plan.md, research.md, data-model.md, contracts/api.md, quickstart.md
5. `/speckit-tasks`: tasks.md (T001..T057, in phases)
6. `/speckit-analyze`: consistency check, fixes applied to the artifacts
7. `/speckit-implement`: one commit per task, tests written before the code they cover

## How to run

Requirements: **Node 22 or later** and npm.

```bash
npm install    # installs dependencies, then creates data/northbeam.db (npm run setup)
npm run dev    # compiles the server and serves the API and the UI on http://localhost:3000
npm test       # runs every test (Vitest + Supertest)
```

- The database is a SQLite file, `data/northbeam.db`; data is kept across restarts.
  `npm run setup` can be run again at any time: it never erases data.
- The port can be changed with the `PORT` environment variable.
- UI: writer pages at `http://localhost:3000/#/`, public site at `http://localhost:3000/#/public`.
- After a change to the server code, restart `npm run dev` (the UI reloads by itself).

## API

Described in [`specs/001-article-lifecycle/contracts/api.md`](specs/001-article-lifecycle/contracts/api.md).

| Method | Path | What it does |
|---|---|---|
| `POST` | `/api/articles` | Create a draft (returns the final slug) |
| `GET` | `/api/articles` | List all articles (writer) |
| `GET` | `/api/articles/:id` | Get one article with its draft |
| `PUT` | `/api/articles/:id/draft` | Save the draft (`expectedDraftVersion`) |
| `POST` | `/api/articles/:id/publish` | Publish the draft (`expectedDraftVersion`) |
| `POST` | `/api/articles/:id/unpublish` | Unpublish |
| `GET` | `/api/articles/:id/versions` | List versions, newest first |
| `GET` | `/api/articles/:id/versions/:n` | View one version |
| `POST` | `/api/articles/:id/versions/:n/restore` | Copy a version into the draft |
| `DELETE` | `/api/articles/:id/versions/:n` | Delete a version (refused if referenced) |
| `GET` | `/api/public/articles` | Public list of published articles |
| `GET` | `/api/public/articles/:slug` | Public article, from its referenced version |

Errors: `400 VALIDATION_ERROR`, `409 STALE_DRAFT` (with the current draft),
`409 LIVE_VERSION_DELETE_FORBIDDEN`, `409 ARTICLE_NOT_PUBLISHED`, each with a
`message`. Anything not public, and unknown ids, answer `404` with no body.

## Data model and why

Two tables ([`data-model.md`](specs/001-article-lifecycle/data-model.md)):

```text
articles
  id, slug (unique, fixed), status (draft | published | unpublished),
  draft_title, draft_body, draft_tags (JSON array),
  draft_version (optimistic lock, starts at 1),
  last_published_version_id (nullable FK → article_versions),
  published_at (first publish date, nullable)

article_versions                       (never updated)
  id, article_id (FK), version_number (unique per article),
  title, body, tags, created_at
```

Status changes:

```text
draft ──publish──▶ published ──unpublish──▶ unpublished
                       ▲                         │
                       └────────publish──────────┘
```

An article never goes back to `draft`.

- **`articles`**: one row per article. Holds the fixed `slug`, the `status`
  (`draft`, `published`, `unpublished`), the draft (`draft_title`, `draft_body`,
  `draft_tags`), a `draft_version` counter, `last_published_version_id` and
  `published_at` (first publish date).
- **`article_versions`**: one row per publish, **never updated**. Version numbers are
  unique per article.

Why this shape:

- **Draft and published content are separate rows.** Editing only touches the draft
  columns of `articles`; readers only read `article_versions`. An edit can never change
  what readers see.
- **The reference is named `last_published_version_id`, not "current"**, because after
  unpublish it still points to a version that is no longer live.
- **The database is the last line of defense** (constitution, principle II). The same
  rules are checked in `articleService` and enforced again by SQLite:
  - a `CHECK` so that a draft has no reference and no publish date, and a published or
    unpublished article always has both;
  - a composite foreign key `(id, last_published_version_id)` →
    `article_versions (article_id, id)` with `ON DELETE RESTRICT`: the referenced
    version can never be deleted and always belongs to the same article;
  - triggers: versions cannot be updated, the first publish date cannot change once set,
    an article never goes back to draft, every draft change increases `draft_version` by
    exactly one, the slug never changes.
- **Publish runs in one transaction**: check `draft_version`, compute the next number,
  insert the version, move the reference, set the first publish date only if empty.
  Either everything happens or nothing does.
- **Outdated copies are detected with `draft_version`** (optimistic concurrency): save,
  publish and restore send `expectedDraftVersion`; if it no longer matches, the request is
  refused with `409 STALE_DRAFT` and the current draft, instead of overwriting it.

Code layout: routes only validate input (Zod, strict schemas) → `articleService` holds every
lifecycle rule → the database enforces the rules a second time.

```text
server/db/        schema.sql (tables, CHECK, foreign keys, triggers), connection, setup
server/services/  articleService.ts (lifecycle rules), errors.ts (error codes)
server/routes/    writer.ts, public.ts, schemas.ts (Zod)
web/              React + Vite UI (Markdown textarea + preview with marked + DOMPurify)
tests/            lifecycle tests (service + direct SQL) and API tests (Supertest)
```

## Tests

`npm test` runs every test. Each invariant from the brief has its own test file; where
the database enforces the rule, a test also writes directly to SQLite to show it refuses.

| Invariant (brief) | Test file |
|---|---|
| A published version is never changed | `tests/lifecycle/frozen-versions.test.ts` |
| Publish is atomic (status + reference together, crash, two connections) | `tests/lifecycle/publish-atomic.test.ts` |
| The live version cannot be deleted | `tests/lifecycle/protected-version.test.ts` |
| Restore does not create or remove versions | `tests/lifecycle/restore.test.ts` |
| A stale write fails with a clear error | `tests/lifecycle/outdated-copy.test.ts` |
| Unpublish keeps the version and `publishedAt` | `tests/lifecycle/unpublish.test.ts`, `first-publish-date.test.ts` |
| Readers get 404 for draft-only or unpublished, never the draft | `tests/lifecycle/reader-access.test.ts` |
| Data survives a restart | `tests/lifecycle/persistence.test.ts` |
| API status codes and error bodies | `tests/api/writer.test.ts`, `tests/api/public.test.ts` |

## Stretch goals (from the brief)

Two of the brief's stretch goals were done, after every required feature passed
(Phase 5 of tasks.md, priority P3 in the spec):

- **Idempotent publish** (FR-016): publishing with no draft change creates no identical
  version; an unpublished article simply becomes visible again.
  Tests: `tests/lifecycle/publish-no-change.test.ts`.
- **Slug collision handling** (FR-017): a slug already in use gets the next free suffix
  (`-2`, `-3`...) and the writer is told the final slug.
  Tests: `tests/lifecycle/slug-suffix.test.ts`, `tests/api/writer.test.ts`.

## Tradeoff

Under time pressure, I kept a single SQLite file (better-sqlite3) instead of setting up a
database server. It needs no installation, survives restarts, and its transactions make the
atomic publish and the outdated-copy checks simple and reliable; both are tested, including
a simulated crash during publish. The cost is that SQLite runs one write at a time and
better-sqlite3 is synchronous: the "two requests at once" test uses two connections on the
same file, but the publishes run one after the other, not truly in parallel. That fits one
trusted writer. With more time, I would move to PostgreSQL (row-level locks, real concurrent
writers) and add a test that fires truly parallel publish requests against the API.

Other tradeoffs, recorded in [`research.md`](specs/001-article-lifecycle/research.md):
tags are stored as a JSON array (simple to copy at publish and restore, but not indexable);
old drafts are not kept (history exists only for published versions); the project targets
Node 22+ because the current better-sqlite3 and Vitest no longer support Node 20.

## What is missing

- **No automated UI tests.** The UI was type-checked and served, but it has no tests;
  lifecycle and API tests were prioritised.
- **No truly parallel concurrency test** (see Tradeoff).
- **Writer-side 404s have no body.** Every `404` (reader and writer) answers with no body,
  one uniform rule (research.md D10). For readers this is deliberate: a draft-only,
  unpublished or unknown slug must look the same, so nothing reveals that an article
  exists. On the writer side there is nothing to hide, so with more time I would return
  `{ "error": "NOT_FOUND", "message": "..." }` there, following the Spec Kit workflow:
  update the spec (`/speckit-specify`), then the plan and API contract (`/speckit-plan`),
  then the tasks (`/speckit-tasks`), check consistency (`/speckit-analyze`), and only then
  implement it, test first (`/speckit-implement`).
- **No production build of the UI**: the UI is served by Vite in development mode
  (production deployment is out of scope).
- Out of scope by design: login and roles, multiple customers, rich Markdown components,
  visual editor, file uploads, search, large pagination, caching, deployment.

## Notes

- `package-lock.json` is intentionally not committed: when npm installs from a lockfile it
  ignores better-sqlite3's `gypfile: false` setting and tries to compile it from source
  (which requires Visual Studio C++ on Windows), although the package already ships
  prebuilt binaries. Direct dependencies are pinned to exact versions in `package.json`
  instead.
