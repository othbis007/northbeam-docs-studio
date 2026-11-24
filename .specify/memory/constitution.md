<!--
Sync Impact Report
- Version change: (template, unversioned) → 1.0.0
- Modified principles: placeholders replaced by:
  I. Published Content Is Frozen
  II. The Database Is the Last Line of Defense
  III. Invariants Are Proven by Automated Tests
  IV. Fail Loudly
  V. Small and Runnable
- Added sections: Lifecycle & Data Constraints; Development Workflow & Quality Gates; Governance
- Removed sections: none
- Deferred TODOs: none
-->
# Northbeam Docs Studio Constitution

## Core Principles

### I. Published Content Is Frozen

- Once a version is published, its content MUST NOT be changed by anyone.
- Writers MUST only change the draft.
- Every publish MUST create a new version; publishing MUST NOT edit an existing version.

**Rationale**: Published content is a fixed record. A new version is always added;
an old one is never rewritten.

### II. The Database Is the Last Line of Defense

- Every lifecycle rule MUST be enforced by the database itself, using constraints,
  foreign keys, triggers, and transactions.
- Application code MAY also check these rules, but MUST NOT be the only place they
  are enforced.
- The UI MUST NEVER be the only place a lifecycle rule is enforced.

**Rationale**: If application code or the UI has a bug, or is bypassed, the database
still refuses data that breaks a lifecycle rule.

### III. Invariants Are Proven by Automated Tests

- Every rule that must always hold MUST be proven by an automated test.
- All tests MUST run with one command.
- Lifecycle tests take priority over UI tests.

**Rationale**: A rule that is not tested is not guaranteed. The lifecycle is the core
of the product, so its tests come first.

### IV. Fail Loudly

- An operation that is not safe MUST be rejected with a clear error code.
- Data MUST NOT be silently overwritten.
- Content that is not public MUST be reported as not found.

**Rationale**: Explicit failures are visible and diagnosable. Reporting non-public
content as not found does not reveal that it exists.

### V. Small and Runnable

- The project MUST run from a fresh clone with one setup command.
- Data MUST be kept across restarts.
- The project MUST use few dependencies.
- Work outside the agreed scope MUST NOT be built.

**Rationale**: A small project that always runs is easier to verify, review, and keep
correct.

## Lifecycle & Data Constraints

- A published version is immutable at the database level (Principles I and II).
- Writes on a draft and the creation of a new version on publish MUST happen inside
  transactions, so an operation either fully succeeds or is fully rejected
  (Principles II and IV).
- A write that would overwrite data without the writer intending it MUST be rejected
  with a clear error code, not merged or replaced silently (Principle IV).
- Any read of content that is not public MUST return not found (Principle IV).
- Stored data MUST survive a restart of the project (Principle V).

## Development Workflow & Quality Gates

- Every new lifecycle rule MUST come with: its enforcement in the database and an
  automated test proving it holds (Principles II and III).
- A change MUST NOT be accepted if the single test command does not pass
  (Principle III).
- A change MUST NOT be accepted if the project can no longer run from a fresh clone
  with the single setup command (Principle V).
- Adding a dependency MUST be justified; work outside the agreed scope MUST NOT be
  started (Principle V).

## Governance

- This constitution takes precedence over every other practice in the project.
- Any amendment MUST be written down in this file, with an updated version and
  Last Amended date.
- Versioning follows semantic versioning:
  - MAJOR: a principle is removed or redefined in an incompatible way.
  - MINOR: a principle or section is added, or guidance is materially expanded.
  - PATCH: clarifications, wording, or typo fixes with no change in meaning.
- Every specification, plan, and change MUST be checked against these principles.
  Any deviation MUST be justified explicitly, or the change is rejected.

**Version**: 1.0.0 | **Ratified**: 2026-11-23 | **Last Amended**: 2026-11-23
