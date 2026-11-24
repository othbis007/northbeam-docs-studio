import { Router } from 'express';
import type { ArticleService } from '../services/articleService.js';
import { createSchema, parseBody, parseNumberParam } from './schemas.js';

// Writer routes (contracts/api.md). Routes only validate input; every rule is
// decided in articleService.

export function writerRoutes(service: ArticleService): Router {
  const router = Router();

  // T037: create, list, get
  router.post('/', (req, res) => {
    const input = parseBody(createSchema, req.body);
    res.status(201).json(service.create(input));
  });

  router.get('/', (_req, res) => {
    res.json(service.list());
  });

  router.get('/:id', (req, res) => {
    res.json(service.get(parseNumberParam(req.params.id)));
  });

  return router;
}
