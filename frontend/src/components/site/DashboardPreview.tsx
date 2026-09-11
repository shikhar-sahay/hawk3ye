"use client";

import { Link } from "react-router-dom";
import { ArrowRight, Activity, Shield, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/Reveal";

const feedRows = [
  { sev: "critical", label: "brute_force", entity: "203.0.113.7", time: "14:02:11" },
  { sev: "high", label: "session_hijacking", entity: "session f3a9…", time: "14:01:47" },
  { sev: "medium", label: "enumeration", entity: "198.51.100.22", time: "13:58:03" },
  { sev: "high", label: "api_abuse", entity: "192.0.2.140", time: "13:57:39" },
];

const sevColor: Record<string, string> = {
  critical: "bg-severity-critical",
  high: "bg-severity-high",
  medium: "bg-severity-medium",
  low: "bg-severity-low",
};

// Representative area-chart path (illustrative shape only, no real metrics)
const AREA_PATH =
  "M0,86 C30,80 45,62 70,58 C95,54 110,66 135,60 C160,54 175,30 200,26 C225,22 240,44 265,48 C290,52 305,38 330,30 C355,22 370,10 395,14 C420,18 435,40 460,44 C480,47 495,42 520,34 L520,110 L0,110 Z";

/**
 * DashboardPreview - a stylized, clearly-labeled representation of the
 * live dashboard so visitors can see the product before signing in.
 * The numbers and rows are representative development data, not live
 * metrics.
 */
export function DashboardPreview() {
  return (
    <section className="border-t py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.2fr]">
          <Reveal className="min-w-0">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
              The dashboard
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Findings, not log lines
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Alerts stream in live over WebSocket. Incidents group the related
              signals, carry their ATT&CK context, and wait for your triage. Update
              status as you investigate, from open to resolved.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Activity className="mt-0.5 h-4 w-4 flex-none text-primary" aria-hidden="true" />
                Live charts: alert volume, severity mix, detection types, ATT&CK coverage
              </li>
              <li className="flex items-start gap-2">
                <Shield className="mt-0.5 h-4 w-4 flex-none text-primary" aria-hidden="true" />
                Incident workflow: open → investigating → contained → resolved → closed
              </li>
              <li className="flex items-start gap-2">
                <Target className="mt-0.5 h-4 w-4 flex-none text-primary" aria-hidden="true" />
                Per-source isolation: every connection sees only its own telemetry
              </li>
            </ul>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild>
                <Link to="/get-started">
                  Open your dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/login">Sign in</Link>
              </Button>
            </div>
          </Reveal>

          <Reveal delay={120} className="min-w-0">
            <div className="relative">
              {/* Stylized dashboard frame */}
              <div className="overflow-hidden rounded-xl border bg-card shadow-card-hover">
                {/* Window chrome */}
                <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-border" aria-hidden="true" />
                    <span className="h-2.5 w-2.5 rounded-full bg-border" aria-hidden="true" />
                    <span className="h-2.5 w-2.5 rounded-full bg-border" aria-hidden="true" />
                    <span className="ml-2 font-mono text-2xs text-muted-foreground">
                      hawk3ye · dashboard
                    </span>
                  </div>
                  <span className="flex items-center gap-1.5 font-mono text-2xs text-success">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute h-full w-full animate-pulse-dot rounded-full bg-success" />
                      <span className="relative h-1.5 w-1.5 rounded-full bg-success" />
                    </span>
                    live
                  </span>
                </div>

                <div className="grid gap-3 p-4 sm:grid-cols-[1.4fr_1fr]">
                  {/* Chart panel */}
                  <div className="rounded-lg border p-3">
                    <p className="font-mono text-2xs uppercase tracking-wider text-muted-foreground">
                      Alerts over time
                    </p>
                    <div className="relative mt-2 h-28">
                      <svg viewBox="0 0 520 110" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
                        {[28, 56, 84].map((y) => (
                          <line key={y} x1="0" y1={y} x2="520" y2={y} stroke="hsl(var(--chart-grid))" strokeWidth="1" />
                        ))}
                        <path d={AREA_PATH} fill="hsl(var(--primary) / 0.15)" />
                        <path
                          d="M0,86 C30,80 45,62 70,58 C95,54 110,66 135,60 C160,54 175,30 200,26 C225,22 240,44 265,48 C290,52 305,38 330,30 C355,22 370,10 395,14 C420,18 435,40 460,44 C480,47 495,42 520,34"
                          fill="none"
                          stroke="hsl(var(--primary))"
                          strokeWidth="2"
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>
                    </div>
                  </div>

                  {/* Stat chips */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "events", value: "26.6K" },
                      { label: "incidents", value: "3" },
                      { label: "engines", value: "7" },
                      { label: "sources", value: "2" },
                    ].map((s) => (
                      <div key={s.label} className="rounded-lg border p-2.5">
                        <p className="font-mono text-2xs uppercase text-muted-foreground">{s.label}</p>
                        <p className="mt-1 font-mono text-lg font-semibold leading-none">{s.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Live feed */}
                  <div className="rounded-lg border sm:col-span-2">
                    <p className="border-b px-3 py-2 font-mono text-2xs uppercase tracking-wider text-muted-foreground">
                      Alert feed
                    </p>
                    <ul className="divide-y">
                      {feedRows.map((row) => (
                        <li key={row.label + row.time} className="flex items-center gap-3 px-3 py-2 font-mono text-xs">
                          <span className={`h-1.5 w-1.5 flex-none rounded-full ${sevColor[row.sev]}`} aria-hidden="true" />
                          <span className="w-32 flex-none truncate text-foreground/90">{row.label}</span>
                          <span className="flex-1 truncate text-muted-foreground">{row.entity}</span>
                          <span className="text-2xs text-muted-foreground">{row.time}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
              <p className="mt-2 text-center text-2xs text-muted-foreground">
                Stylized view with representative development data.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
