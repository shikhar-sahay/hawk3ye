/**
 * Hawk3ye Frontend - Authentication helpers
 *
 * Hawk3ye uses API-key authentication (X-API-Key header). The dashboard is a
 * browser app, so the key lives in localStorage after the user signs in on
 * the Login page. No secret is ever baked into the frontend bundle.
 */

export const API_KEY_STORAGE = "hawkeye_api_key";

/** Event dispatched by the API client when the backend rejects the stored key */
export const UNAUTHORIZED_EVENT = "hawkeye:unauthorized";

export function getStoredApiKey(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(API_KEY_STORAGE);
}

/**
 * True when the user explicitly signed in this browser (ignores any
 * build-time dev key). Used to decide whether the login screen should show.
 */
export function hasUserApiKey(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.localStorage.getItem(API_KEY_STORAGE));
}

export function setStoredApiKey(key: string): void {
  window.localStorage.setItem(API_KEY_STORAGE, key);
}

export function clearStoredApiKey(): void {
  window.localStorage.removeItem(API_KEY_STORAGE);
}

/** Notify the app that the active key was rejected by the backend */
export function notifyUnauthorized(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
  }
}
