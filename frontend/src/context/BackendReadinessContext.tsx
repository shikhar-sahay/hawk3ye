"use client";

import * as React from "react";

/**
 * Backend readiness states.
 *
 * - checking: initial probe in flight (brief; not yet distinguishable from waking)
 * - waking:  backend is unreachable or responded with 5xx -- Render may be
 *            cold-starting. The UI shows the waking screen and retries.
 * - ready:   /health responded 200
 * - failed:  repeated failures for an extended duration; show recovery UI
 */
export type BackendReadiness = "checking" | "waking" | "ready" | "failed";

interface BackendReadinessContextValue {
  status: BackendReadiness;
  /** True once a 200 has been observed (stays true even if backend later drops) */
  isReady: boolean;
  /** True while the backend is waking/cold-starting */
  isWaking: boolean;
  /** Manually re-check now (debounced) */
  retry: () => void;
  /** How many consecutive failures have occurred */
  attempts: number;
}

const BackendReadinessContext = React.createContext<BackendReadinessContextValue | null>(null);

const HEALTH_PATH = "/health";

/** Derive the backend origin + health URL from the same env var the API client uses */
function healthUrl(): string {
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";
  return `${base}${HEALTH_PATH}`;
}

/** Poll schedule: exponential backoff, capped, jittered */
const BACKOFF = [1200, 2000, 3500, 6000, 10000, 15000, 20000];
const FAILED_AFTER_MS = 120_000; // 2 minutes of continuous failure -> "failed"

export function BackendReadinessProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<BackendReadiness>("checking");
  const [attempts, setAttempts] = React.useState(0);
  const startedAtRef = React.useRef<number>(Date.now());
  const abortedRef = React.useRef(false);
  const retryQueuedRef = React.useRef(false);
  // Ref mirrors so callbacks (e.g. the visibility handler) never read stale
  // state. readyRef stays true once a 200 is observed: after the first
  // success, transient blips are handled by per-query error states and the
  // WebSocket reconnect logic, not by re-entering the waking flow.
  const attemptsRef = React.useRef(0);
  const readyRef = React.useRef(false);

  const check = React.useCallback(async (attempt: number) => {
    if (abortedRef.current) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(healthUrl(), {
        signal: controller.signal,
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      clearTimeout(timeout);
      if (res.ok) {
        setStatus("ready");
        setAttempts(0);
        attemptsRef.current = 0;
        readyRef.current = true;
        startedAtRef.current = Date.now();
        return true;
      }
      // Non-200 from an awake backend is not a cold start.
      // 5xx during cold start is waking; 4xx is not.
      if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
      // 4xx on /health should not happen; treat as a definite backend
      // response (not waking) so we do not mask real config errors.
      setStatus("ready");
      setAttempts(0);
      attemptsRef.current = 0;
      readyRef.current = true;
      return true;
    } catch {
      clearTimeout(timeout);
      const nextAttempt = attempt + 1;
      setAttempts(nextAttempt);
      attemptsRef.current = nextAttempt;
      const elapsed = Date.now() - startedAtRef.current;
      if (elapsed >= FAILED_AFTER_MS) {
        setStatus("failed");
      } else {
        setStatus("waking");
      }
      return false;
    }
  }, []);

  const scheduleNext = React.useCallback(
    (attempt: number) => {
      const idx = Math.min(attempt, BACKOFF.length - 1);
      const base = BACKOFF[idx];
      const jitter = Math.random() * 600;
      const delay = base + jitter;
      const id = window.setTimeout(async () => {
        const ok = await check(attempt);
        if (!ok && !abortedRef.current) scheduleNext(attempt + 1);
      }, delay);
      return () => window.clearTimeout(id);
    },
    [check]
  );

  // Start the initial check and the retry loop
  React.useEffect(() => {
    abortedRef.current = false;
    startedAtRef.current = Date.now();

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      const ok = await check(0);
      if (!ok && !cancelled) cleanup = scheduleNext(1);
    })();

    // Re-check when the tab becomes visible again (user returns after sleep).
    // Skip once ready: a transient blip must not drag the app back into the
    // waking flow (which would also tear down the live WebSocket with no
    // recovery loop running). Post-ready failures surface through per-query
    // error states and the socket reconnect logic instead.
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (abortedRef.current || readyRef.current) return;
      void check(attemptsRef.current);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      abortedRef.current = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (cleanup) cleanup();
    };
    // Only run once on mount; subsequent checks are driven by the loop
    // and explicit retry(). Including check/scheduleNext would restart it
    // on every status change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retry = React.useCallback(() => {
    if (retryQueuedRef.current) return;
    retryQueuedRef.current = true;
    // Small debounce so rapid clicks do not create parallel checks
    window.setTimeout(() => {
      retryQueuedRef.current = false;
      startedAtRef.current = Date.now();
      setAttempts(0);
      attemptsRef.current = 0;
      setStatus("checking");
      void check(0).then((ok) => {
        if (!ok) scheduleNext(1);
      });
    }, 300);
  }, [check, scheduleNext]);

  const value = React.useMemo<BackendReadinessContextValue>(
    () => ({
      status,
      isReady: status === "ready",
      isWaking: status === "waking" || status === "checking",
      retry,
      attempts,
    }),
    [status, retry, attempts]
  );

  return (
    <BackendReadinessContext.Provider value={value}>
      {children}
    </BackendReadinessContext.Provider>
  );
}

export function useBackendReadiness(): BackendReadinessContextValue {
  const ctx = React.useContext(BackendReadinessContext);
  if (!ctx) {
    throw new Error("useBackendReadiness must be used within BackendReadinessProvider");
  }
  return ctx;
}

/** Like useBackendReadiness, but returns null outside the provider (safe for optional checks) */
export function useBackendReadinessOptional(): BackendReadinessContextValue | null {
  return React.useContext(BackendReadinessContext);
}
