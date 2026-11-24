import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { memoryDb } from '../helpers/db.js';
import { createApp } from '../../server/app.js';

// contracts/api.md: reader endpoints. FR-011, FR-012, FR-013.

let app: Express;

beforeEach(() => {
  app = createApp(memoryDb());
});

async function create(slug: string, title = slug) {
  const res = await request(app).post('/api/articles').send({ title, slug, body: `Body of ${slug}`, tags: ['t'] });
  return res.body as { id: number; draftVersion: number };
}

async function publish(id: number, expectedDraftVersion: number) {
  return request(app).post(`/api/articles/${id}/publish`).send({ expectedDraftVersion });
}

describe('GET /api/public/articles', () => {
  it('lists only published articles with slug, title, tags and first publish date', async () => {
    const a = await create('published');
    await publish(a.id, a.draftVersion);
    await create('draft-only');

    const res = await request(app).get('/api/public/articles');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(Object.keys(res.body[0]).sort()).toEqual(['publishedAt', 'slug', 'tags', 'title']);
    expect(res.body[0]).toMatchObject({ slug: 'published', title: 'published', tags: ['t'] });
  });
});

describe('GET /api/public/articles/:slug', () => {
  it('returns the referenced version, never the draft, and no draft fields', async () => {
    const a = await create('guide', 'Published title');
    await publish(a.id, a.draftVersion);
    await request(app)
      .put(`/api/articles/${a.id}/draft`)
      .send({ title: 'Draft title', body: 'Draft body', tags: [], expectedDraftVersion: 1 });

    const res = await request(app).get('/api/public/articles/guide');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['body', 'publishedAt', 'slug', 'tags', 'title']);
    expect(res.body).toMatchObject({ title: 'Published title', body: 'Body of guide' });
  });

  it('returns 404 with no body for draft-only, unpublished and unknown slugs (FR-013)', async () => {
    await create('draft-only');
    const b = await create('gone');
    await publish(b.id, b.draftVersion);
    await request(app).post(`/api/articles/${b.id}/unpublish`);

    for (const slug of ['draft-only', 'gone', 'does-not-exist']) {
      const res = await request(app).get(`/api/public/articles/${slug}`);
      expect(res.status).toBe(404);
      expect(res.text).toBe('');
    }
  });
});
