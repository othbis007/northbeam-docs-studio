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

- [ ] T001 Create `package.json` with dependencies from plan.md (express, zod, better-sqlite3, react, react-dom, marked, dompurify; dev: typescript, vite, vitest, supertest and needed type packages) and scripts `setup`, `postinstall` (runs `setup`), `dev` (`tsc` then `node`), `test` (`vitest run`) per research.md D13, D14
- [ ] T002 [P] Create `tsconfig.json` for `server/` (Node 20 target, output folder for `tsc`) and `web/tsconfig.json` for the React app
- [ ] T003 [P] Create `vitest.config.ts` at repository root covering `tests/**/*.test.ts`
- [ ] T004 [P] Create `.gitignore` entries for `node_modules/`, the `tsc` output folder and `data/` (research.md D13)
- [ ] T005 Write tables in `server/db/schema.sql`: `articles` and `article_versions` with CHECK on status/reference/publish date, slug format and non-empty title, UNIQUE (`article_id`, `version_number`), UNIQUE (`article_id`, `id`), composite FK ON DELETE RESTRICT — fields per data-model.md `articles.slug`, `articles.status`, `articles.draft_title`, `articles.draft_body`, `articles.draft_tags`, `articles.draft_version`, `articles.last_published_version_id`, `articles.published_at`, `article_versions.article_id`, `article_versions.version_number`, `article_versions.title`, `article_versions.body`, `article_versions.tags`, `article_versions.created_at`
- [ ] T006 Add triggers to `server/db/schema.sql` per research.md D5: refuse any UPDATE on `article_versions`; `articles.published_at` never changes once set; `articles.status` never returns to `draft`; any draft-column change requires `articles.draft_version` = old + 1; `articles.slug` never changes (data-model.md)
- [ ] T007 Create `server/db/connection.ts`: open a better-sqlite3 database from a file path, run `PRAGMA foreign_keys = ON`, apply `server/db/schema.sql` only if tables do not exist (research.md D4, D13)
- [ ] T008 Create `server/db/setup.ts` used by `npm run setup`: create `data/` and `data/northbeam.db`, apply the schema, never erase existing data (research.md D13)
- [ ] T009 [P] Create `tests/helpers/db.ts`: a fresh SQLite database with the same schema for each test (research.md D13)
- [ ] T010 [P] Create `server/services/errors.ts`: error types for `VALIDATION_ERROR`, `NOT_FOUND`, `STALE_DRAFT` (with current draft), `LIVE_VERSION_DELETE_FORBIDDEN`, `ARTICLE_NOT_PUBLISHED`, each with a clear message (contracts/api.md)
- [ ] T011 Create `server/services/articleService.ts` with every operation from data-model.md "State transitions" plus public list/read, each throwing "not implemented", so tests compile and fail

**Checkpoint**: `npm install` creates the database; `npm test` runs (no tests yet).

---

## Phase 2: Tests first (they fail at this point)

**Purpose**: one test file per rule of the spec. Each file tests the service and, where
the database enforces the rule, a direct SQL write that the database must refuse.

- [ ] T012 [P] [US1] Test required fields and slug format in `tests/lifecycle/create-validation.test.ts`: missing title or slug, or slug outside `[a-z0-9-]`, refused with `VALIDATION_ERROR`; direct SQL insert refused by CHECK (FR-001, FR-002)
- [ ] T013 [P] [US1] Test atomic publish in `tests/lifecycle/publish-atomic.test.ts`: first publish creates version 1 and sets status and reference together; an error forced inside the publish transaction leaves nothing changed; two publishes on the same article keep version numbers unique and status/reference consistent; direct SQL setting `published` without reference refused by CHECK (FR-004, FR-015, SC-002)
- [ ] T014 [P] [US1] Test reader access in `tests/lifecycle/reader-access.test.ts`: draft-only, unpublished and unknown slug all give not found; a published article is read from its referenced version, never from an edited draft (FR-012, FR-013, SC-007)
- [ ] T015 [P] [US1] Test public list in `tests/lifecycle/public-list.test.ts`: only published articles, with title, tags, first publish date, newest first publish date first (FR-011)
- [ ] T016 [P] [US2] Test frozen versions in `tests/lifecycle/frozen-versions.test.ts`: edits, restores and publishes never change an existing version; direct SQL UPDATE on `article_versions` refused by trigger (FR-014, SC-001)
- [ ] T017 [P] [US2] Test outdated copy in `tests/lifecycle/outdated-copy.test.ts`: save, publish and restore with an old `expectedDraftVersion` refused with `STALE_DRAFT` and the current draft, nothing changed; direct SQL draft change without `draft_version` + 1 refused by trigger (FR-010, SC-005)
- [ ] T018 [P] [US2] Test fixed slug in `tests/lifecycle/fixed-slug.test.ts`: the service offers no slug change; direct SQL slug UPDATE refused by trigger (FR-002)
- [ ] T019 [P] [US2] Test first publish date in `tests/lifecycle/first-publish-date.test.ts`: set on first publish, unchanged after republish, unpublish and publish again; direct SQL change refused by trigger (FR-005)
- [ ] T020 [P] [US3] Test unpublish in `tests/lifecycle/unpublish.test.ts`: readers lose access, reference and first publish date kept; unpublishing a never-published or already unpublished article refused with `ARTICLE_NOT_PUBLISHED`; direct SQL status back to `draft` refused by trigger (FR-006, SC-006)
- [ ] T021 [P] [US4] Test history in `tests/lifecycle/history.test.ts`: versions listed newest first; any version opens with its title, body, tags (FR-007)
- [ ] T022 [P] [US4] Test restore in `tests/lifecycle/restore.test.ts`: draft takes the version's content, nothing published, readers see no change, versions identical in count, numbers and content (FR-008, SC-004)
- [ ] T023 [P] [US4] Test protected version in `tests/lifecycle/protected-version.test.ts`: deleting a non-referenced version works; deleting the referenced one refused with `LIVE_VERSION_DELETE_FORBIDDEN`, also after unpublish; direct SQL DELETE refused by the foreign key (FR-009, SC-003)

