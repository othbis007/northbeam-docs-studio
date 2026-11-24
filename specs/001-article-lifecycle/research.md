# Research & Decisions: Article Lifecycle

Each decision names the rule from [spec.md](./spec.md) it protects. Decisions come from
the `/speckit-plan` input and from choices confirmed by the user during planning.

## D1. Two tables: `articles` and `article_versions`

- **Decision**: the draft lives in `articles` (draft columns); each publish inserts one row
  in `article_versions`, never updated.
- **Rationale**: draft and published text are physically separate, so editing can never
  touch what readers see. Protects FR-003, FR-014, SC-001.
- **Alternatives considered**: a single table with a "draft" row and "published" rows;
  rejected because a bug in one UPDATE could reach published content.

## D2. Reference named `last_published_version_id`

- **Decision**: the article's reference to a version is named `last_published_version_id`,
  not "current".
- **Rationale**: after unpublish it still points to a version that is no longer live; the
  name stays true in every state. Protects FR-006, SC-006.

## D3. CHECK on status, reference and publish date

- **Decision**: a `draft` article has no reference and no publish date; a `published` or
  `unpublished` article always has both.
- **Rationale**: no state can exist where the status says published but the reference is
  missing, or the reverse. Protects FR-015, SC-002.

## D4. Composite foreign key with ON DELETE RESTRICT

- **Decision**: `(id, last_published_version_id)` in `articles` references
  `(article_id, id)` in `article_versions`, ON DELETE RESTRICT.
- **Rationale**: the referenced version can never be deleted, even if the service has a
  bug, and it always belongs to the same article. Protects FR-009, SC-003.
- **Note**: SQLite enforces foreign keys only when `PRAGMA foreign_keys = ON` is set on
  each connection; the connection setup must do it.

## D5. Triggers

| Trigger | Protects |
|---|---|
| Any UPDATE on `article_versions` is refused | FR-014, SC-001 |
| `published_at` cannot change once set | FR-005 |
| `status` cannot go back to `draft` | FR-015 (with D3) |
| Any change to the draft columns must increase `draft_version` by exactly one | FR-010, SC-005 |
| `slug` cannot change (agreed with the user, constitution principle II) | FR-002 |

## D6. Publish in one transaction

- **Decision**: in one transaction: check `draft_version`, compute the next number
  (highest + 1), insert the version, move the reference, set the publish date only if it
  is empty.
- **Rationale**: either everything happens or nothing does, including after a crash.
  `UNIQUE (article_id, version_number)` keeps numbers unique. Protects FR-004, FR-005,
  FR-015, SC-002.
- **Note**: better-sqlite3 runs transactions synchronously; using an immediate transaction
  takes the write lock at the start, so two publishes run one after the other.

## D7. Outdated-copy detection with `expectedDraftVersion`

- **Decision**: edits, publish and restore send `expectedDraftVersion`. The UPDATE only
  applies if it still matches; otherwise the API returns `409 STALE_DRAFT` with the
  current draft.
- **Rationale**: nothing is silently overwritten, and the writer gets the current draft to
  redo the change. Protects FR-010, SC-005 (including the clarification that publish and
  restore are also protected).
- **Note**: publish does not change the draft, so `draft_version` stays the same after a
  publish. Two publishes sent with the same expected value both pass the check; they run
  one after the other (D6). Without the bonus (D11) the second creates an identical
  version; with D11 it creates nothing.

## D8. Restore only rewrites the draft columns

- **Decision**: restore copies a version's title, body and tags into the draft columns and
  increases `draft_version`; it touches neither `article_versions` nor the status.
- **Rationale**: restoring never adds or removes versions and never publishes. Protects
  FR-008, SC-004.

## D9. Unpublish only changes the status

- **Decision**: unpublish sets `status` to `unpublished`; reference and publish date stay.
  Unpublishing an article that is not published returns `409 ARTICLE_NOT_PUBLISHED`.
