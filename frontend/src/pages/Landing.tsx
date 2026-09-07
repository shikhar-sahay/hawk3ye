"use client";

import { Link } from "react-router-dom";
import { ArrowRight, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { ObservationField } from "@/components/brand/ObservationField";
import { Logo } from "@/components/ui/logo";
import { PipelineFlow } from "@/components/site/PipelineFlow";
import { EventStory } from "@/components/site/EventStory";
import { DetectionMatrix } from "@/components/site/DetectionMatrix";
import { DashboardPreview } from "@/components/site/DashboardPreview";
import { FAQSection } from "@/components/site/FAQSection";
import { MobileStickyCta } from "@/components/site/MobileStickyCta";
import { Reveal } from "@/components/Reveal";
import { useRouteMeta } from "@/hooks/useRouteMeta";

/**
 * LandingPage - public product page for Hawk3ye.
 *
 * The narrative: Hawk3ye watches your application, ingests its security
 * events, detects attacks with seven engines, correlates alerts into
 * incidents, and puts them in front of you live. Copy is limited to
 * capabilities the backend actually implements.
 */

const ingestSnippet = `curl -X POST http://localhost:8000/api/v1/events \\
  -H "X-API-Key: hawk_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "event_type": "login_failed",
    "category": "authentication",
    "ip": "203.0.113.7",
    "route": "/login",
    "method": "POST",
    "status_code": 401
  }'`;

export function LandingPage() {
  useRouteMeta(
    "Web Application Security Monitoring",
    "Hawk3ye is a self-hosted security monitoring platform for web applications: ingest security events, detect attacks with seven detection engines, map findings to MITRE ATT&CK, and correlate alerts into live incidents."
  );

  return (
    <div className="min-h-screen bg-background pb-16 md:pb-0">
      <SiteHeader />

      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <main id="main-content">
        {/* ---------------------------------------------------------------- */}
        {/* Hero: copy left, the observation field right                     */}
        {/* ---------------------------------------------------------------- */}
        <section className="relative overflow-hidden pt-28 sm:pt-32">
        {/* Faint surveillance grid backdrop */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--border) / 0.5) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border) / 0.5) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage:
              "radial-gradient(ellipse 90% 75% at 55% 30%, black 30%, transparent 80%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 90% 75% at 55% 30%, black 30%, transparent 80%)",
          }}
        />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          {/* Mobile order: copy → hawk → code. Desktop: copy+code | hawk. */}
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-8">
            <div className="min-w-0">
              <div className="animate-fade-up inline-flex max-w-full items-center gap-2.5 rounded-full border bg-card px-3.5 py-1.5 text-[13px] font-medium text-muted-foreground">
                <span className="relative flex h-2 w-2 flex-none">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 animate-pulse-dot" />
                  <span className="relative inline-flex h-2 w-2 flex-none rounded-full bg-success" />
                </span>
                <span className="min-w-0">Self-hosted<span className="hidden sm:inline"> · your telemetry stays on your infrastructure</span></span>
              </div>

              <h1
                className="animate-fade-up mt-6 text-4xl font-bold leading-[1.08] tracking-tight sm:text-6xl lg:text-[4.25rem]"
                style={{ animationDelay: "80ms" }}
              >
                Know when your web app is under attack.
              </h1>

              <p
                className="animate-fade-up mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl"
                style={{ animationDelay: "160ms" }}
              >
                Hawk3ye watches the security events your application already
                produces. Every login, request, and session runs through seven
                detection engines, gets mapped to MITRE ATT&CK, and lands on
                your dashboard as a live, correlated incident.
              </p>

              <div
                className="animate-fade-up mt-9 flex flex-wrap items-center gap-4"
                style={{ animationDelay: "240ms" }}
              >
                <Button size="lg" asChild>
                  <Link to="/get-started">
                    Get started
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link to="/login">Sign in to dashboard</Link>
                </Button>
              </div>
            </div>

            {/* The hawk, watching the telemetry around it */}
            <div className="animate-fade-in relative mx-auto w-full max-w-[360px] min-w-0 sm:max-w-[480px] lg:max-w-none">
              <ObservationField />
            </div>

            {/* Ingest example: the actual first integration step */}
            <Reveal delay={200} className="min-w-0 max-w-2xl lg:col-start-1">
              <div className="overflow-hidden rounded-lg border bg-card shadow-card">
                <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-2.5">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground sm:text-[13px]">
                    <Terminal className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
                    Send your first event
                  </div>
                  <span className="hidden min-[420px]:inline font-mono text-2xs text-muted-foreground">
                    POST /api/v1/events
                  </span>
                </div>
                <pre className="code-scroll overflow-x-auto p-4 text-[13px] leading-relaxed text-foreground/90">
                  <code>{ingestSnippet}</code>
                </pre>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Signal strip: real capability facts, mono voice */}
      <div className="border-y bg-card/40">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-4 py-3 font-mono text-2xs uppercase tracking-wider text-muted-foreground sm:px-6">
          <span>7 detection engines</span>
          <span aria-hidden="true" className="hidden sm:inline">·</span>
          <span>MITRE ATT&CK native</span>
          <span aria-hidden="true" className="hidden sm:inline">·</span>
          <span>WebSocket live</span>
          <span aria-hidden="true" className="hidden sm:inline">·</span>
          <span>SQLite / PostgreSQL</span>
          <span aria-hidden="true" className="hidden sm:inline">·</span>
          <span>MIT licensed</span>
        </div>
      </div>

      <PipelineFlow />
      <EventStory />
      <DetectionMatrix />
      <DashboardPreview />
      <FAQSection />

      {/* CTA */}
      <section className="relative overflow-hidden border-t py-20 sm:py-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 80% at 50% 100%, hsl(var(--primary) / 0.08), transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-2xl px-4 text-center sm:px-6">
          <Reveal>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border bg-card shadow-card">
              <Logo size={36} animated />
            </div>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
              Start watching in minutes
            </h2>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">
              Register a source, send one event, and watch the pipeline detect
              it. Five commands, zero accounts.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button size="lg" asChild>
                <Link to="/get-started">
                  Get started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/login">Sign in</Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>
      </main>

      <SiteFooter />
      <MobileStickyCta />
    </div>
  );
}