**Checkpoint**: `npm test` runs all tests above; service tests fail, direct-SQL tests pass.

---

## Phase 3: Service (until the Phase 2 tests pass)

**Purpose**: every lifecycle rule in `server/services/articleService.ts` (research.md D1–D10).

- [ ] T024 [US1] Implement create and get in `server/services/articleService.ts`: validate title and slug per data-model.md `articles.draft_title`, `articles.slug`; new row with status `draft` and initial `articles.draft_version` (FR-001, FR-002)
- [ ] T025 [US2] Implement save draft in `server/services/articleService.ts`: UPDATE draft columns and `draft_version` + 1 only where `draft_version` = `expectedDraftVersion`, otherwise `STALE_DRAFT` with the current draft (FR-003, FR-010; research.md D7)
- [ ] T026 [US1] Implement publish in `server/services/articleService.ts` in one immediate transaction: check `draft_version`, next number = highest + 1, insert version, move `last_published_version_id`, set `published_at` only if empty, status `published` (FR-004, FR-005, FR-015; research.md D6)
- [ ] T027 [US3] Implement unpublish in `server/services/articleService.ts`: status `unpublished` only; refuse with `ARTICLE_NOT_PUBLISHED` when not published (FR-006; research.md D9)
- [ ] T028 [US1] Implement public list and public read in `server/services/articleService.ts`: join on `last_published_version_id` with status `published`, newest `published_at` first; anything else not found (FR-011, FR-012, FR-013; research.md D10)
- [ ] T029 [US4] Implement list versions (newest first) and get version in `server/services/articleService.ts` (FR-007)
- [ ] T030 [US4] Implement restore in `server/services/articleService.ts`: copy version title, body, tags into draft columns with the `expectedDraftVersion` check and `draft_version` + 1; no change to versions or status (FR-008, FR-010; research.md D8)
- [ ] T031 [US4] Implement delete version in `server/services/articleService.ts`: refuse with `LIVE_VERSION_DELETE_FORBIDDEN` when it is the referenced version, otherwise delete (FR-009)

**Checkpoint**: all Phase 2 tests pass with `npm test`.

---

## Phase 4: API

**Purpose**: routes only validate input (Zod) and map errors (contracts/api.md).

- [ ] T032 [P] [US1] Write API tests in `tests/api/writer.test.ts` with Supertest: status codes and bodies of every writer endpoint, including `400`, `404` with no body, and the three `409` codes (contracts/api.md)
- [ ] T033 [P] [US1] Write API tests in `tests/api/public.test.ts` with Supertest: public list and read; `404` with no body for draft-only, unpublished and unknown slug (FR-013)
- [ ] T034 [P] [US1] Create Zod request schemas in `server/routes/schemas.ts` for create, save draft (no slug field, FR-002), publish and restore (`expectedDraftVersion`)
- [ ] T035 [US1] Create `server/app.ts`: Express app, JSON body parsing, error mapping (`VALIDATION_ERROR` → 400, `NOT_FOUND` → 404 with no body, `STALE_DRAFT` / `LIVE_VERSION_DELETE_FORBIDDEN` / `ARTICLE_NOT_PUBLISHED` → 409 with `error` and `message`)
- [ ] T036 [US1] Add create, list and get routes in `server/routes/writer.ts` (contracts/api.md)
- [ ] T037 [US2] Add `PUT /api/articles/:id/draft` in `server/routes/writer.ts`
- [ ] T038 [US1] Add `POST /api/articles/:id/publish` in `server/routes/writer.ts`
- [ ] T039 [US3] Add `POST /api/articles/:id/unpublish` in `server/routes/writer.ts`
- [ ] T040 [US4] Add versions list, get, restore and delete routes in `server/routes/writer.ts`
- [ ] T041 [P] [US1] Add public list and read routes in `server/routes/public.ts`
- [ ] T042 [US1] Create `server/index.ts`: open `data/northbeam.db`, start the Express app on one port (Vite middleware added in T049)

