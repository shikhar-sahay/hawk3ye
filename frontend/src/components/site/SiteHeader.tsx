"use client";

import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { label: "Pipeline", href: "#pipeline", hash: "/#pipeline" },
  { label: "Detection", href: "#detection", hash: "/#detection" },
  { label: "FAQ", href: "#faq", hash: "/#faq" },
];

/**
 * SiteHeader - shared public-site header.
 *
 * The bar itself is full-bleed (border + background span the viewport);
 * only the inner content is constrained. Below md the nav collapses into
 * a drawer with focus management (focus moves in, Escape closes, focus
 * is restored, background scroll is locked).
 */
export function SiteHeader() {
  const { pathname } = useLocation();
  const onLanding = pathname === "/";
  const [open, setOpen] = React.useState(false);
  const menuButtonRef = React.useRef<HTMLButtonElement>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);

  // Lock body scroll + focus management while the drawer is open
  React.useEffect(() => {
    if (!open) return;
    const menuButton = menuButtonRef.current;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
      menuButton?.focus();
    };
  }, [open]);

  const navHref = (link: (typeof NAV_LINKS)[number]) => (onLanding ? link.href : link.hash);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-4 sm:px-6">
          <Link
            to="/"
            className="flex min-h-[44px] items-center gap-2"
            aria-label="Hawk3ye home"
          >
            <Logo size={24} />
            <span className="text-base font-semibold tracking-tight">Hawk3ye</span>
          </Link>

          <nav className="hidden items-center gap-1 text-sm text-muted-foreground md:flex" aria-label="Site">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={navHref(link)}
                className="rounded-md px-3 py-2 transition-colors hover:bg-accent hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <Button variant="ghost" size="sm" className="hidden min-h-[36px] sm:inline-flex" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
            <Button size="sm" className="hidden min-h-[36px] sm:inline-flex" asChild>
              <Link to="/get-started">
                Get started
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button
              ref={menuButtonRef}
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              aria-expanded={open}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile drawer (a sibling of the header: the header's backdrop-blur
          would otherwise become the containing block for this fixed overlay. */}
      <div
        className={cn(
          "fixed inset-0 z-50 md:hidden",
          open ? "pointer-events-auto" : "pointer-events-none"
        )}
        aria-hidden={!open}
      >
        <div
          className={cn(
            "absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity duration-200",
            open ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setOpen(false)}
        />
        <div
          className={cn(
            "absolute inset-y-0 right-0 flex w-72 max-w-[85vw] flex-col border-l bg-background shadow-card-hover transition-transform duration-200",
            open ? "translate-x-0" : "translate-x-full"
          )}
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
        >
          <div className="flex h-14 items-center justify-between border-b px-4">
            <span className="flex items-center gap-2 text-base font-semibold tracking-tight">
              <Logo size={20} />
              Hawk3ye
            </span>
            <Button
              ref={closeButtonRef}
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <nav className="flex flex-col p-4 text-sm" aria-label="Site mobile">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={navHref(link)}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-3 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
            <div className="my-3 border-t" />
            <Button variant="outline" className="justify-start" asChild>
              <Link to="/login" onClick={() => setOpen(false)}>Sign in</Link>
            </Button>
            <Button className="mt-2 justify-start" asChild>
              <Link to="/get-started" onClick={() => setOpen(false)}>
                Get started
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </nav>
        </div>
      </div>
    </>
  );
}
