"use client";

import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  /** Rendered size in px (square asset) */
  size?: number;
  /** Enables the subtle idle breathing animation */
  animated?: boolean;
}

/**
 * Logo - the single canonical Hawk3ye mark (frontend/public/hawkeyelogo.png).
 * All Hawk3ye branding across the site must use this component; do not
 * introduce alternate hawk graphics.
 */
export function Logo({ className, size = 32, animated = false }: LogoProps) {
  return (
    <img
      src="/hawkeyelogo.png"
      alt=""
      width={size}
      height={size}
      className={cn("select-none", animated && "logo-animated", className)}
      aria-hidden="true"
      draggable={false}
    />
  );
}

/**
 * Logo with wordmark for header/sidebar branding
 */
export function LogoWithText({ className, size = 32 }: LogoProps) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <Logo size={size} />
      <span className="text-xl font-bold tracking-tight text-foreground">Hawk3ye</span>
    </span>
  );
}
