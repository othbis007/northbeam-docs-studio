# Implementation Plan: Article Lifecycle

**Branch**: `main` (no feature branch) | **Date**: 2026-11-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-article-lifecycle/spec.md`

## Summary

A writer creates and edits an article draft, publishes it into frozen numbered versions,
unpublishes it, browses its history, restores and deletes versions. Readers only ever see
the version an article refers to, and only while the article is published.

Technical approach: a TypeScript / Express API on Node 20 over a single SQLite file
(better-sqlite3), with a small React + Vite UI. Routes only validate input (Zod); one
`articleService` holds every lifecycle rule; the database enforces the same rules a second
time with a CHECK, a composite foreign key and triggers. Every operation that changes the
draft, publishes or restores carries `expectedDraftVersion` to detect outdated copies.

## Technical Context

**Language/Version**: TypeScript on Node 20

**Primary Dependencies**: Express (API), Zod (request validation), better-sqlite3 (database
access), React + Vite (UI), marked + DOMPurify (Markdown preview)

**Storage**: one SQLite file through better-sqlite3 (survives restarts, no server)

**Testing**: Vitest + Supertest; lifecycle tests take priority over UI tests

**Target Platform**: local Node 20 runtime and a browser

**Project Type**: web application (API + small UI)

**Performance Goals**: none stated in the input (N/A)

**Constraints**: one setup command from a fresh clone; data kept across restarts; few
dependencies; nothing outside the agreed scope (constitution, principle V)

**Scale/Scope**: one trusted writer, anonymous readers; SQLite allows one writer at a time

**Commands**: `npm install` (also runs `npm run setup` through `postinstall`),
`npm run dev` (compiles with `tsc`, then starts Express with Vite in middleware mode),
`npm test`. `npm run setup` stays available to apply the schema manually.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | How the design complies | Status |
|---|---|---|
| I. Published content is frozen | `article_versions` rows are never updated (trigger blocks every UPDATE). Publish always inserts a new row; editing only touches draft columns. | PASS |
| II. Database is the last line of defense | CHECK on status/reference/publish date; composite FK with ON DELETE RESTRICT; triggers for frozen versions, fixed publish date, no return to draft, draft_version +1, fixed slug; publish in one transaction. The service checks the same rules first. | PASS |
| III. Invariants proven by tests | Every rule in spec SC-001..SC-007 gets a Vitest/Supertest test; all run with `npm test`. Lifecycle tests are written before UI tests. | PASS |
| IV. Fail loudly | Explicit codes: `400 VALIDATION_ERROR`, `409 STALE_DRAFT`, `409 LIVE_VERSION_DELETE_FORBIDDEN`, `409 ARTICLE_NOT_PUBLISHED`, `409 SLUG_TAKEN` (until the slug-suffix bonus); strict request schemas; non-public content and unknown ids answer `404` with no body. No silent overwrite thanks to `expectedDraftVersion`. | PASS |
| V. Small and runnable | SQLite file (no server); one setup command from a fresh clone (`npm install`, which runs `setup`); no dependency added for dev running (`tsc` + `node`, Vite inside Express); out-of-scope list respected. | PASS |

**Post-design re-check (after Phase 1)**: PASS. No violation found in
[data-model.md](./data-model.md) or [contracts/api.md](./contracts/api.md).

## Project Structure

### Documentation (this feature)

```text
specs/001-article-lifecycle/
├── plan.md              # This file
├── research.md          # Phase 0: decisions, rationale, tradeoffs
├── data-model.md        # Phase 1: tables, constraints, triggers, state transitions
├── quickstart.md        # Phase 1: how to run and validate end-to-end
├── contracts/
│   └── api.md           # Phase 1: HTTP endpoints and error codes
└── tasks.md             # Phase 2 output (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
package.json             # single package: npm install / setup / dev / test
server/
├── db/                  # schema (tables, CHECK, FK, triggers) and connection
├── services/            # articleService: every lifecycle rule
└── routes/              # Express routes: Zod validation only
web/                     # React + Vite UI (writer pages, reader pages)
tests/                   # Vitest + Supertest (lifecycle first, then API, then UI)
data/                    # SQLite file created by npm run setup (git-ignored)
```

**Structure Decision**: one package at the repository root with `server/`, `web/` and
`tests/` (agreed with the user). Layers follow the input: routes validate, the service
decides, the database enforces again.

## Complexity Tracking

No constitution violation to justify.
