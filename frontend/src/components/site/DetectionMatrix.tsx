"use client";

import { Fragment, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Reveal } from "@/components/Reveal";

/**
 * Detection matrix data: every row reflects the real detectors in
 * hawkeye/services/detection/ and their configured thresholds
 * (hawkeye/config.py). ATT&CK IDs match the correlation engine's
 * mappings (hawkeye/services/correlation/engine.py).
 */
const ENGINES = [
  {
    name: "Brute Force",
    watches: "Repeated failed logins from a single source",
    trigger: "5 attempts / 15 min",
    techniques: ["T1110.001", "T1110.003"],
    tactic: "Credential Access",
    detail:
      "Tracks consecutive authentication failures per IP and per username within a rolling 15-minute window, including distributed attempts across multiple accounts.",
  },
  {
    name: "Credential Stuffing",
    watches: "One IP testing many usernames with leaked credentials",
    trigger: "10-min burst window",
    techniques: ["T1110.004"],
    tactic: "Credential Access",
    detail:
      "Flags bursts of logins spread across many unique usernames (the signature of replayed breach data) rather than repeated attempts on one account.",
  },
  {
    name: "Enumeration",
    watches: "404 scanning, path traversal, injection probes",
    trigger: "20+ 404s / 5 min",
    techniques: ["T1590.005", "T1083"],
    tactic: "Reconnaissance",
    detail:
      "Detects excessive not-found responses, suspicious path patterns, and injection attempts (SQLi, XSS, command, template) within a short window.",
  },
  {
    name: "Bot Activity",
    watches: "Automation and headless-browser signals",
    trigger: "confidence ≥ 0.7",
    techniques: ["T1583.006", "T1588.002"],
    tactic: "Resource Development",
    detail:
      "Scores requests on automation markers (headless browsers, devtools, known tooling) and rate patterns that indicate scripted access rather than users.",
  },
  {
    name: "Sensitive Actions",
    watches: "Exports, key creation, privilege and role changes",
    trigger: "per-event + window",
    techniques: ["T1005", "T1567"],
    tactic: "Collection",
    detail:
      "Watches high-value actions (data exports, API key creation, permission changes, account deletion) individually and as clustered sequences.",
  },
  {
    name: "Session Hijacking",
    watches: "One session used from multiple geographies",
    trigger: "1h hijack window",
    techniques: ["T1556.002", "T1550.001"],
    tactic: "Credential Access",
    detail:
      "Correlates session activity across IPs, estimates geographic distance from IP metadata, and flags concurrent or rapid session movement.",
  },
  {
    name: "API Abuse",
    watches: "Sustained high-rate or scraping access",
    trigger: "60+ RPM",
    techniques: ["T1059.007", "T1595"],
    tactic: "Discovery",
    detail:
      "Measures request rates per source against the configured RPM threshold, with error-rate and endpoint-diversity evidence to separate abuse from load.",
  },
];

/**
 * DetectionMatrix - the seven real detection engines as interactive rows
 * with their actual triggers and ATT&CK mappings. Rows expand for detail.
 */
export function DetectionMatrix() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <section id="detection" className="border-t py-20 scroll-mt-14 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
            Detection
          </p>
          <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Seven engines, mapped to ATT&CK
          </h2>
            <p className="mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg">
              These are Hawk3ye's actual detection mechanisms with their default
              triggers. Every alert carries the technique IDs that fired, so
              triage starts with context instead of a raw log line.
            </p>
        </Reveal>

        <Reveal delay={100}>
          <div className="mt-10 overflow-hidden rounded-lg border bg-card shadow-card">
            <table className="w-full text-sm">
              <caption className="sr-only">
                Detection engines, what they watch, their default triggers, and MITRE ATT&CK mappings
              </caption>
              <thead>
                <tr className="border-b bg-muted/50 text-left font-mono text-2xs uppercase tracking-wider text-muted-foreground">
                  <th scope="col" className="px-4 py-3 font-medium sm:px-5">Engine</th>
                  <th scope="col" className="hidden px-4 py-3 font-medium md:table-cell">Watches for</th>
                  <th scope="col" className="hidden px-4 py-3 font-medium sm:table-cell">Trigger</th>
                  <th scope="col" className="px-4 py-3 font-medium sm:px-5">ATT&CK</th>
                </tr>
              </thead>
              <tbody>
                {ENGINES.map((engine, i) => {
                  const isOpen = openIdx === i;
                  return (
                    <Fragment key={engine.name}>
                      <tr
                        className={`border-b align-top transition-colors ${
                          isOpen ? "bg-accent/50" : "hover:bg-muted/40"
                        }`}
                      >
                        <td className="px-4 py-3 sm:px-5">
                          <button
                            type="button"
                            onClick={() => setOpenIdx(isOpen ? null : i)}
                            aria-expanded={isOpen}
                            aria-controls={`engine-detail-${i}`}
                            className="flex min-h-[36px] items-center gap-1.5 text-left font-medium hover:text-primary"
                          >
                            <ChevronDown
                              className={`h-3.5 w-3.5 flex-none text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                              aria-hidden="true"
                            />
                            {engine.name}
                          </button>
                          {/* Mobile: watches-for lives under the name */}
                          <p className="mt-1 max-w-[16rem] text-xs text-muted-foreground md:hidden">
                            {engine.watches}
                          </p>
                        </td>
                        <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                          {engine.watches}
                        </td>
                        <td className="hidden px-4 py-3 md:table-cell">
                          <span className="whitespace-nowrap rounded border bg-muted/60 px-1.5 py-0.5 font-mono text-2xs text-muted-foreground">
                            {engine.trigger}
                          </span>
                        </td>
                        <td className="px-4 py-3 sm:px-5">
                          <div className="flex flex-col gap-1">
                            <span className="whitespace-nowrap font-mono text-xs text-foreground/80">
                              {engine.techniques.join(" · ")}
                            </span>
                            <span className="text-2xs text-muted-foreground">{engine.tactic}</span>
                          </div>
                        </td>
                      </tr>
                      {/* Expanded detail spans the full row so columns never shift */}
                      {isOpen && (
                        <tr id={`engine-detail-${i}`} className="border-b bg-accent/30">
                          <td colSpan={4} className="px-4 py-3 sm:px-5">
                            <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
                              <span className="font-medium text-foreground">{engine.name}:</span>{" "}
                              {engine.detail}
                            </p>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Reveal>
        <Reveal delay={150}>
          <p className="mt-3 text-xs text-muted-foreground">
            Triggers shown are defaults from <code className="font-mono">hawkeye/config.py</code>; every
            threshold is configurable per deployment.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
