/**
 * Small helpers shared by every contract in this folder.
 * PROTECTED CONTRACT (see root CLAUDE.md).
 */

/** Call to stop receiving updates. Always safe to call more than once. */
export type Unsubscribe = () => void;

/** A listener registry most modules expose: subscribe(cb) → Unsubscribe. */
export interface Subscribable<T> {
  subscribe(listener: (value: T) => void): Unsubscribe;
}
