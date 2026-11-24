import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { memoryDb } from '../helpers/db.js';
import { createApp } from '../../server/app.js';

// contracts/api.md: writer endpoints, status codes and error bodies.

let app: Express;

beforeEach(() => {
  app = createApp(memoryDb());
});

async function createArticle(slug = 'guide', title = 'Guide') {
  const res = await request(app).post('/api/articles').send({ title, slug, body: 'Hello', tags: ['a'] });
  expect(res.status).toBe(201);
  return res.body as { id: number; draftVersion: number };
}

describe('POST /api/articles', () => {
  it('creates a draft and returns 201 with the final slug', async () => {
    const res = await request(app).post('/api/articles').send({ title: 'Guide', slug: 'guide', body: '', tags: [] });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ slug: 'guide', status: 'draft', draftVersion: 1 });
  });

  it('returns 400 VALIDATION_ERROR with a message for a missing title or a bad slug', async () => {
    for (const payload of [
      { slug: 'guide', body: '', tags: [] },
      { title: '', slug: 'guide', body: '', tags: [] },
      { title: 'T', slug: 'Bad Slug', body: '', tags: [] },
    ]) {
      const res = await request(app).post('/api/articles').send(payload);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
      expect(res.body.message).toEqual(expect.any(String));
    }
  });

  it('returns 400 VALIDATION_ERROR for unknown fields and invalid JSON', async () => {
    const extra = await request(app).post('/api/articles').send({ title: 'T', slug: 'guide', body: '', tags: [], extra: 1 });
    expect(extra.status).toBe(400);
    expect(extra.body.error).toBe('VALIDATION_ERROR');
    const bad = await request(app).post('/api/articles').set('Content-Type', 'application/json').send('{not json');
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe('VALIDATION_ERROR');
  });

  it('returns 201 with the suffixed final slug when the slug is already used (bonus, FR-017)', async () => {
    await createArticle('guide');
    const res = await request(app).post('/api/articles').send({ title: 'Other', slug: 'guide', body: '', tags: [] });
    expect(res.status).toBe(201);
    expect(res.body.slug).toBe('guide-2');
  });
});

describe('GET /api/articles and /api/articles/:id', () => {
  it('lists articles and returns one article', async () => {
    const a = await createArticle();
    const list = await request(app).get('/api/articles');
    expect(list.status).toBe(200);
    expect(list.body).toEqual([{ id: a.id, slug: 'guide', status: 'draft', title: 'Guide' }]);
    const one = await request(app).get(`/api/articles/${a.id}`);
    expect(one.status).toBe(200);
    expect(one.body).toMatchObject({ id: a.id, title: 'Guide', body: 'Hello', tags: ['a'] });
  });

  it('returns 404 with no body for an unknown id', async () => {
    for (const path of ['/api/articles/999', '/api/articles/abc']) {
      const res = await request(app).get(path);
      expect(res.status).toBe(404);
      expect(res.text).toBe('');
    }
  });
});

describe('PUT /api/articles/:id/draft', () => {
  it('saves the draft', async () => {
    const a = await createArticle();
    const res = await request(app)
      .put(`/api/articles/${a.id}/draft`)
      .send({ title: 'New', body: 'B', tags: [], expectedDraftVersion: a.draftVersion });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: 'New', draftVersion: 2 });
  });

  it('returns 400 VALIDATION_ERROR when a slug is sent (FR-002)', async () => {
    const a = await createArticle();
    const res = await request(app)
      .put(`/api/articles/${a.id}/draft`)
      .send({ title: 'New', body: 'B', tags: [], slug: 'other', expectedDraftVersion: a.draftVersion });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect((await request(app).get(`/api/articles/${a.id}`)).body.slug).toBe('guide');
  });

  it('returns 409 STALE_DRAFT with the current draft for an outdated copy', async () => {
    const a = await createArticle();
    await request(app).put(`/api/articles/${a.id}/draft`).send({ title: 'First', body: 'B', tags: [], expectedDraftVersion: 1 });
    const res = await request(app)
      .put(`/api/articles/${a.id}/draft`)
      .send({ title: 'Second', body: 'C', tags: [], expectedDraftVersion: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('STALE_DRAFT');
    expect(res.body.message).toEqual(expect.any(String));
    expect(res.body.draft).toEqual({ title: 'First', body: 'B', tags: [], draftVersion: 2 });
  });
});

