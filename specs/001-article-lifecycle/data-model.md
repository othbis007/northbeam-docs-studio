# Data Model: Article Lifecycle

Two tables, from the `/speckit-plan` input. Decisions are explained in
[research.md](./research.md).

## Table `articles`

One row per article.

| Column | Meaning | Rules |
|---|---|---|
| `id` | article id | primary key |
| `slug` | public address | UNIQUE; lowercase letters, digits, hyphens (FR-002); never changes (trigger) |
| `status` | `draft`, `published`, `unpublished` | cannot go back to `draft` (trigger) |
| `draft_title` | draft title | required, not empty (FR-001) |
| `draft_body` | draft Markdown body | may be empty |
| `draft_tags` | draft tags | JSON array, may be empty |
| `draft_version` | counter of draft changes | every change of a draft column increases it by exactly one (trigger) |
| `last_published_version_id` | version the article refers to | NULL only for `draft`; composite FK, see below |
| `published_at` | first publish date | NULL only for `draft`; never changes once set (trigger) |

**CHECK** (D3):
- `status = 'draft'` → `last_published_version_id IS NULL` and `published_at IS NULL`
- `status IN ('published', 'unpublished')` → both NOT NULL

**Foreign key** (D4): `(id, last_published_version_id)` → `article_versions (article_id, id)`,
ON DELETE RESTRICT.

## Table `article_versions`

One row per publish, never updated.

| Column | Meaning | Rules |
|---|---|---|
| `id` | version id | primary key |
| `article_id` | owning article | FK → `articles.id` |
| `version_number` | 1, 2, 3... | UNIQUE (`article_id`, `version_number`) |
| `title` | frozen title | copied from the draft at publish |
| `body` | frozen body | copied from the draft at publish |
| `tags` | frozen tags | JSON array copied from the draft at publish |
| `created_at` | publish time of this version | set at insert |

**Also**: UNIQUE (`article_id`, `id`), target of the composite foreign key.
**Trigger**: any UPDATE is refused (D5).

## State transitions

```text
          publish                unpublish
 draft ───────────▶ published ─────────────▶ unpublished
                       ▲                          │
                       └──────── publish ─────────┘
```

| Operation | From | Effect | Refused when |
|---|---|---|---|
| create | — | new `draft` row, `draft_version` initial value | missing title/slug, bad slug (`400`); slug taken (bonus: suffix) |
| save draft | any | draft columns updated, `draft_version` + 1 | outdated copy (`409 STALE_DRAFT`) |
| publish | any | new version (highest + 1), reference moved, `published_at` set if empty, status `published` | outdated copy (`409 STALE_DRAFT`) |
| publish, no change (bonus) | `published` / `unpublished` | no new version; status `published` | outdated copy |
| unpublish | `published` | status `unpublished` only | not published (`409 ARTICLE_NOT_PUBLISHED`) |
| restore | any with versions | version content copied to draft, `draft_version` + 1 | outdated copy (`409 STALE_DRAFT`) |
| delete version | any | version row removed | it is the referenced one (`409 LIVE_VERSION_DELETE_FORBIDDEN`) |

Returning to `draft` is never possible (trigger).