- **Rationale**: unpublishing never loses what was published. Protects FR-006, SC-006.

## D10. Public reads join on the reference with `status = published`

- **Decision**: public queries join `articles` to `article_versions` on
  `last_published_version_id` and require `status = 'published'`. Anything else answers
  `404` with no body.
- **Rationale**: readers can only ever get version content, never draft columns, and
  non-public articles look like missing ones. Protects FR-012, FR-013, SC-007.

## D11. Bonus (P3)

- **Publish without changes**: before inserting, compare the draft (title, body, tags)
  with the referenced version; if identical, insert nothing; if the article is
  unpublished, only set the status back to `published`. Protects FR-016.
- **Slug already taken**: retry the insert with `-2`, `-3`... when the UNIQUE constraint
  fails, and return the final slug. Protects FR-017.

## D12. Error responses

- **Decision** (agreed with the user): `400 VALIDATION_ERROR`, `409 STALE_DRAFT`,
  `409 LIVE_VERSION_DELETE_FORBIDDEN`, `409 ARTICLE_NOT_PUBLISHED`, `409 SLUG_TAKEN` (slug
  already in use, until the slug-suffix bonus replaces it); `404` with no body for readers
  (draft-only, unpublished, unknown slug) and for unknown ids on the writer side.
- Request schemas are strict: unknown fields (for example `slug` on save draft) are refused
  with `400 VALIDATION_ERROR` instead of being silently ignored (FR-002).
- **Rationale**: clear codes for unsafe operations; non-public content reported as not
  found. Constitution principle IV.

## D13. Setup and test databases (agreed with the user)

- `npm run setup` creates `data/northbeam.db` and applies the schema without erasing
  existing data; `data/` is git-ignored.
- `npm install` runs `npm run setup` automatically (`postinstall`), so a fresh clone needs
  one setup command (constitution, principle V). Running it again is safe because setup
  never erases data.
- Each test uses a fresh SQLite database with the same schema, so tests are independent
  from each other and from `npm run dev` data.

## D15. Node 22 or later instead of Node 20 (agreed with the user)

- **Decision**: the project targets Node 22 or later (`"engines": { "node": ">=22" }`).
- **Rationale**: found while installing dependencies, before any code: the current
  better-sqlite3 (13.x) requires Node 22+, and the current Vitest (5.x) requires Node
  22.12+. With Node 20, `npm install` or `npm test` would fail from a fresh clone
  (constitution, principle V). Node 20 is also no longer maintained.
- **Alternatives considered**: keep Node 20 and pin older versions of better-sqlite3 and
  Vitest; rejected to avoid outdated tooling on an unmaintained runtime.
- **Impact**: none on spec.md (technology-agnostic) or on the constitution.

## Tradeoffs

- **SQLite single writer**: only one write runs at a time. This makes atomic publish and
  outdated-copy checks simple and safe, and fits one trusted writer; it would not fit many
  concurrent writers.
- **Tags stored as JSON**: tags are a JSON array in one column, in both tables. Simple to
  copy at publish and restore; the database cannot index or constrain single tags (search
  is out of scope anyway).
- **Old drafts not kept**: only the current draft exists; each save replaces it. History
  exists only for published versions. An unsaved or overwritten draft state cannot be
  recovered.

## D14. Running in development (agreed with the user)

- **Decision**: `npm run dev` compiles the server with `tsc`, then starts it with `node`;
  Express runs Vite in middleware mode, so the API and the UI share one process and one
  port.
- **Rationale**: no dependency added (`typescript` and `vite` are already needed);
  constitution principle V (few dependencies).
- **Alternatives considered**: `tsx` to run TypeScript directly (adds a dependency);
  `concurrently` to run two processes (adds a dependency).
- **Tradeoff**: after a server code change, `npm run dev` must be restarted; the UI
  reloads by itself through Vite; `npm test` is not affected (Vitest reads TypeScript).