describe('publish and unpublish', () => {
  it('publishes and returns the version number', async () => {
    const a = await createArticle();
    const res = await request(app).post(`/api/articles/${a.id}/publish`).send({ expectedDraftVersion: a.draftVersion });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'published', lastPublishedVersionNumber: 1 });
  });

  it('returns 409 STALE_DRAFT when publishing from an outdated copy', async () => {
    const a = await createArticle();
    await request(app).put(`/api/articles/${a.id}/draft`).send({ title: 'X', body: '', tags: [], expectedDraftVersion: 1 });
    const res = await request(app).post(`/api/articles/${a.id}/publish`).send({ expectedDraftVersion: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('STALE_DRAFT');
  });

  it('returns 409 ARTICLE_NOT_PUBLISHED when unpublishing an article that is not published', async () => {
    const a = await createArticle();
    const res = await request(app).post(`/api/articles/${a.id}/unpublish`);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('ARTICLE_NOT_PUBLISHED');
    expect(res.body.message).toEqual(expect.any(String));
  });

  it('unpublishes a published article', async () => {
    const a = await createArticle();
    await request(app).post(`/api/articles/${a.id}/publish`).send({ expectedDraftVersion: 1 });
    const res = await request(app).post(`/api/articles/${a.id}/unpublish`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('unpublished');
  });
});

describe('versions: list, get, restore, delete', () => {
  async function publishTwice() {
    const a = await createArticle();
    await request(app).post(`/api/articles/${a.id}/publish`).send({ expectedDraftVersion: 1 });
    await request(app).put(`/api/articles/${a.id}/draft`).send({ title: 'Two', body: '2', tags: [], expectedDraftVersion: 1 });
    await request(app).post(`/api/articles/${a.id}/publish`).send({ expectedDraftVersion: 2 });
    return a.id;
  }

  it('lists versions newest first and returns one version', async () => {
    const id = await publishTwice();
    const list = await request(app).get(`/api/articles/${id}/versions`);
    expect(list.status).toBe(200);
    expect(list.body.map((v: { number: number }) => v.number)).toEqual([2, 1]);
    const v1 = await request(app).get(`/api/articles/${id}/versions/1`);
    expect(v1.status).toBe(200);
    expect(v1.body).toMatchObject({ number: 1, title: 'Guide', body: 'Hello', tags: ['a'] });
    const missing = await request(app).get(`/api/articles/${id}/versions/9`);
    expect(missing.status).toBe(404);
    expect(missing.text).toBe('');
  });

  it('restores a version into the draft', async () => {
    const id = await publishTwice();
    const res = await request(app).post(`/api/articles/${id}/versions/1/restore`).send({ expectedDraftVersion: 2 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: 'Guide', draftVersion: 3, lastPublishedVersionNumber: 2 });
  });

  it('returns 409 STALE_DRAFT when restoring from an outdated copy', async () => {
    const id = await publishTwice();
    const res = await request(app).post(`/api/articles/${id}/versions/1/restore`).send({ expectedDraftVersion: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('STALE_DRAFT');
  });

  it('deletes a non-referenced version with 204 and refuses the referenced one with 409', async () => {
    const id = await publishTwice();
    const del = await request(app).delete(`/api/articles/${id}/versions/1`);
    expect(del.status).toBe(204);
    const live = await request(app).delete(`/api/articles/${id}/versions/2`);
    expect(live.status).toBe(409);
    expect(live.body.error).toBe('LIVE_VERSION_DELETE_FORBIDDEN');
    expect(live.body.message).toEqual(expect.any(String));
  });
});
