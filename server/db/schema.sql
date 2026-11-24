-- Northbeam Docs Studio schema (specs/001-article-lifecycle/data-model.md).
-- Every statement is idempotent: applying the schema twice never erases data.

CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- FR-002: lowercase letters, digits and hyphens only
  slug TEXT NOT NULL UNIQUE
    CHECK (length(slug) > 0 AND slug NOT GLOB '*[^a-z0-9-]*'),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'unpublished')),
  -- FR-001: title required, not empty
  draft_title TEXT NOT NULL CHECK (length(trim(draft_title)) > 0),
  draft_body TEXT NOT NULL DEFAULT '',
  draft_tags TEXT NOT NULL DEFAULT '[]'
    CHECK (json_valid(draft_tags) AND json_type(draft_tags) = 'array'),
  -- FR-010: counter used to detect outdated copies, starts at 1
  draft_version INTEGER NOT NULL DEFAULT 1 CHECK (draft_version >= 1),
  last_published_version_id INTEGER,
  published_at TEXT,
  -- FR-015 (research.md D3): status, reference and publish date always agree
  CHECK (
    (status = 'draft'
      AND last_published_version_id IS NULL
      AND published_at IS NULL)
    OR
    (status IN ('published', 'unpublished')
      AND last_published_version_id IS NOT NULL
      AND published_at IS NOT NULL)
  ),
  -- FR-009 (research.md D4): the referenced version belongs to this article
  -- and can never be deleted
  FOREIGN KEY (id, last_published_version_id)
    REFERENCES article_versions (article_id, id)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS article_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL REFERENCES articles (id),
  version_number INTEGER NOT NULL CHECK (version_number >= 1),
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  body TEXT NOT NULL,
  tags TEXT NOT NULL CHECK (json_valid(tags) AND json_type(tags) = 'array'),
  created_at TEXT NOT NULL,
  UNIQUE (article_id, version_number),
  UNIQUE (article_id, id)
);

-- Triggers (research.md D5)

-- FR-014: a published version never changes
CREATE TRIGGER IF NOT EXISTS article_versions_no_update
BEFORE UPDATE ON article_versions
BEGIN
  SELECT RAISE(ABORT, 'VERSION_IMMUTABLE');
END;

-- FR-005: the first publish date never changes once set
CREATE TRIGGER IF NOT EXISTS articles_published_at_fixed
BEFORE UPDATE OF published_at ON articles
WHEN OLD.published_at IS NOT NULL AND NEW.published_at IS NOT OLD.published_at
BEGIN
  SELECT RAISE(ABORT, 'PUBLISHED_AT_IMMUTABLE');
END;

-- FR-015: an article never goes back to draft
CREATE TRIGGER IF NOT EXISTS articles_no_return_to_draft
BEFORE UPDATE OF status ON articles
WHEN OLD.status <> 'draft' AND NEW.status = 'draft'
BEGIN
  SELECT RAISE(ABORT, 'NO_RETURN_TO_DRAFT');
END;

-- FR-010: every draft change increases draft_version by exactly one
CREATE TRIGGER IF NOT EXISTS articles_draft_version_step
BEFORE UPDATE ON articles
WHEN (NEW.draft_title IS NOT OLD.draft_title
      OR NEW.draft_body IS NOT OLD.draft_body
      OR NEW.draft_tags IS NOT OLD.draft_tags)
  AND NEW.draft_version IS NOT OLD.draft_version + 1
BEGIN
  SELECT RAISE(ABORT, 'DRAFT_VERSION_STEP');
END;

-- FR-002: the slug never changes after creation
CREATE TRIGGER IF NOT EXISTS articles_slug_fixed
BEFORE UPDATE OF slug ON articles
WHEN NEW.slug IS NOT OLD.slug
BEGIN
  SELECT RAISE(ABORT, 'SLUG_IMMUTABLE');
END;
