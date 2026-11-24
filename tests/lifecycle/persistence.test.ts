import { describe, it, expect } from 'vitest';
import { fileDb } from '../helpers/db.js';
import { createArticleService } from '../../server/services/articleService.js';

// Constitution, principle V: data is kept across restarts.

describe('persistence across restarts (constitution V)', () => {
  it('keeps articles, versions and the first publish date after close and reopen', () => {
    const { open } = fileDb();
    let db = open();
    let service = createArticleService(db);
    const a = service.create({ title: 'Guide', slug: 'guide', body: 'Hello', tags: ['x'] });
    const published = service.publish(a.id, a.draftVersion);
    const versions = service.listVersions(a.id);
    db.close();

    db = open();
    service = createArticleService(db);
    expect(service.get(a.id)).toEqual(published);
    expect(service.listVersions(a.id)).toEqual(versions);
    expect(service.getPublic('guide').body).toBe('Hello');
    db.close();
  });
});
