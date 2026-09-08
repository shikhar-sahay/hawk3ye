"use client";

import { Link } from "react-router-dom";
import { ArrowRight, ChevronRight, Download, KeyRound, Eye, Send, Radar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { CodeBlock } from "@/components/site/CodeBlock";
import { useRouteMeta } from "@/hooks/useRouteMeta";

/**
 * GetStartedPage - the zero-to-live-dashboard journey.
 *
 * Hawk3ye authenticates with per-source API keys rather than user accounts;
 * this page walks the honest path: run the backend, register a source,
 * generate a key, send an event, watch detection fire. All commands are
 * real and copyable.
 */

const steps = [
  {
    icon: Download,
    key: "01",
    title: "Run Hawk3ye",
    description:
      "Install and start the backend. SQLite works out of the box; point DATABASE_URL at PostgreSQL for production.",
    code: `pip install -e .
uvicorn hawkeye.main:app --port 8000`,
    meta: "API live on http://localhost:8000 · docs at /docs",
  },
  {
    icon: Radar,
    key: "02",
    title: "Register your source",
    description:
      "Each application you monitor is a source. The first source can be registered without credentials (open only until one exists).",
    code: `curl -X POST http://localhost:8000/api/v1/sources \\
  -H "Content-Type: application/json" \\
  -d '{"name": "production-web", "description": "Public web app"}'`,
    meta: "POST /api/v1/sources",
  },
  {
    icon: KeyRound,
    key: "03",
    title: "Generate an API key",
    description:
      "Create the source's first key. On a fresh install this needs no credentials (open only until one key exists). It is shown exactly once and both ingests events and signs in to the dashboard.",
    code: `curl -X POST http://localhost:8000/api/v1/sources/1/api-keys \\
  -H "Content-Type: application/json" \\
  -d '{"name": "dashboard"}'
# after the first key exists, add:
#   -H "X-API-Key: hawk_..."`,
    meta: 'returns { "key": "hawk_..." }; save it now',
  },
  {
    icon: Send,
    key: "04",
    title: "Send your first event",
    description:
      "Point your application at ingestion. This login failure is enough: it gets normalized, tagged T1110, and scored by all seven engines.",
    code: `curl -X POST http://localhost:8000/api/v1/events \\
  -H "X-API-Key: hawk_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "event_type": "login_failed",
    "category": "authentication",
    "ip": "203.0.113.7",
    "route": "/login",
    "method": "POST",
    "status_code": 401
  }'`,
    meta: "POST /api/v1/events · batches of up to 1,000 via /api/v1/events/batch",
  },
  {
    icon: Eye,
    key: "05",
    title: "Watch Hawk3ye detect it",
    description:
      "Open the dashboard and sign in with the key. Send five failed logins within 15 minutes and the Brute Force engine raises an alert that streams in live.",
    code: `# sign in at /login with hawk_...
# or watch the event land:
curl http://localhost:8000/api/v1/events/query?limit=5 \\
  -H "X-API-Key: hawk_..."`,
    meta: "detection → alert → incident, all on your dashboard",
  },
];

export function GetStartedPage() {
  useRouteMeta(
    "Get started",
    "Run Hawk3ye, register a source, generate an API key, send your first event, and watch detection fire. Five commands from zero to a live dashboard."
  );
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main id="main-content" className="mx-auto max-w-3xl px-4 pb-24 pt-24 sm:px-6 sm:pt-28">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="font-mono text-2xs text-muted-foreground">
          <ol className="flex items-center gap-1">
            <li>
              <Link to="/" className="hover:text-foreground">Overview</Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="h-3 w-3" />
            </li>
            <li aria-current="page" className="text-foreground">Get started</li>
          </ol>
        </nav>

        <p className="mt-6 font-mono text-xs uppercase tracking-[0.2em] text-primary">
          Get started
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          From zero to a live detection
        </h1>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Hawk3ye authenticates with per-source API keys instead of user
          accounts. Each application you monitor is registered as a source, and
          its keys act as both the ingestion credential and the dashboard login.
          Five steps, five commands:
        </p>

        {/* The relationship, up front */}
        <div className="mt-6 overflow-x-auto rounded-lg border bg-card px-4 py-3">
          <p className="flex items-center gap-2 whitespace-nowrap font-mono text-2xs uppercase tracking-wider text-muted-foreground">
            {["source", "api key", "event", "detection", "dashboard"].map((s, i) => (
              <span key={s} className="flex items-center gap-2">
                {i > 0 && <ChevronRight className="h-3 w-3 text-primary" aria-hidden="true" />}
                <span className={i === 0 || i === 4 ? "text-foreground" : undefined}>{s}</span>
              </span>
            ))}
          </p>
        </div>

        <ol className="relative mt-10 space-y-8">
          {/* Timeline rail */}
          <div
            aria-hidden="true"
            className="absolute bottom-4 left-[19px] top-4 w-px border-l border-dashed border-primary/30"
          />
          {steps.map((step, i) => (
            <li key={step.key} className="relative pl-14">
              {/* Node */}
              <div
                className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-full border bg-card font-mono text-xs text-primary shadow-card"
                aria-hidden="true"
              >
                {step.key}
              </div>
              <div className="rounded-lg border bg-card p-5 shadow-card sm:p-6">
                <div className="flex items-center gap-2.5">
                  <step.icon className="h-4 w-4 text-primary" aria-hidden="true" />
                  <h2 className="font-semibold leading-tight">{step.title}</h2>
                </div>
                <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
                <div className="mt-4">
                  <CodeBlock code={step.code} meta={step.meta} />
                </div>
              </div>
              {i === steps.length - 1 && null}
            </li>
          ))}
        </ol>

        <div className="mt-10 rounded-lg border border-primary/25 bg-primary/5 p-5">
          <h2 className="font-semibold">Already have an API key?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in directly with any active source key. On an existing
            deployment, ask whoever manages the sources to issue you a key from
            the Sources page.
          </p>
          <Button className="mt-4" asChild>
            <Link to="/login">
              Sign in with an API key
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="mt-8 text-sm">
          <Link to="/" className="inline-flex min-h-[36px] items-center gap-1.5 text-muted-foreground hover:text-foreground">
            ← Back to overview
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
