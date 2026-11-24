---

description: "Task list for Article Lifecycle"
---

# Tasks: Article Lifecycle

**Input**: Design documents from `specs/001-article-lifecycle/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/api.md](./contracts/api.md),
[quickstart.md](./quickstart.md)

**Tests**: requested (tests first). One test per rule of the spec, written before the
service; each rule is checked through the service and, where the database enforces it,
also by writing directly to the database (constitution, principle II).

**Organization**: phases follow the order given in the `/speckit-tasks` input (setup →
tests → service → API → bonus → UI → delivery). Each task carries the user story it serves
(`[US1]`..`[US6]`) and the spec rules it covers (`FR-xxx`, `SC-xxx`). Each task is small
enough for one commit.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: user story from spec.md (US1..US6); none in Setup and Delivery
- Paths follow the structure in plan.md: `server/`, `web/`, `tests/`, `data/`

---

## Phase 1: Setup

**Purpose**: TypeScript project, scripts, database connection with foreign keys on, schema
with all constraints and triggers.

- [X] T001 Create `package.json` with dependencies from plan.md (express, zod, better-sqlite3, react, react-dom, marked, dompurify; dev: typescript, vite, vitest, supertest and needed type packages) and scripts `setup`, `postinstall` (runs `setup`), `dev` (`tsc` then `node`), `test` (`vitest run`) per research.md D13, D14
- [X] T002 [P] Create `tsconfig.json` for `server/` (Node 22+ target, output folder for `tsc`) and `web/tsconfig.json` for the React app
- [X] T003 [P] Create `vitest.config.ts` at repository root covering `tests/**/*.test.ts`
- [X] T004 [P] Create `.gitignore` entries for `node_modules/`, the `tsc` output folder and `data/` (research.md D13)
- [X] T005 Write tables in `server/db/schema.sql`: `articles` and `article_versions` with CHECK on status/reference/publish date, slug format, non-empty title in both tables, UNIQUE (`article_id`, `version_number`), UNIQUE (`article_id`, `id`), composite FK ON DELETE RESTRICT — fields per data-model.md `articles.id`, `article_versions.id`, `articles.slug`, `articles.status`, `articles.draft_title`, `articles.draft_body`, `articles.draft_tags`, `articles.draft_version`, `articles.last_published_version_id`, `articles.published_at`, `article_versions.article_id`, `article_versions.version_number`, `article_versions.title`, `article_versions.body`, `article_versions.tags`, `article_versions.created_at`
- [X] T006 Add triggers to `server/db/schema.sql` per research.md D5: refuse any UPDATE on `article_versions`; `articles.published_at` never changes once set; `articles.status` never returns to `draft`; any draft-column change requires `articles.draft_version` = old + 1; `articles.slug` never changes (data-model.md)
- [X] T007 Create `server/db/connection.ts`: open a better-sqlite3 database from a file path, run `PRAGMA foreign_keys = ON`, apply `server/db/schema.sql` only if tables do not exist (research.md D4, D13)
- [X] T008 Create `server/db/setup.ts` used by `npm run setup`: create `data/` and `data/northbeam.db`, apply the schema, never erase existing data (research.md D13)
- [X] T009 [P] Create `tests/helpers/db.ts`: a fresh SQLite database with the same schema for each test, in memory by default, with an option for a temporary file that can be closed and reopened (used by T013, T024) (research.md D13)
- [X] T010 [P] Create `server/services/errors.ts`: error types for `VALIDATION_ERROR`, `NOT_FOUND`, `STALE_DRAFT` (with current draft), `LIVE_VERSION_DELETE_FORBIDDEN`, `ARTICLE_NOT_PUBLISHED`, `SLUG_TAKEN`, each with a clear message (contracts/api.md)
- [X] T011 Create `server/services/articleService.ts` with every operation from data-model.md "State transitions" plus public list/read, each throwing "not implemented", so tests compile and fail

**Checkpoint**: `npm install` creates the database; `npm test` runs (no tests yet).

---

## Phase 2: Tests first (they fail at this point)

**Purpose**: one test file per rule of the spec. Each file tests the service and, where
the database enforces the rule, a direct SQL write that the database must refuse.

- [X] T012 [P] [US1] Test required fields and slug format in `tests/lifecycle/create-validation.test.ts`: missing title or slug, or slug outside `[a-z0-9-]`, refused with `VALIDATION_ERROR`; direct SQL insert refused by CHECK; a slug already in use refused with `SLUG_TAKEN` (replaced by the suffix test in T046) (FR-001, FR-002)
- [X] T013 [P] [US1] Test atomic publish in `tests/lifecycle/publish-atomic.test.ts`: first publish creates version 1 and sets status and reference together; crash: on a temporary database file, install a test-only trigger that makes the update of the article's reference fail, call the service's publish, then reopen the file and check that no version was added and status and reference are unchanged; concurrency: two connections on the same database file publish the same article, and version numbers stay unique and status/reference consistent; direct SQL setting `published` without reference refused by CHECK (FR-004, FR-015, SC-002)
- [X] T014 [P] [US1] Test reader access in `tests/lifecycle/reader-access.test.ts`: draft-only, unpublished and unknown slug all give not found; a published article is read from its referenced version, never from an edited draft (FR-012, FR-013, SC-007)
- [X] T015 [P] [US1] Test public list in `tests/lifecycle/public-list.test.ts`: only published articles, with title, tags, first publish date, newest first publish date first (FR-011)
- [X] T016 [P] [US2] Test frozen versions in `tests/lifecycle/frozen-versions.test.ts`: edits, restores and publishes never change an existing version; direct SQL UPDATE on `article_versions` refused by trigger (FR-014, SC-001)
- [X] T017 [P] [US2] Test outdated copy in `tests/lifecycle/outdated-copy.test.ts`: save, publish and restore with an old `expectedDraftVersion` refused with `STALE_DRAFT` and the current draft, nothing changed; direct SQL draft change without `draft_version` + 1 refused by trigger (FR-010, SC-005)
- [X] T018 [P] [US2] Test fixed slug in `tests/lifecycle/fixed-slug.test.ts`: the service offers no slug change; a save request that contains `slug` is refused with `VALIDATION_ERROR` (checked through the API in T033); direct SQL slug UPDATE refused by trigger (FR-002)
- [X] T019 [P] [US2] Test first publish date in `tests/lifecycle/first-publish-date.test.ts`: set on first publish, unchanged after republish, unpublish and publish again; direct SQL change refused by trigger (FR-005)
- [X] T020 [P] [US3] Test unpublish in `tests/lifecycle/unpublish.test.ts`: readers lose access, reference and first publish date kept; unpublishing a never-published or already unpublished article refused with `ARTICLE_NOT_PUBLISHED`; direct SQL status back to `draft` refused by trigger (FR-006, SC-006)
- [X] T021 [P] [US4] Test history in `tests/lifecycle/history.test.ts`: versions listed newest first; any version opens with its title, body, tags (FR-007)
- [X] T022 [P] [US4] Test restore in `tests/lifecycle/restore.test.ts`: draft takes the version's content, nothing published, readers see no change, versions identical in count, numbers and content (FR-008, SC-004)
- [X] T023 [P] [US4] Test protected version in `tests/lifecycle/protected-version.test.ts`: deleting a non-referenced version works; deleting the referenced one refused with `LIVE_VERSION_DELETE_FORBIDDEN`, also after unpublish; direct SQL DELETE refused by the foreign key (FR-009, SC-003)
- [X] T024 [P] [US1] Test persistence in `tests/lifecycle/persistence.test.ts`: create and publish in a database file, close it, reopen it, and check that articles, versions and first publish date are unchanged (constitution, principle V)

**Checkpoint**: `npm test` runs all tests above; service tests fail, direct-SQL tests pass.

---

## Phase 3: Service (until the Phase 2 tests pass)

**Purpose**: every lifecycle rule in `server/services/articleService.ts` (research.md D1–D10).

- [X] T025 [US1] Implement create and get in `server/services/articleService.ts`: validate title and slug per data-model.md `articles.draft_title`, `articles.slug`; new row with status `draft` and `articles.draft_version` = 1 (data-model.md); a slug already in use refused with `SLUG_TAKEN` until T047 (FR-001, FR-002)
- [X] T026 [US2] Implement save draft in `server/services/articleService.ts`: UPDATE draft columns and `draft_version` + 1 only where `draft_version` = `expectedDraftVersion`, otherwise `STALE_DRAFT` with the current draft (FR-003, FR-010; research.md D7)
- [X] T027 [US1] Implement publish in `server/services/articleService.ts` in one immediate transaction: check `draft_version`, next number = highest + 1, insert version, move `last_published_version_id`, set `published_at` only if empty, status `published` (FR-004, FR-005, FR-015; research.md D6)
- [X] T028 [US3] Implement unpublish in `server/services/articleService.ts`: status `unpublished` only; refuse with `ARTICLE_NOT_PUBLISHED` when not published (FR-006; research.md D9)
- [X] T029 [US1] Implement public list and public read in `server/services/articleService.ts`: join on `last_published_version_id` with status `published`, newest `published_at` first; anything else not found (FR-011, FR-012, FR-013; research.md D10)
- [X] T030 [US4] Implement list versions (newest first) and get version in `server/services/articleService.ts` (FR-007)
- [X] T031 [US4] Implement restore in `server/services/articleService.ts`: copy version title, body, tags into draft columns with the `expectedDraftVersion` check and `draft_version` + 1; no change to versions or status (FR-008, FR-010; research.md D8)
- [X] T032 [US4] Implement delete version in `server/services/articleService.ts`: refuse with `LIVE_VERSION_DELETE_FORBIDDEN` when it is the referenced version, otherwise delete (FR-009)

**Checkpoint**: all Phase 2 tests pass with `npm test`.

---

## Phase 4: API

**Purpose**: routes only validate input (Zod) and map errors (contracts/api.md).

- [X] T033 [P] [US1] Write API tests in `tests/api/writer.test.ts` with Supertest: status codes and bodies of every writer endpoint, including `400` (also when `slug` is sent to save draft), `404` with no body, and the `409` codes (contracts/api.md)
- [X] T034 [P] [US1] Write API tests in `tests/api/public.test.ts` with Supertest: public list and read; `404` with no body for draft-only, unpublished and unknown slug (FR-013)
- [X] T035 [P] [US1] Create Zod request schemas in `server/routes/schemas.ts` for create, save draft, publish and restore (`expectedDraftVersion`); all schemas strict, so unknown fields such as `slug` on save draft are refused with `VALIDATION_ERROR` (FR-002)
- [X] T036 [US1] Create `server/app.ts`: Express app, JSON body parsing, error mapping (`VALIDATION_ERROR` → 400, `NOT_FOUND` → 404 with no body, `STALE_DRAFT` / `LIVE_VERSION_DELETE_FORBIDDEN` / `ARTICLE_NOT_PUBLISHED` / `SLUG_TAKEN` → 409 with `error` and `message`)
- [X] T037 [US1] Add create, list and get routes in `server/routes/writer.ts` (contracts/api.md); the writer article list serves the writer UI of US1 (T051)
- [X] T038 [US2] Add `PUT /api/articles/:id/draft` in `server/routes/writer.ts`
- [X] T039 [US1] Add `POST /api/articles/:id/publish` in `server/routes/writer.ts`
- [X] T040 [US3] Add `POST /api/articles/:id/unpublish` in `server/routes/writer.ts`
- [X] T041 [US4] Add versions list, get, restore and delete routes in `server/routes/writer.ts`
- [X] T042 [P] [US1] Add public list and read routes in `server/routes/public.ts`
- [X] T043 [US1] Create `server/index.ts`: open `data/northbeam.db`, start the Express app on one port (Vite middleware added in T050)

**Checkpoint**: all tests pass, including API tests.

---

## Phase 5: Bonus (only after everything above passes)

- [X] T044 [P] [US5] Test publish without changes in `tests/lifecycle/publish-no-change.test.ts`: no new version when the draft equals the referenced version; an unpublished article becomes published again without a new version (FR-016)
- [X] T045 [US5] Implement the comparison before insert in publish in `server/services/articleService.ts` (research.md D11)
- [X] T046 [P] [US6] Test slug suffix in `tests/lifecycle/slug-suffix.test.ts` and `tests/api/writer.test.ts`: second "guide" becomes "guide-2", third "guide-3", final slug returned; replace the `SLUG_TAKEN` expectations of T012 and T033 (FR-017)
- [X] T047 [US6] Implement retry with `-2`, `-3`... on UNIQUE failure in create in `server/services/articleService.ts` and return the final slug; `SLUG_TAKEN` is no longer returned (research.md D11)

**Checkpoint**: all tests pass, including bonus tests.

---

## Phase 6: UI

**Purpose**: minimal React + Vite UI (plan.md); Markdown preview with marked + DOMPurify.

- [X] T048 [P] [US1] Create `web/index.html`, `web/src/main.tsx` and `web/src/App.tsx` with routes for writer pages and public pages
- [X] T049 [P] [US1] Create `web/src/api.ts`: calls to every endpoint in contracts/api.md, exposing `error` and `message` from error bodies
- [X] T050 [US1] Add Vite in middleware mode to `server/index.ts` so `npm run dev` serves API and UI on one port (research.md D14)
- [X] T051 [US1] Create article list page in `web/src/pages/WriterList.tsx`: articles with status, create form (title, slug, body, tags), shows the final slug returned
- [X] T052 [US2] Create editor in `web/src/pages/Editor.tsx`: Markdown textarea and preview (marked + DOMPurify), save with `expectedDraftVersion`, show the `STALE_DRAFT` message and the current draft
- [X] T053 [US1] Add publish and unpublish buttons to `web/src/pages/Editor.tsx`, showing `ARTICLE_NOT_PUBLISHED` and `STALE_DRAFT` messages
- [X] T054 [US4] Create history panel in `web/src/components/HistoryPanel.tsx`: versions newest first, open one, restore with a warning that the draft will be replaced, delete with the `LIVE_VERSION_DELETE_FORBIDDEN` message
- [X] T055 [P] [US1] Create public pages `web/src/pages/PublicList.tsx` and `web/src/pages/PublicArticle.tsx` (rendered Markdown, "not found" on 404)

**Checkpoint**: `npm run dev` shows the writer and public pages; all tests still pass.

---

## Phase 7: Delivery

- [X] T056 Write `README.md`: how to run (`npm install`, `npm run dev`, `npm test`), data model and why (data-model.md, research.md), one tradeoff paragraph (research.md "Tradeoffs"), what is missing
- [X] T057 Final check from a fresh clone: run quickstart.md setup and all validation scenarios, `npm test` green, data kept after restart

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: none. T005 → T006 (same file); T007 needs T005–T006; T008 needs T007; T011 needs T010.
- **Phase 2 (Tests)**: needs Phase 1. All test tasks are [P] (one file each).
- **Phase 3 (Service)**: needs Phase 2. Tasks are sequential (same file).
- **Phase 4 (API)**: needs Phase 3. T033–T035 [P]; T036 before routes; T037–T041 sequential (same file); T042 [P] with T037–T041; T043 needs T036–T042.
- **Phase 5 (Bonus)**: needs Phases 1–4 passing. Test before implementation in each pair.
- **Phase 6 (UI)**: needs Phase 4. T050 needs T043 and T048.
- **Phase 7 (Delivery)**: needs all previous phases.

### User Story Coverage

| Story | Tests | Service | API | UI |
|---|---|---|---|---|
| US1 Create, publish, read (P1) | T012–T015, T024 | T025, T027, T029 | T033–T037, T039, T042, T043 | T048–T051, T053, T055 |
| US2 Edit safely (P1) | T016–T019 | T026 | T038 | T052 |
| US3 Unpublish (P2) | T020 | T028 | T040 | T053 |
| US4 History, restore, delete (P2) | T021–T023 | T030–T032 | T041 | T054 |
| US5 Publish without changes (P3) | T044 | T045 | — | — |
| US6 Slug already taken (P3) | T046 | T047 | T046 | T051 |

---

## Parallel Examples

```text
# Phase 1, after T001:
T002 tsconfig.json   |   T003 vitest.config.ts   |   T004 .gitignore

# Phase 2, all together:
T012 … T024 (one test file each)

# Phase 4, before routes:
T033 tests/api/writer.test.ts   |   T034 tests/api/public.test.ts   |   T035 server/routes/schemas.ts

# Phase 6:
T048 web entry   |   T049 web/src/api.ts   |   T055 public pages
```

---

## Implementation Strategy

1. **MVP**: Phases 1–4 limited to US1 and US2 tasks (create, edit safely, publish, read).
2. Then US3 and US4 tasks of Phases 3–4 (unpublish, history, restore, delete).
3. Bonus (Phase 5) only when every earlier test passes.
4. UI (Phase 6), then delivery (Phase 7).
5. Commit after each task; spec and plan commits already precede all code.

---

## Notes

- Slug already in use before the bonus (T047): refused with `409 SLUG_TAKEN`
  (decided with the user); after T047 the suffix replaces it.
- API tests (T033, T034) are written before the routes, following the tests-first order.
