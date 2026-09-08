"use client";

import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { Logo } from "@/components/ui/logo";

/**
 * SiteFooter - shared public-site footer.
 */
export function SiteFooter() {
  return (
    <footer className="border-t bg-card/40 py-12">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2">
            <Logo size={22} />
            <span className="font-semibold tracking-tight">Hawk3ye</span>
          </div>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Self-hosted security monitoring for web applications. Ingest events,
            detect attacks, correlate incidents; your telemetry stays in your
            infrastructure.
          </p>
          <p className="mt-4 font-mono text-2xs text-muted-foreground">
            MIT license · SQLite / PostgreSQL · FastAPI + React
          </p>
        </div>
        <div className="text-sm">
          <p className="font-medium">Product</p>
          <ul className="mt-3 space-y-1">
            <li>
              <a href="/#pipeline" className="inline-flex min-h-[36px] items-center text-muted-foreground hover:text-foreground">Pipeline</a>
            </li>
            <li>
              <a href="/#detection" className="inline-flex min-h-[36px] items-center text-muted-foreground hover:text-foreground">Detection engines</a>
            </li>
            <li>
              <a href="/#faq" className="inline-flex min-h-[36px] items-center text-muted-foreground hover:text-foreground">FAQ</a>
            </li>
            <li>
              <Link to="/get-started" className="inline-flex min-h-[36px] items-center text-muted-foreground hover:text-foreground">Get started</Link>
            </li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="font-medium">Resources</p>
          <ul className="mt-3 space-y-1">
            <li>
              <a
                href={`${import.meta.env.VITE_API_BASE_URL ?? ""}/docs`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[36px] items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                API reference <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </li>
            <li>
              <a
                href="https://github.com/shikhar-sahay/hawk3ye"
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[36px] items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                GitHub repository <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </li>
            <li>
              <Link to="/login" className="inline-flex min-h-[36px] items-center text-muted-foreground hover:text-foreground">Sign in</Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="mx-auto mt-10 flex max-w-7xl flex-wrap items-center justify-between gap-2 border-t px-4 pt-6 text-xs text-muted-foreground sm:px-6">
        <span>Hawk3ye is released under the MIT license.</span>
        <span className="font-mono">watch → ingest → detect → correlate → respond</span>
      </div>
    </footer>
  );
}
