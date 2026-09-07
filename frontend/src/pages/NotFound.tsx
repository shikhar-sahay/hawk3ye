"use client";

import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Home, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Logo } from "@/components/ui/logo";
import { useRouteMeta } from "@/hooks/useRouteMeta";

/**
 * NotFoundPage - branded Hawk3ye 404. The hawk reports what it observed:
 * this route does not exist.
 */
export function NotFoundPage() {
  useRouteMeta(
    "Page not found",
    "This route does not exist on this Hawk3ye deployment."
  );

  // Ensure a 404-ish feel for client-side navigation history
  useEffect(() => {
    document.documentElement.dataset.route = "not-found";
    return () => {
      delete document.documentElement.dataset.route;
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main id="main-content" className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-24">
        {/* Faint grid backdrop */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--border) / 0.5) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border) / 0.5) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse 70% 60% at 50% 45%, black 30%, transparent 78%)",
            WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 45%, black 30%, transparent 78%)",
          }}
        />
        <div className="animate-fade-up relative max-w-lg text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border bg-card shadow-card">
            <Logo size={44} animated />
          </div>
          <p className="mt-6 font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">
            Observation log · 404
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            The hawk found nothing here
          </h1>
          <p className="mx-auto mt-3 max-w-md leading-relaxed text-muted-foreground">
            This route doesn't exist on this Hawk3ye deployment: no events, no
            alerts, no page. Whatever you're looking for may have moved, or the
            URL may have a typo.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link to="/">
                <Home className="mr-2 h-4 w-4" />
                Back to overview
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/get-started">
                <BookOpen className="mr-2 h-4 w-4" />
                Get started
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
