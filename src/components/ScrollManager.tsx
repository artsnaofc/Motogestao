import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// In-memory & sessionStorage backed map for per-page scroll positions
const SCROLL_STORAGE_PREFIX = 'app_scroll_pos_';
const scrollPositions = new Map<string, number>();

/**
 * ScrollManager guarantees:
 * 1. Each page/route has its own isolated, unique scroll position.
 * 2. When switching between pages (e.g., Dashboard -> History -> Investments),
 *    each page remembers exactly where you were.
 * 3. Freshly visited pages start at the very top (0, 0) without inheriting
 *    the previous page's scroll offset.
 * 4. Handles dynamic content / lazy loading with RAF retry so the scroll
 *    restores accurately even after asynchronous layout rendering.
 */
export function ScrollManager() {
  const location = useLocation();
  const navType = useNavigationType();
  const currentPathKey = location.pathname + location.search;
  const prevPathKeyRef = useRef<string>(currentPathKey);
  const isRestoringRef = useRef<boolean>(false);

  // 1. Keep track of scroll positions in real time
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (isRestoringRef.current) return;
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
          scrollPositions.set(currentPathKey, scrollY);
          try {
            sessionStorage.setItem(`${SCROLL_STORAGE_PREFIX}${currentPathKey}`, String(scrollY));
          } catch {
            // Ignore quota errors in storage
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [currentPathKey]);

  // 2. On route change, save previous page position and restore target page position
  useLayoutEffect(() => {
    const prevKey = prevPathKeyRef.current;
    
    // Save previous route scroll position before switching
    if (prevKey && prevKey !== currentPathKey) {
      const prevScrollY = window.scrollY || document.documentElement.scrollTop || 0;
      scrollPositions.set(prevKey, prevScrollY);
      try {
        sessionStorage.setItem(`${SCROLL_STORAGE_PREFIX}${prevKey}`, String(prevScrollY));
      } catch {}
    }

    // Determine target scroll position for this page
    let targetY = 0;
    if (scrollPositions.has(currentPathKey)) {
      targetY = scrollPositions.get(currentPathKey) || 0;
    } else {
      const stored = sessionStorage.getItem(`${SCROLL_STORAGE_PREFIX}${currentPathKey}`);
      if (stored !== null) {
        targetY = parseFloat(stored) || 0;
        scrollPositions.set(currentPathKey, targetY);
      }
    }

    // Mark as restoring to avoid recording transition jitters
    isRestoringRef.current = true;
    prevPathKeyRef.current = currentPathKey;

    // Disable browser's default scroll restoration to have full control
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    // Immediate scroll
    window.scrollTo({ top: targetY, left: 0, behavior: 'instant' as ScrollBehavior });

    // Multi-frame retry to handle lazy loaded chunks, images, or async data rendering
    let framesCount = 0;
    const maxFrames = 15; // ~250ms
    let rafId: number;

    const checkAndRestore = () => {
      framesCount++;
      const currentY = window.scrollY || document.documentElement.scrollTop || 0;
      const maxScrollY = document.documentElement.scrollHeight - window.innerHeight;

      // If page hasn't reached target yet because height was expanding, try to adjust
      if (Math.abs(currentY - targetY) > 2 && targetY <= maxScrollY && targetY > 0) {
        window.scrollTo({ top: targetY, left: 0, behavior: 'instant' as ScrollBehavior });
      }

      if (framesCount < maxFrames) {
        rafId = window.requestAnimationFrame(checkAndRestore);
      } else {
        isRestoringRef.current = false;
      }
    };

    rafId = window.requestAnimationFrame(checkAndRestore);

    return () => {
      window.cancelAnimationFrame(rafId);
      isRestoringRef.current = false;
    };
  }, [currentPathKey, navType]);

  return null;
}

/**
 * Utility function to reset scroll position of a specific route or all routes
 */
export function resetPageScroll(pathname?: string) {
  if (pathname) {
    scrollPositions.delete(pathname);
    sessionStorage.removeItem(`${SCROLL_STORAGE_PREFIX}${pathname}`);
  } else {
    scrollPositions.clear();
    Object.keys(sessionStorage).forEach(k => {
      if (k.startsWith(SCROLL_STORAGE_PREFIX)) {
        sessionStorage.removeItem(k);
      }
    });
  }
}
