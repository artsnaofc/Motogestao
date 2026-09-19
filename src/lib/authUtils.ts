import { supabase } from './supabase';
import { cacheManager } from './cacheManager';

export interface EffectiveUser {
  id: string;
  email?: string;
}

const CURRENT_USER_KEY = 'current_user';
const CURRENT_USER_ID_KEY = 'current_user_id';

/**
 * Persists the authenticated user identity to local cache for offline availability.
 */
export function setCachedUser(user: EffectiveUser | null): void {
  if (user && user.id) {
    cacheManager.set(CURRENT_USER_KEY, { id: user.id, email: user.email }, undefined, 'auth');
    cacheManager.set(CURRENT_USER_ID_KEY, user.id, undefined, 'auth');
    try {
      localStorage.setItem('financas_pro_last_user_id', user.id);
    } catch {}
  } else {
    cacheManager.remove(CURRENT_USER_KEY);
    cacheManager.remove(CURRENT_USER_ID_KEY);
    try {
      localStorage.removeItem('financas_pro_last_user_id');
    } catch {}
  }
}

/**
 * Gets the current authenticated user in a 100% offline-resilient manner.
 * Priority:
 * 1. Supabase local session (via getSession, which reads localStorage and works offline)
 * 2. Supabase getUser (when online)
 * 3. AppCacheManager cached user
 * 4. Raw localStorage fallback
 */
export async function getEffectiveUser(): Promise<EffectiveUser | null> {
  // 1. Try local session first (reads from client localStorage, doesn't require active internet)
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session?.user?.id) {
      const u: EffectiveUser = {
        id: sessionData.session.user.id,
        email: sessionData.session.user.email,
      };
      setCachedUser(u);
      return u;
    }
  } catch (err) {
    console.warn('[authUtils] Erro ao obter sessão local:', err);
  }

  // 2. If online, try getUser as a secondary refresh
  if (typeof navigator === 'undefined' || navigator.onLine) {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user?.id) {
        const u: EffectiveUser = {
          id: userData.user.id,
          email: userData.user.email,
        };
        setCachedUser(u);
        return u;
      }
    } catch (err) {
      console.warn('[authUtils] Falha de rede ao consultar getUser:', err);
    }
  }

  // 3. Fallback to AppCacheManager
  const cached = cacheManager.get<EffectiveUser>(CURRENT_USER_KEY);
  if (cached?.id) {
    return cached;
  }

  const cachedId = cacheManager.get<string>(CURRENT_USER_ID_KEY);
  if (cachedId) {
    return { id: cachedId };
  }

  // 4. Last resort: scan localStorage for Supabase auth tokens
  try {
    const lastId = localStorage.getItem('financas_pro_last_user_id');
    if (lastId) {
      return { id: lastId };
    }

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('-auth-token') || key.includes('supabase.auth.token'))) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          const uid = parsed?.user?.id || parsed?.currentSession?.user?.id;
          if (uid) {
            const u: EffectiveUser = { id: uid, email: parsed?.user?.email };
            setCachedUser(u);
            return u;
          }
        }
      }
    }
  } catch {}

  return null;
}

/**
 * Helper to get just the user ID, or null if unauthenticated.
 */
export async function getEffectiveUserId(): Promise<string | null> {
  const user = await getEffectiveUser();
  return user?.id || null;
}
