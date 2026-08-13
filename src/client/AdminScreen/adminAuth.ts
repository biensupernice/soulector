/**
 * The admin screen reuses the basic-auth credentials the internal tRPC
 * procedures already check (INTERNAL_AUTH_USERNAME / INTERNAL_AUTH_PASSWORD).
 *
 * Credentials live in sessionStorage — they go away when the tab does — and
 * the tRPC link in _app.tsx attaches them to every request it makes. Nothing
 * else sets them, so ordinary visitors send no Authorization header at all.
 */

const STORAGE_KEY = "soulector.adminAuth";

export function encodeAdminAuth(username: string, password: string) {
  return btoa(`${username}:${password}`);
}

export function getStoredAdminAuth(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    // Private-mode Safari and friends throw rather than return null.
    return null;
  }
}

export function storeAdminAuth(encoded: string) {
  window.sessionStorage.setItem(STORAGE_KEY, encoded);
}

export function clearAdminAuth() {
  window.sessionStorage.removeItem(STORAGE_KEY);
}

/**
 * Checks credentials before we store them, so a bad password never gets
 * attached to subsequent requests.
 */
export async function verifyAdminAuth(encoded: string): Promise<boolean> {
  const res = await fetch("/api/trpc/internal.testAuth", {
    headers: { Authorization: `Basic ${encoded}` },
  });
  return res.ok;
}
