import { z } from 'zod';
import { notFound, validationError } from '../services/errors.js';

// Request schemas (contracts/api.md). All schemas are strict: unknown fields
// such as `slug` on save draft are refused with VALIDATION_ERROR (FR-002).

const expectedDraftVersion = z.number().int().min(1);

export const createSchema = z.strictObject({
  title: z.string(),
  slug: z.string(),
  body: z.string().default(''),
  tags: z.array(z.string()).default([]),
});

export const draftSchema = z.strictObject({
  title: z.string(),
  body: z.string(),
  tags: z.array(z.string()),
  expectedDraftVersion,
});

export const expectedVersionSchema = z.strictObject({
  expectedDraftVersion,
});

// Validates a request body; any problem becomes VALIDATION_ERROR with a message.
export function parseBody<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    const message = result.error.issues
      .map((i) => `${i.path.length > 0 ? i.path.join('.') : 'body'}: ${i.message}`)
      .join('; ');
    throw validationError(message);
  }
  return result.data;
}

// Article ids and version numbers are positive integers; anything else is unknown.
export function parseNumberParam(value: string | undefined): number {
  if (value === undefined || !/^[1-9]\d*$/.test(value)) {
    throw notFound();
  }
  return Number(value);
}
