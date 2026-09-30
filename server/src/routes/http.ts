/**
 * Request/response validation helpers. Every route parses its input with the
 * shared schema and validates its output before sending, so a contract bug on
 * either side shows up as a clear 400/500 instead of a confusing client crash.
 */
import type { ErrorResponse } from '@eduway/shared';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

/** Thrown inside handlers to send a specific status with an ErrorResponse body. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

/** Parse request input or throw a 400 with the zod issues. */
export function parseInput<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new HttpError(400, 'Invalid request', parsed.error.issues);
  return parsed.data;
}

/** Validate a response against its schema, then send it. Invalid output is a server bug (500). */
export function sendValid<S extends z.ZodType>(
  res: Response,
  schema: S,
  body: z.infer<S>,
  status = 200,
) {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(500, 'Server produced an invalid response', parsed.error.issues);
  }
  res.status(status).json(parsed.data);
}

/** Final Express error handler: always answers with the shared ErrorResponse shape. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const status = err instanceof HttpError ? err.status : 500;
  const body: ErrorResponse = {
    error: err instanceof Error ? err.message : 'Internal error',
    ...(err instanceof HttpError && err.details !== undefined ? { details: err.details } : {}),
  };
  if (status >= 500) console.error(err);
  res.status(status).json(body);
}
