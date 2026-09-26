/**
 * Module boundaries for the mobile app. Code against these interfaces, never
 * against another module's internals. PROTECTED CONTRACT (see root CLAUDE.md).
 */
export type * from './common';
export type * from './detection';
export type * from './road';
export type * from './voice';
export type * from './trip';
export * from './api'; // also exports the ApiError class (a runtime value)
