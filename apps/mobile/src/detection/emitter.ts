/**
 * Minimal listener registry used to implement `Subscribable`. Pure.
 * Each module keeps its own copy so workstreams never import each other's internals.
 */
import type { Unsubscribe } from '../contracts';

export interface Emitter<T> {
  emit(value: T): void;
  subscribe(listener: (value: T) => void): Unsubscribe;
}

export function createEmitter<T>(): Emitter<T> {
  const listeners = new Set<(value: T) => void>();
  return {
    emit(value) {
      for (const l of listeners) l(value);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
