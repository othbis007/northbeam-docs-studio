import { Router } from 'express';
import type { ArticleService } from '../services/articleService.js';

// Reader routes (contracts/api.md): only the referenced version of published
// articles; anything else is 404 with no body (FR-011, FR-012, FR-013).

export function publicRoutes(service: ArticleService): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json(service.listPublic());
  });

  router.get('/:slug', (req, res) => {
    res.json(service.getPublic(req.params.slug));
  });

  return router;
}
