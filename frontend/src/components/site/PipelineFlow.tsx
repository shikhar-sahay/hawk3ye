"use client";

import { Eye, ArrowDownToLine, Crosshair, Network, BellRing } from "lucide-react";
import { Reveal } from "@/components/Reveal";

const STAGES = [
  {
    icon: Eye,
    key: "WATCH",
    title: "Watch",
    detail: "Your application emits security events: logins, requests, session activity.",
    tag: "your app",
  },
  {
    icon: ArrowDownToLine,
    key: "INGEST",
    title: "Ingest",
    detail: "Events arrive over the REST API and are normalized with MITRE ATT&CK context.",
    tag: "POST /api/v1/events",
  },
  {
    icon: Crosshair,
    key: "DETECT",
    title: "Detect",
    detail: "Every event is evaluated by all seven detection engines against a rolling window.",
    tag: "7 engines",
  },
  {
    icon: Network,
    key: "CORRELATE",
    title: "Correlate",
    detail: "Related alerts are grouped into incidents with aggregated entities and tactics.",
    tag: "24h window",
  },
  {
    icon: BellRing,
    key: "RESPOND",
    title: "Respond",
    detail: "Incidents stream to the dashboard over WebSocket. Triage, update status, resolve.",
    tag: "live /ws",
  },
];

/** Loop period of the travelling ping (one segment per 2s, 4 segments). */
const PING_PERIOD_S = 8;
const PING_SEGMENT_S = PING_PERIOD_S / (STAGES.length - 1);

/**
 * PipelineFlow - the WATCH → INGEST → DETECT → CORRELATE → RESPOND flow,
 * drawn as a connected rail with a continuously travelling telemetry ping.
 */
export function PipelineFlow() {
  return (
    <section id="pipeline" className="border-t py-20 scroll-mt-14 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
            Pipeline
          </p>
          <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Five stages between a probe and a resolved incident
          </h2>
          <p className="mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg">
            This is the actual path every event takes through Hawk3ye. No queue
            of unprocessed logs: ingestion, detection, and correlation happen
            per event, as it arrives.
          </p>
        </Reveal>

        <ol className="relative mt-14 grid gap-8 md:grid-cols-5 md:gap-3">
          {/* Desktop rail + travelling ping */}
          <div
            aria-hidden="true"
            className="absolute left-6 top-6 hidden md:block"
            style={{ right: "calc(20% - 1.5rem)" }}
          >
            <div className="border-t border-dashed border-primary/30" />
            <span className="pipeline-ping" />
          </div>
          {/* Mobile vertical rail + travelling ping */}
          <div
            aria-hidden="true"
            className="absolute bottom-4 left-6 top-6 w-0 md:hidden"
          >
            <div className="h-full border-l border-dashed border-primary/30" />
            <span className="pipeline-ping pipeline-ping-vertical" />
          </div>
          {STAGES.map((stage, i) => (
            <Reveal key={stage.key} delay={i * 90}>
              <li className="relative flex gap-5 md:flex-col md:gap-0">
                <div className="relative z-10 flex h-12 w-12 flex-none items-center justify-center rounded-full border bg-card shadow-card">
                  <stage.icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  {/* Ring pulse synced to the travelling ping's arrival */}
                  <span
                    className="pipeline-node-ping"
                    style={{ animationDelay: `${i * PING_SEGMENT_S}s` }}
                  />
                </div>
                <div className="min-w-0 md:mt-5">
                  <p className="font-mono text-2xs tracking-widest text-muted-foreground">
                    {stage.key}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold">{stage.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                    {stage.detail}
                  </p>
                  <p className="mt-2.5 inline-block whitespace-nowrap rounded border bg-muted/60 px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                    {stage.tag}
                  </p>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
