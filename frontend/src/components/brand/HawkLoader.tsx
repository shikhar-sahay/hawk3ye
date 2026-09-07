"use client";

import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";

interface HawkLoaderProps {
  /** Optional label shown under the mark */
  label?: string;
  className?: string;
  size?: number;
}

/**
 * HawkLoader - the Hawk3ye loading state. The mark flaps its wings and
 * lifts slightly, with the observation ring pulsing beneath it. Pure CSS;
 * disabled under prefers-reduced-motion (renders as a static mark).
 */
export function HawkLoader({ label, className, size = 40 }: HawkLoaderProps) {
  return (
    <div className={cn("flex flex-col items-center gap-3", className)} role="status" aria-live="polite">
      <div className="relative flex items-center justify-center">
        <span className="hawk-loader-ring absolute h-12 w-12 rounded-full border border-primary/40" aria-hidden="true" />
        <Logo size={size} className="hawk-loader-mark relative" />
      </div>
      {label && <span className="font-mono text-2xs text-muted-foreground">{label}</span>}
      <span className="sr-only">{label ?? "Loading"}</span>
    </div>
  );
}
