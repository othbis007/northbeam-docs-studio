# Feature Specification: Article Lifecycle

**Feature Branch**: `main` (no feature branch)

**Created**: 2026-11-23

**Status**: Draft

**Input**: User description: "Why: internal writers need to rework documentation pages freely without
customers seeing half-finished text, and they need a safety net when a
publish goes wrong. So the text a writer is working on (the draft) and the
text readers see (a published version) must be two separate things.
Publishing takes a frozen copy of the draft. Editing never touches it.
Users:
- Writer: one trusted internal person, no login.
- Reader: anyone on the public site, anonymous.
What the writer can do:
- Create an article with a title, a slug, a Markdown body and tags.
It starts as a draft that readers cannot see.
- Edit the draft as often as needed without changing what readers see.
- Publish the draft: this creates the next numbered version (1, 2, 3...)
and makes it the one readers see. The first publish date is recorded
once and never changes on later publishes.
- Unpublish: readers lose access, but the last published version and the
first publish date are kept.
- See all versions of an article, newest first, and open any of them.
- Restore a version: its content replaces the draft. Nothing is published
and no version is added or removed.
- Delete a version that is not the one the article refers to.
What the reader can do:
- List published articles with title, tags and first publish date.
- Read one article by its slug, always from its published version,
never from the draft.
- Anything not currently published behaves as if it does not exist.
Rules that must always hold:
- A published version never changes.
- The article's status and the version it refers to always change
together, all or nothing, even after a crash or two requests at once.
- The version an article refers to can never be deleted.
- Restoring never adds or removes versions.
- If two people edit the same draft, the one with the outdated copy is
refused with a clear message instead of overwriting the other.
- Unpublishing never loses what was published.
Bonus (low priority):
- Publishing again without any change does not create an identical
version; an unpublished article simply becomes visible again.
- If the slug is already taken, use the next free suffix (-2, -3...)
and tell the writer the final slug.
Not included: login and roles, multiple customers, rich Markdown
components, visual editor, file uploads, search, large pagination,
caching, deployment."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create, publish and read an article (Priority: P1)

The writer creates an article (title, slug, Markdown body, tags). It starts as a
draft that readers cannot see. The writer publishes it: version 1 is created and
becomes what readers see. Readers find it in the public list and read it by its slug.

**Why this priority**: Without it, nothing reaches readers. It is the smallest slice
that delivers value.

**Independent Test**: Create an article, check readers cannot see it, publish it,
check readers can list it and read it by slug.

**Acceptance Scenarios**:

1. **Given** no article, **When** the writer creates one, **Then** it exists as a
   draft and readers get "not found" for its slug and do not see it in the list.
2. **Given** a draft article never published, **When** the writer publishes it,
   **Then** version 1 is created, the article is published, it refers to version 1,
   and the first publish date is recorded.
3. **Given** a published article, **When** a reader lists articles, **Then** it
   appears with its title, tags and first publish date.
4. **Given** a published article, **When** a reader opens it by slug, **Then** the
   content shown is the content of the version it refers to.

---

### User Story 2 - Edit the draft safely (Priority: P1)

The writer edits the draft as often as needed. Readers keep seeing the published
version until the next publish. If two people edit the same draft, the one working
from an outdated copy is refused with a clear message.

**Why this priority**: Separating draft and published content is the reason this
feature exists.

**Independent Test**: Publish, edit the draft, check readers still see the published
content; send an edit from an outdated copy and check it is refused.

**Acceptance Scenarios**:

1. **Given** a published article, **When** the writer edits the draft, **Then**
   readers still see the content of the version the article refers to.
2. **Given** a published article with an edited draft, **When** the writer publishes,
   **Then** the next numbered version is created, readers see it, and the first
   publish date is unchanged.
3. **Given** two people with the same copy of a draft, **When** the first saves and
   then the second saves, **Then** the second is refused with a clear message and
   the first one's changes are kept.
4. **Given** any article, **When** the writer tries to change its slug, **Then** the
   change is refused (the slug is fixed after creation).

---

### User Story 3 - Unpublish (Priority: P2)

The writer unpublishes an article. Readers lose access, but the last published
version and the first publish date are kept.

**Why this priority**: Needed to take content offline without losing anything.

**Independent Test**: Publish, unpublish, check readers get "not found", check the
version and first publish date still exist, publish again and check readers see it.

**Acceptance Scenarios**:

1. **Given** a published article, **When** the writer unpublishes it, **Then**
   readers get "not found" for its slug and it is absent from the list.
2. **Given** an unpublished article, **When** the writer looks at it, **Then** the
   last published version, the version it refers to and the first publish date are
   unchanged.
3. **Given** an unpublished article, **When** the writer publishes it, **Then** the
   first publish date is unchanged.

---

### User Story 4 - Version history, restore and delete (Priority: P2)

The writer sees all versions of an article, newest first, and opens any of them.
The writer can restore a version (its content replaces the draft) or delete a
version that is not the one the article refers to.

**Why this priority**: This is the safety net when a publish goes wrong.

**Independent Test**: Publish several times, list versions, open one, restore it,
delete another, try to delete the referenced one.

**Acceptance Scenarios**:

1. **Given** an article with versions 1, 2 and 3, **When** the writer lists versions,
   **Then** they appear in the order 3, 2, 1.
2. **Given** an article with several versions, **When** the writer opens one,
   **Then** its title, body and tags are shown as they were when published.
3. **Given** an article with several versions, **When** the writer restores
   version 1, **Then** the draft takes version 1's content, nothing is published,
   readers see no change, and the list of versions is identical.
4. **Given** an article that refers to version 3, **When** the writer deletes
   version 1, **Then** version 1 is removed and the others are unchanged.
