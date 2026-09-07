"use client";

import { Reveal } from "@/components/Reveal";

const FAQS = [
  {
    q: "What is Hawk3ye?",
    a: "A self-hosted security monitoring platform for web applications. You send it security events over a REST API; it normalizes them with MITRE ATT&CK context, scores every event against seven detection engines, correlates related alerts into incidents, and streams everything to a live dashboard.",
  },
  {
    q: "What can it detect?",
    a: "Brute force, credential stuffing, enumeration (404 scanning and injection probes), bot and automation activity, sensitive actions like data exports and key creation, session hijacking across geographies, and API abuse at sustained high request rates. Every alert carries the ATT&CK techniques that fired.",
  },
  {
    q: "How do events get into Hawk3ye?",
    a: "Your application POSTs events to /api/v1/events, one at a time or in batches of up to 1,000, authenticated with the API key of the source the events belong to. Events are normalized and ATT&CK-tagged at ingestion, then run through all detection engines.",
  },
  {
    q: "How does authentication work?",
    a: "Per-source API keys, no user accounts. Each monitored application is registered as a source and its keys act as both the ingestion credential and the dashboard login. Keys are shown once at creation and stored only in the browser you sign in from.",
  },
  {
    q: "Where is my telemetry stored?",
    a: "Entirely in your infrastructure. Hawk3ye runs on SQLite for evaluation and PostgreSQL for production. No events, alerts, or incidents ever leave your deployment; the dashboard talks to your own backend.",
  },
];

/**
 * FAQSection - five real questions about real Hawk3ye behavior,
 * rendered as native disclosure elements.
 */
export function FAQSection() {
  return (
    <section id="faq" className="border-t bg-card/40 py-20 scroll-mt-14 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <Reveal>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">FAQ</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Straight answers
          </h2>
        </Reveal>
        <Reveal delay={100}>
          <div className="mt-8 divide-y rounded-lg border bg-card shadow-card">
            {FAQS.map((faq) => (
              <details key={faq.q} className="group px-5">
                <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-4 py-3 font-medium [&::-webkit-details-marker]:hidden">
                  {faq.q}
                  <Chevron />
                </summary>
                <p className="pb-4 text-sm leading-relaxed text-muted-foreground">{faq.a}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Chevron() {
  return (
    <svg
      className="h-4 w-4 flex-none text-muted-foreground transition-transform group-open:rotate-180"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
