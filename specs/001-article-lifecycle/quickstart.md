# Quickstart: Article Lifecycle

## Prerequisites

- Node 20 and npm

## Setup and run

```text
npm install       # install dependencies, then create data/northbeam.db and apply the schema
npm run dev       # compile the server, start the API and the UI on one port
npm test          # run all tests (Vitest + Supertest)
```

## Validation scenarios

Endpoints are described in [contracts/api.md](./contracts/api.md); rules in
[data-model.md](./data-model.md).

1. **Draft is invisible**: create an article → `GET /api/public/articles/:slug` returns
   `404` with no body; it is absent from the public list.
2. **First publish**: publish → version 1 exists, status `published`, `publishedAt` set;
   the reader sees version 1.
3. **Editing does not change what readers see**: save the draft → the reader still sees
   version 1.
4. **Republish**: publish → version 2, `publishedAt` unchanged, the reader sees version 2.
5. **Outdated copy**: save, publish or restore with an old `expectedDraftVersion` →
   `409 STALE_DRAFT` with the current draft; nothing changed.
6. **Unpublish**: unpublish → reader gets `404`; versions and `publishedAt` kept;
   unpublishing again → `409 ARTICLE_NOT_PUBLISHED`.
7. **History**: list versions → newest first; open version 1.
8. **Restore**: restore version 1 → draft has version 1's content; versions unchanged;
   reader sees no change.
9. **Delete**: delete version 1 → `204`; delete the referenced version →
   `409 LIVE_VERSION_DELETE_FORBIDDEN`, also after unpublish.
10. **Persistence**: stop and restart `npm run dev` → all data is still there.
11. **Bonus**: publish without changes → no new version; create a second article with the
    same slug → it gets `-2` and the final slug is returned.

Each scenario maps to automated tests run by `npm test`.