5. **Given** an article that refers to version 3, **When** the writer tries to
   delete version 3, **Then** the deletion is refused with a clear message, whether
   the article is published or unpublished.

---

### User Story 5 - Publish without changes (Priority: P3)

When the draft has no change since the version the article refers to, publishing
does not create an identical version. An unpublished article simply becomes visible
again.

**Why this priority**: Bonus, low priority.

**Independent Test**: Publish, publish again without editing, check the number of
versions is unchanged; unpublish, publish without editing, check readers see it
again and no version was added.

**Acceptance Scenarios**:

1. **Given** a published article whose draft is unchanged, **When** the writer
   publishes, **Then** no version is created.
2. **Given** an unpublished article whose draft is unchanged, **When** the writer
   publishes, **Then** no version is created and readers can see it again.

---

### User Story 6 - Slug already taken (Priority: P3)

When the writer creates an article with a slug already in use, the next free
suffix (-2, -3...) is used and the writer is told the final slug.

**Why this priority**: Bonus, low priority.

**Independent Test**: Create two articles with the same slug and check the second
gets the "-2" suffix and the writer is told.

**Acceptance Scenarios**:

1. **Given** an article with slug "guide", **When** the writer creates another with
   slug "guide", **Then** it gets slug "guide-2" and the writer is told "guide-2".
2. **Given** articles with slugs "guide" and "guide-2", **When** the writer creates
   another with slug "guide", **Then** it gets slug "guide-3".

---

### Edge Cases

- A crash happens during a publish: afterwards, either the publish fully happened
  (new version exists, article published and referring to it) or nothing changed.
- Two publish requests arrive at once: every version number stays unique, and the
  article's status and the version it refers to are consistent.
- A reader asks for a slug that is draft-only, unpublished, or does not exist: the
  answer is the same "not found" in all three cases.
- A version is restored while someone else holds an older copy of the draft: that
  person's next save is refused.
- The writer unpublishes an article that was never published: refused with a clear
  message (A6).
- The writer tries to delete the version the article refers to after unpublishing:
  refused.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The writer MUST be able to create an article with a title, a slug, a
  Markdown body and tags; it starts as a draft.
- **FR-002**: The slug MUST NOT change after creation.
- **FR-003**: The writer MUST be able to edit the draft (title, body, tags) any
  number of times without changing what readers see.
- **FR-004**: Publishing MUST create the next numbered version (1, 2, 3...) from the
  draft content and make the article published and referring to that version.
- **FR-005**: The first publish date MUST be recorded on the first publish and MUST
  NOT change on later publishes or unpublishes.
- **FR-006**: Unpublishing MUST make the article invisible to readers while keeping
  the version it refers to and the first publish date.
- **FR-007**: The writer MUST be able to list all versions of an article, newest
  first, and open any of them.
- **FR-008**: Restoring a version MUST replace the draft with that version's content,
  MUST NOT publish, and MUST NOT add or remove any version.
- **FR-009**: The writer MUST be able to delete a version that is not the one the
  article refers to; deleting the referenced version MUST be refused with a clear
  message.
- **FR-010**: A save based on an outdated copy of the draft MUST be refused with a
  clear message, and MUST NOT overwrite the current draft.
- **FR-011**: Readers MUST be able to list published articles with title, tags and
  first publish date.
- **FR-012**: Readers MUST be able to read a published article by its slug, always
  from the version it refers to, never from the draft.
- **FR-013**: Any article that is not currently published MUST be reported to
  readers as not found, exactly like a slug that does not exist.
- **FR-014**: A published version MUST NEVER change.
- **FR-015**: The article's status and the version it refers to MUST always change
  together, all or nothing, including after a crash or with concurrent requests.
- **FR-016** (P3): Publishing a draft identical to the referenced version MUST NOT
  create a new version; if the article is unpublished, it becomes published again.
- **FR-017** (P3): Creating an article with a slug already in use MUST use the next
  free suffix (-2, -3...) and tell the writer the final slug.

### Key Entities

- **Article**: a documentation page. Has a fixed slug, a status (draft, published,
  unpublished), a draft (title, Markdown body, tags), the version it refers to (none
  before the first publish), and a first publish date (none before the first
  publish).
- **Version**: a frozen copy of the draft taken at publish time. Belongs to one
  article, has a number unique within that article, and a title, body and tags that
  never change.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 0 cases where the content of a published version changes, whatever
  edits, restores or publishes follow.
- **SC-002**: 0 observable states where the article's status and the version it
  refers to disagree, including after an interrupted publish and with two
  simultaneous requests.
- **SC-003**: 100% of attempts to delete the version an article refers to are refused.
- **SC-004**: 100% of restores leave the list of versions identical (same count,
  same numbers, same content).
- **SC-005**: 100% of saves based on an outdated copy of the draft are refused with a
  clear message, and the current draft is unchanged.
- **SC-006**: After any unpublish, the last published version and the first publish
  date are still available to the writer in 100% of cases.
- **SC-007**: 0 cases where a reader sees draft content, and 100% of non-published
  articles are reported as not found.

## Assumptions

- A1: One writer, but two sessions (for example two browser tabs) can edit the same
  draft at the same time.
- A2: Title and slug are required at creation; body and tags may be empty.
- A3: A slug contains only lowercase letters, digits and hyphens.
- A4: The public list is ordered by first publish date, newest first.
- A5: A version holds title, body and tags; the slug is not part of a version since
  it never changes.
- A6: Unpublishing an article that was never published is refused with a clear
  message.
- Out of scope: login and roles, multiple customers, rich Markdown components,
  visual editor, file uploads, search, large pagination, caching, deployment.
