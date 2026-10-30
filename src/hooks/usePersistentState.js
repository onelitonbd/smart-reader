import { useEffect, useRef, useState } from 'react';
import { getAppState, saveAppState } from '../lib/offlineDb';

export default function usePersistentState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const saved = window.localStorage.getItem(key);
      return saved ? JSON.parse(saved) : typeof initialValue === 'function' ? initialValue() : initialValue;
    } catch {
      return typeof initialValue === 'function' ? initialValue() : initialValue;
    }
  });
  const valueRef = useRef(value);
  const hydratedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    hydratedRef.current = false;
    getAppState(key).then((saved) => {
      if (cancelled) return;
      if (saved !== undefined) {
        valueRef.current = saved;
        setValue(saved);
      } else {
        saveAppState(key, valueRef.current).catch(() => {});
      }
      hydratedRef.current = true;
    }).catch(() => {
      // localStorage remains a synchronous fallback when IndexedDB is unavailable.
      hydratedRef.current = true;
    });
    return () => { cancelled = true; };
  }, [key]);

  useEffect(() => {
    valueRef.current = value;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // IndexedDB remains available when localStorage is full or blocked.
    }
    if (hydratedRef.current) saveAppState(key, value).catch(() => {});
  }, [key, value]);

  return [value, setValue];
}
