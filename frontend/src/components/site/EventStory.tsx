"use client";

import { ChevronRight } from "lucide-react";
import { Reveal } from "@/components/Reveal";

const rawEvent = `{
  "event_type": "login_failed",
  "category": "authentication",
  "ip": "203.0.113.7",
  "route": "/login",
  "method": "POST",
  "status_code": 401
}`;

const alertJson = `{
  "detection_type": "brute_force",
  "severity": "high",
  "confidence": 0.87,
  "title": "Brute force from 203.0.113.7",
  "description": "5 failed logins
     in 4.2 minutes",
  "mitre_techniques": ["T1110.001"]
}`;

const incidentJson = `{
  "status": "open",
  "severity": "high",
  "alert_count": 14,
  "entities": ["203.0.113.7", "admin",
               "root", "deploy"],
  "mitre_tactics": ["credential-access"],
  "mitre_techniques": ["T1110.001",
                       "T1110.004"]
}`;

/**
 * EventStory - "what actually happens to your telemetry": a raw event is
 * scored by the engines, becomes an alert with ATT&CK context, and is
 * correlated into an incident. Uses the real field names from Hawk3ye's
 * schemas.
 */
export function EventStory() {
  return (
    <section className="border-t bg-card/40 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
            Telemetry → findings
          </p>
          <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            What happens to a single failed login
          </h2>
          <p className="mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Follow one event through the pipeline. Field names below are the
            real ones: this is the actual shape of Hawk3ye's data, not a mockup.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-4 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-stretch">
          {/* Raw event */}
          <Reveal className="min-w-0">
            <div className="flex h-full flex-col overflow-hidden rounded-lg border bg-card shadow-card">
              <div className="border-b bg-muted/50 px-4 py-2 font-mono text-2xs uppercase tracking-wider text-muted-foreground">
                1 · Raw event
              </div>
              <pre className="flex-1 overflow-x-auto p-4 text-xs leading-relaxed text-foreground/90">
                <code>{rawEvent}</code>
              </pre>
              <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">
                Arrives at <code className="font-mono">POST /api/v1/events</code> with a
                source API key. Normalized and tagged on the way in.
              </p>
            </div>
          </Reveal>

          <div className="hidden items-center justify-center lg:flex" aria-hidden="true">
            <ChevronRight className="h-5 w-5 text-muted-foreground/50" />
          </div>

          {/* Detection + alert */}
          <Reveal delay={100} className="min-w-0">
            <div className="flex h-full flex-col overflow-hidden rounded-lg border bg-card shadow-card">
              <div className="border-b bg-muted/50 px-4 py-2 font-mono text-2xs uppercase tracking-wider text-muted-foreground">
                2 · Detection → Alert
              </div>
              <div className="border-b px-4 py-3">
                <p className="text-xs text-muted-foreground">Engines that scored this event:</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {["brute_force ✓", "credential_stuffing ✓", "enumeration", "bot", "session_hijacking", "api_abuse"].map((e) => (
                    <span
                      key={e}
                      className={
                        e.endsWith("✓")
                          ? "rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 font-mono text-2xs text-primary"
                          : "rounded border px-1.5 py-0.5 font-mono text-2xs text-muted-foreground/60"
                      }
                    >
                      {e.replace(" ✓", "")}
                    </span>
                  ))}
                </div>
              </div>
              <pre className="flex-1 overflow-x-auto p-4 text-xs leading-relaxed text-foreground/90">
                <code>{alertJson}</code>
              </pre>
            </div>
          </Reveal>

          <div className="hidden items-center justify-center lg:flex" aria-hidden="true">
            <ChevronRight className="h-5 w-5 text-muted-foreground/50" />
          </div>

          {/* Correlated incident */}
          <Reveal delay={200} className="min-w-0">
            <div className="flex h-full flex-col overflow-hidden rounded-lg border border-severity-high/40 bg-card shadow-card">
              <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-2">
                <span className="font-mono text-2xs uppercase tracking-wider text-muted-foreground">
                  3 · Correlated incident
                </span>
                <span className="rounded-full border border-severity-high/40 bg-severity-high/10 px-2 py-0.5 font-mono text-2xs text-severity-high">
                  open · high
                </span>
              </div>
              <pre className="flex-1 overflow-x-auto p-4 text-xs leading-relaxed text-foreground/90">
                <code>{incidentJson}</code>
              </pre>
              <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">
                Related alerts within the correlation window are grouped, with
                aggregated entities, timelines, and ATT&CK coverage.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
