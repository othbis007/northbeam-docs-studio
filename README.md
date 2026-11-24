# Northbeam Docs Studio

A small content service for documentation articles. A writer edits a **draft**,
publishes it into **frozen, numbered versions**, can unpublish, browse the history,
restore and delete versions. Anonymous readers only ever see the version an article
refers to, and only while the article is published.

Built with Spec-Driven Development (Spec Kit): the constitution, spec, plan and tasks
were committed before the code. See [`.specify/memory/constitution.md`](.specify/memory/constitution.md)
and [`specs/001-article-lifecycle/`](specs/001-article-lifecycle/).

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
- `package-lock.json` is intentionally not committed: when npm installs from a lockfile it
  ignores better-sqlite3's `gypfile: false` setting and tries to compile it from source
  (which requires Visual Studio C++ on Windows), although the package already ships
  prebuilt binaries. Direct dependencies are pinned to exact versions in `package.json`
  instead.
- UI: writer pages at `http://localhost:3000/#/`, public site at `http://localhost:3000/#/public`.
- After a change to the server code, restart `npm run dev` (the UI reloads by itself).

## API

Described in [`specs/001-article-lifecycle/contracts/api.md`](specs/001-article-lifecycle/contracts/api.md).

- Writer: `/api/articles` (create, list, get, save draft, publish, unpublish, versions,
  restore, delete version).
- Reader: `/api/public/articles` and `/api/public/articles/:slug`.
- Errors: `400 VALIDATION_ERROR`, `409 STALE_DRAFT` (with the current draft),
  `409 LIVE_VERSION_DELETE_FORBIDDEN`, `409 ARTICLE_NOT_PUBLISHED`, each with a
  `message`. Anything not public, and unknown ids, answer `404` with no body.

## Data model and why

Two tables ([`data-model.md`](specs/001-article-lifecycle/data-model.md)):

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

`npm test` runs 68 tests. Lifecycle tests cover each rule of the spec through the service
and, where the database enforces the rule, by writing directly to SQLite to show the
database refuses it: frozen versions, atomic publish (including a simulated crash), the
protected referenced version, restore, outdated copies, unpublish, first publish date,
reader 404, persistence across restarts, and the two bonus features.

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
- **No production build of the UI**: the UI is served by Vite in development mode
  (production deployment is out of scope).
- Out of scope by design: login and roles, multiple customers, rich Markdown components,
  visual editor, file uploads, search, large pagination, caching, deployment.

## Bonus features

- Publishing without any change creates no identical version; an unpublished article simply
  becomes visible again.
- A slug already in use gets the next free suffix (`-2`, `-3`...), and the writer is told the
  final slug.
