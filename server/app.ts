import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import type { Db } from './db/connection.js';
import { AppError } from './services/errors.js';
import { createArticleService } from './services/articleService.js';
import { writerRoutes } from './routes/writer.js';
import { publicRoutes } from './routes/public.js';

// Express app: JSON bodies, routes, and the mapping from lifecycle errors to
// HTTP responses (contracts/api.md).

function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    switch (err.code) {
      case 'NOT_FOUND':
        res.status(404).end();
        return;
      case 'VALIDATION_ERROR':
        res.status(400).json({ error: err.code, message: err.message });
        return;
      case 'STALE_DRAFT':
        res.status(409).json({ error: err.code, message: err.message, draft: err.draft });
        return;
      default:
        res.status(409).json({ error: err.code, message: err.message });
        return;
    }
  }
  // Malformed JSON body (express.json).
  if ((err as { type?: string }).type === 'entity.parse.failed') {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: 'The request body is not valid JSON.' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Unexpected server error.' });
}

export function createApp(db: Db): Express {
  const service = createArticleService(db);
  const app = express();
  app.use(express.json());

  app.use('/api/articles', writerRoutes(service));
  app.use('/api/public/articles', publicRoutes(service));

  // Unknown API paths: 404 with no body.
  app.use('/api', (_req, res) => {
    res.status(404).end();
  });
  app.use(errorHandler);
  return app;
}