**Checkpoint**: all tests pass, including API tests.

---

## Phase 5: Bonus (only after everything above passes)

- [ ] T043 [P] [US5] Test publish without changes in `tests/lifecycle/publish-no-change.test.ts`: no new version when the draft equals the referenced version; an unpublished article becomes published again without a new version (FR-016)
- [ ] T044 [US5] Implement the comparison before insert in publish in `server/services/articleService.ts` (research.md D11)
- [ ] T045 [P] [US6] Test slug suffix in `tests/lifecycle/slug-suffix.test.ts` and `tests/api/writer.test.ts`: second "guide" becomes "guide-2", third "guide-3", final slug returned (FR-017)
- [ ] T046 [US6] Implement retry with `-2`, `-3`... on UNIQUE failure in create in `server/services/articleService.ts` and return the final slug (research.md D11)

**Checkpoint**: all tests pass, including bonus tests.

---

## Phase 6: UI

**Purpose**: minimal React + Vite UI (plan.md); Markdown preview with marked + DOMPurify.

- [ ] T047 [P] [US1] Create `web/index.html`, `web/src/main.tsx` and `web/src/App.tsx` with routes for writer pages and public pages
- [ ] T048 [P] [US1] Create `web/src/api.ts`: calls to every endpoint in contracts/api.md, exposing `error` and `message` from error bodies
- [ ] T049 [US1] Add Vite in middleware mode to `server/index.ts` so `npm run dev` serves API and UI on one port (research.md D14)
- [ ] T050 [US1] Create article list page in `web/src/pages/WriterList.tsx`: articles with status, create form (title, slug, body, tags), shows the final slug returned
- [ ] T051 [US2] Create editor in `web/src/pages/Editor.tsx`: Markdown textarea and preview (marked + DOMPurify), save with `expectedDraftVersion`, show the `STALE_DRAFT` message and the current draft
- [ ] T052 [US1] Add publish and unpublish buttons to `web/src/pages/Editor.tsx`, showing `ARTICLE_NOT_PUBLISHED` and `STALE_DRAFT` messages
- [ ] T053 [US4] Create history panel in `web/src/components/HistoryPanel.tsx`: versions newest first, open one, restore with a warning that the draft will be replaced, delete with the `LIVE_VERSION_DELETE_FORBIDDEN` message
- [ ] T054 [P] [US1] Create public pages `web/src/pages/PublicList.tsx` and `web/src/pages/PublicArticle.tsx` (rendered Markdown, "not found" on 404)

**Checkpoint**: `npm run dev` shows the writer and public pages; all tests still pass.

---

## Phase 7: Delivery

- [ ] T055 Write `README.md`: how to run (`npm install`, `npm run dev`, `npm test`), data model and why (data-model.md, research.md), one tradeoff paragraph (research.md "Tradeoffs"), what is missing
- [ ] T056 Final check from a fresh clone: run quickstart.md setup and all validation scenarios, `npm test` green, data kept after restart

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: none. T005 → T006 (same file); T007 needs T005–T006; T008 needs T007; T011 needs T010.
- **Phase 2 (Tests)**: needs Phase 1. All test tasks are [P] (one file each).
- **Phase 3 (Service)**: needs Phase 2. Tasks are sequential (same file).
- **Phase 4 (API)**: needs Phase 3. T032–T034 [P]; T035 before routes; T036–T040 sequential (same file); T041 [P] with T036–T040; T042 needs T035–T041.
- **Phase 5 (Bonus)**: needs Phases 1–4 passing. Test before implementation in each pair.
- **Phase 6 (UI)**: needs Phase 4. T049 needs T042 and T047.
- **Phase 7 (Delivery)**: needs all previous phases.

### User Story Coverage

| Story | Tests | Service | API | UI |
|---|---|---|---|---|
| US1 Create, publish, read (P1) | T012–T015 | T024, T026, T028 | T032–T036, T038, T041, T042 | T047–T050, T052, T054 |
| US2 Edit safely (P1) | T016–T019 | T025 | T037 | T051 |
| US3 Unpublish (P2) | T020 | T027 | T039 | T052 |
| US4 History, restore, delete (P2) | T021–T023 | T029–T031 | T040 | T053 |
| US5 Publish without changes (P3) | T043 | T044 | — | — |
| US6 Slug already taken (P3) | T045 | T046 | T045 | T050 |

---

## Parallel Examples

```text
# Phase 1, after T001:
T002 tsconfig.json   |   T003 vitest.config.ts   |   T004 .gitignore

# Phase 2, all together:
T012 … T023 (one test file each)

# Phase 4, before routes:
T032 tests/api/writer.test.ts   |   T033 tests/api/public.test.ts   |   T034 server/routes/schemas.ts

# Phase 6:
T047 web entry   |   T048 web/src/api.ts   |   T054 public pages
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

- Open point: before T046 (bonus), creating an article with a slug already in use hits the
  UNIQUE constraint; contracts/api.md defines no error code for this case. To be decided
  with the user before T024.
- API tests (T032, T033) are written before the routes, following the tests-first order.
