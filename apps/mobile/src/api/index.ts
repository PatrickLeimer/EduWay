/**
 * api/ public API (WS3). Other modules and ui/ import from here only.
 * Contract: ../contracts/api.ts
 */
export { createHttpApiClient } from './HttpApiClient';
export { createMockApiClient } from './mocks';
export { API_BASE_URL } from './config';
export { encodeTrace, decodeTrace } from './traceCodec';
export { useApiQuery, type ApiQuery } from './useApiQuery';
