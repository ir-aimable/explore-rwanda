import { useCallback, useEffect, useRef, useState } from 'react';

export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const fnRef = useRef(fn); fnRef.current = fn;
  const run = useCallback(() => {
    setLoading(true); setError(null);
    return fnRef.current().then((d) => { setData(d); setLoading(false); }).catch((e) => { setError(e); setLoading(false); });
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { run(); }, deps);
  return { data, loading, error, reload: run, setData };
}
