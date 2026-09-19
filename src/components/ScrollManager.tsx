import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * ScrollManager guarantees:
 * 1. Immediate, non-blocking scroll-to-top when switching pages.
 * 2. Does not freeze or delay click events or route transitions.
 */
export function ScrollManager() {
  const { pathname } = useLocation();

  useEffect(() => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    } catch {
      window.scrollTo(0, 0);
    }
  }, [pathname]);

  return null;
}

export function resetPageScroll(_pathname?: string) {
  // No-op for compatibility
}
