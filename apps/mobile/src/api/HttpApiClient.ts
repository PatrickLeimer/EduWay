/**
 * Real ApiClient over fetch (WS3). Thin transport only: builds the request,
 * validates the response with the shared zod schema, maps failures to ApiError.
 *
 * TODO(WS3): request timeout (AbortController), retry policy for createTrip,
 * and wiring the offline queue retry through trip/ (§4 "Offline").
 */
import {
  API_ROUTES,
  AskResponseSchema,
  CreateTripResponseSchema,
  ErrorResponseSchema,
  GetProgressResponseSchema,
  GetTraceResponseSchema,
  GetTripResponseSchema,
  ListTripsResponseSchema,
} from '@edudriver/shared';
import type { z } from 'zod';

import { ApiError, type ApiClient } from '../contracts';

import { API_BASE_URL } from './config';

export function createHttpApiClient(baseUrl: string = API_BASE_URL): ApiClient {
  async function request<S extends z.ZodType>(
    schema: S,
    path: string,
    init?: { method: 'POST'; body: unknown },
  ): Promise<z.infer<S>> {
    let res: Response;
    try {
      res = await fetch(baseUrl + path, {
        method: init?.method ?? 'GET',
        headers: init ? { 'Content-Type': 'application/json' } : undefined,
        body: init ? JSON.stringify(init.body) : undefined,
      });
    } catch (e) {
      throw new ApiError(`Network error calling ${path}`, null, e);
    }
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const err = ErrorResponseSchema.safeParse(json);
      throw new ApiError(err.success ? err.data.error : `HTTP ${res.status}`, res.status, json);
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new ApiError(`Invalid response from ${path}`, null, parsed.error.issues);
    }
    return parsed.data;
  }

  const q = (userId: string) => `?userId=${encodeURIComponent(userId)}`;

  return {
    createTrip: (req) =>
      request(CreateTripResponseSchema, API_ROUTES.createTrip, { method: 'POST', body: req }),
    listTrips: (userId) => request(ListTripsResponseSchema, API_ROUTES.listTrips + q(userId)),
    getTrip: (id) => request(GetTripResponseSchema, API_ROUTES.getTrip(id)),
    getTrace: (id) => request(GetTraceResponseSchema, API_ROUTES.getTrace(id)),
    getProgress: (userId) => request(GetProgressResponseSchema, API_ROUTES.getProgress + q(userId)),
    ask: (userId, question) =>
      request(AskResponseSchema, API_ROUTES.ask, { method: 'POST', body: { userId, question } }),
  };
}
