/**
 * Tiny data-fetching hook for screens: runs `load` whenever `key` changes (or
 * reload() is called) and exposes data, error and loading. Screens use this
 * instead of their own fetch/useEffect (root CLAUDE.md: no logic in ui/).
 *
 * `key` identifies the request, e.g. `trip:${id}`. Change it to refetch.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface ApiQuery<T> {
  /** Last successful result for this key; kept while a reload() is in flight. */
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

interface Settled<T> {
  key: string;
  requestKey: string;
  data: T | null;
  error: string | null;
}

export function useApiQuery<T>(key: string, load: () => Promise<T>): ApiQuery<T> {
  const [nonce, setNonce] = useState(0);
  const requestKey = `${key}#${nonce}`;
  const [settled, setSettled] = useState<Settled<T> | null>(null);

  // Always call the latest `load` without making it an effect dependency.
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    let cancelled = false;
    loadRef.current().then(
      (data) => {
        if (!cancelled) setSettled({ key, requestKey, data, error: null });
      },
      (e: unknown) => {
        if (!cancelled) {
          setSettled((prev) => ({
            key,
            requestKey,
            data: prev?.key === key ? prev.data : null,
            error: e instanceof Error ? e.message : String(e),
          }));
        }
      },
    );
    return () => {
      cancelled = true;
    };
    // `key` is part of requestKey; listing both keeps the hooks lint rule satisfied.
  }, [key, requestKey]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const fresh = settled?.requestKey === requestKey;

  return {
    // Never show another request's data (e.g. trip A while trip B loads).
    data: settled?.key === key ? settled.data : null,
    error: fresh ? settled.error : null,
    loading: !fresh,
    reload,
  };
}
