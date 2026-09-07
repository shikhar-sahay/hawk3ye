"use client";

import * as React from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HawkLoader } from "@/components/brand/HawkLoader";
import { useBackendReadiness } from "@/context/BackendReadinessContext";

/**
 * BackendWakingScreen - the cold-start UX for Render free-tier wake.
 *
 * Shown while the backend is waking, before any page attempts to fetch
 * authenticated data. It keeps the existing Hawk3ye design language:
 * HawkLoader mark, restrained copy, and the same motion rules.
 */
export function BackendWakingScreen() {
  const { status, attempts, retry } = useBackendReadiness();

  if (status === "ready") return null;

  const isFailed = status === "failed";

  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-6">
        {/* Mark + subtle indicator */}
        <div className="flex flex-col items-center gap-4">
          <HawkLoader size={48} />
          <span className="sr-only">Backend waking</span>
          {!isFailed && (
            <span
              className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-dot"
              aria-hidden="true"
            />
          )}
        </div>

        {/* Copy */}
        <div className="max-w-sm space-y-2">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            {isFailed ? "Hawk3ye is taking longer than expected" : "Hawk3ye is waking up"}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {isFailed
              ? "The backend has not responded after a couple of minutes. It may be under heavy load or temporarily unavailable."
              : "The backend is starting up. This can take a little longer after a period of inactivity."}
          </p>
          {!isFailed && attempts > 0 && (
            <p className="font-mono text-2xs text-muted-foreground/70">
              checking{".".repeat(Math.min(attempts, 4))}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          <Button
            variant={isFailed ? "default" : "outline"}
            size="sm"
            onClick={retry}
            className="min-w-[7rem]"
          >
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            {isFailed ? "Try again" : "Retry now"}
          </Button>
          {isFailed && (
            <Button variant="ghost" size="sm" asChild>
              <Link to="/">Back to overview</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * BackendReadyGate - wraps any backend-dependent route tree.
 *
 * While the backend is waking, it renders the waking screen instead of
 * the route's content, preventing a burst of failing API calls. Once the
 * backend is ready, children render normally and stay rendered (the gate
 * does not disappear mid-session if the backend later hiccups; subsequent
 * failures are handled by normal error states and WebSocket reconnect).
 */
export function BackendReadyGate({ children }: { children: React.ReactNode }) {
  const { isReady, isWaking, status } = useBackendReadiness();
  const hasBecomeReadyRef = React.useRef(isReady);

  React.useEffect(() => {
    if (isReady) hasBecomeReadyRef.current = true;
  }, [isReady]);

  // Before the first successful health check, show the waking UX.
  // After it has been ready once, never gate again (transient blips are
  // handled by per-query error states and the WebSocket reconnect logic).
  const shouldGate = !hasBecomeReadyRef.current && (isWaking || status === "failed");

  if (shouldGate) return <BackendWakingScreen />;
  return <>{children}</>;
}
