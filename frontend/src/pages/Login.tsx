"use client";

import * as React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, KeyRound, Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/ui/logo";
import { apiClient, ApiError } from "@/api/client";
import { setStoredApiKey, hasUserApiKey, clearStoredApiKey } from "@/auth";
import { useBackendReadiness } from "@/context/BackendReadinessContext";
import { useRouteMeta } from "@/hooks/useRouteMeta";

/**
 * LoginPage - API key sign-in for the Hawk3ye dashboard.
 *
 * Hawk3ye authenticates sources with API keys rather than usernames and
 * passwords. A dashboard user signs in with an active source API key
 * (created on the Sources page or via the backend API on a fresh install).
 */
export function LoginPage() {
  useRouteMeta(
    "Sign in",
    "Sign in to your Hawk3ye dashboard with a source API key."
  );
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string; message?: string } };
  const from = location.state?.from || "/dashboard";

  // Already signed in on this browser - go straight to the app
  React.useEffect(() => {
    if (hasUserApiKey()) {
      navigate(from, { replace: true });
    }
  }, [navigate, from]);

  const [apiKeyInput, setApiKeyInput] = React.useState("");
  const [showKey, setShowKey] = React.useState(false);
  const [isSigningIn, setIsSigningIn] = React.useState(false);
  const [error, setError] = React.useState<string | null>(location.state?.message ?? null);
  const { status: backendStatus, isWaking: backendWaking } = useBackendReadiness();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const key = apiKeyInput.trim();
    if (!key) {
      setError("Please enter your API key.");
      return;
    }

    setIsSigningIn(true);
    setError(null);

    // Reject any previously stored invalid key before validating
    clearStoredApiKey();

    try {
      // Temporarily store so the API client picks it up during validation
      setStoredApiKey(key);
      await apiClient.getSources({ limit: 1, offset: 0 });
      // Key is valid - go to the requested page or the dashboard
      navigate(from, { replace: true });
    } catch (err) {
      clearStoredApiKey();
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setError("Invalid or inactive API key. Check the key and try again.");
      } else if (err instanceof TypeError || (err instanceof ApiError && err.status >= 500)) {
        // Backend unreachable (directly or via a dev-proxy 5xx). This is not
        // an auth problem - keep the entered key and explain what to do.
        setError(
          "Could not reach the Hawk3ye backend. Make sure the backend is reachable, then try again."
        );
        setStoredApiKey(key);
      } else {
        setError(err instanceof Error ? err.message : "Sign-in failed. Please try again.");
        clearStoredApiKey();
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      {/* Faint grid backdrop, consistent with the landing hero */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--border) / 0.5) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border) / 0.5) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 35%, black 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 35%, black 30%, transparent 75%)",
        }}
      />

      {/* Top bar */}
      <header className="relative z-10 border-b border-border/60">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2" aria-label="Back to Hawk3ye home">
            <Logo size={24} />
            <span className="text-base font-semibold tracking-tight">Hawk3ye</span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to overview
          </Link>
        </div>
      </header>

      <main id="main-content" className="relative z-10 flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md space-y-5 animate-fade-up">
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">Sign in to your dashboard</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Use an active source API key to continue
            </p>
          </div>

          <Card className="shadow-card">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                API key authentication
              </CardTitle>
              <CardDescription>
                Keys are issued per monitored source. No password involved.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {backendWaking && backendStatus !== "failed" && (
                <div
                  className="mb-4 flex items-center gap-2.5 rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm"
                  role="status"
                  aria-live="polite"
                >
                  <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary animate-pulse-dot" aria-hidden="true" />
                  <span className="text-muted-foreground">
                    The backend is waking up. You can still enter your key - we will sign you in once it is ready.
                  </span>
                </div>
              )}
              {backendStatus === "failed" && (
                <div
                  className="mb-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-sm text-destructive"
                  role="alert"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                  <span>
                    The backend has not responded after a couple of minutes. Please try again or check the service status.
                  </span>
                </div>
              )}
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-api-key">API key</Label>
                  <div className="relative">
                    <KeyRound
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      id="login-api-key"
                      type={showKey ? "text" : "password"}
                      placeholder="hawk_..."
                      value={apiKeyInput}
                      onChange={(e) => {
                        setApiKeyInput(e.target.value);
                        setError(null);
                      }}
                      className="pl-10 pr-10"
                      autoComplete="off"
                      autoFocus
                      disabled={isSigningIn}
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? "login-error" : undefined}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1.5 top-1/2 h-7 w-7 -translate-y-1/2"
                      onClick={() => setShowKey(!showKey)}
                      aria-label={showKey ? "Hide API key" : "Show API key"}
                    >
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {error && (
                    <div
                      id="login-error"
                      role="alert"
                      className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-sm text-destructive"
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                      <span>{error}</span>
                    </div>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={isSigningIn || !apiKeyInput.trim()}>
                  {isSigningIn ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying key...
                    </>
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </form>

              <p className="mt-4 border-t pt-3 text-xs leading-relaxed text-muted-foreground">
                The key is stored only in this browser and sent as an{" "}
                <code className="font-mono">X-API-Key</code> header with each request.
                Need one? Follow the{" "}
                <Link to="/get-started" className="font-medium text-primary hover:underline">
                  get started guide
                </Link>
                .
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
