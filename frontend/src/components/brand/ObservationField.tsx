"use client";

import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";

interface ObservationFieldProps {
  className?: string;
}

/**
 * ObservationField - the Hawk3ye hero visual.
 *
 * The hawk sits at the center of concentric observation rings. A slow
 * radar sweep rotates around it; telemetry signals (blips) appear on the
 * rings and streaks travel inward toward the hawk, where they become
 * detections. Pure SVG + CSS animation, no JS per frame.
 *
 * Decorative by definition: aria-hidden, pointer-events none, and fully
 * disabled under prefers-reduced-motion via the global stylesheet.
 */
export function ObservationField({ className }: ObservationFieldProps) {
  return (
    <div
      className={cn("pointer-events-none relative aspect-square w-full select-none", className)}
      aria-hidden="true"
    >
      {/* Observation rings + crosshair */}
      <svg viewBox="0 0 600 600" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="of-sweep" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.25" />
          </linearGradient>
          <radialGradient id="of-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.14" />
            <stop offset="70%" stopColor="hsl(var(--primary))" stopOpacity="0.03" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ambient core glow */}
        <circle cx="300" cy="300" r="290" fill="url(#of-core)" />

        {/* Concentric rings */}
        {[110, 175, 240, 292].map((r) => (
          <circle
            key={r}
            cx="300"
            cy="300"
            r={r}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth="1"
          />
        ))}
        {/* Ring tick marks */}
        {Array.from({ length: 24 }).map((_, i) => {
          const a = (i * 15 * Math.PI) / 180;
          const inner = 284;
          const outer = i % 6 === 0 ? 270 : 278;
          return (
            <line
              key={i}
              x1={300 + inner * Math.cos(a)}
              y1={300 + inner * Math.sin(a)}
              x2={300 + outer * Math.cos(a)}
              y2={300 + outer * Math.sin(a)}
              stroke="hsl(var(--border))"
              strokeWidth="1"
            />
          );
        })}
        {/* Crosshair */}
        <line x1="300" y1="8" x2="300" y2="592" stroke="hsl(var(--border))" strokeWidth="1" strokeDasharray="2 6" />
        <line x1="8" y1="300" x2="592" y2="300" stroke="hsl(var(--border))" strokeWidth="1" strokeDasharray="2 6" />

        {/* Radar sweep wedge (rotates) */}
        <g className="of-sweep">
          <path d="M300 300 L300 25 A275 275 0 0 1 462 79 Z" fill="url(#of-sweep)" />
          <line x1="300" y1="300" x2="300" y2="25" stroke="hsl(var(--primary))" strokeOpacity="0.5" strokeWidth="1.5" />
        </g>

        {/* Inbound signal streaks (translate toward center along radial lines) */}
        {[0, 60, 130, 200, 250, 310].map((deg, i) => (
          <g key={deg} transform={`rotate(${deg} 300 300)`}>
            <rect
              className="of-signal"
              x="299"
              y={110 + (i % 3) * 55}
              width="2"
              height="26"
              rx="1"
              fill="hsl(var(--primary))"
              style={{ animationDelay: `${i * 1.1}s` }}
            />
          </g>
        ))}

        {/* Detection blips on rings */}
        {[
          { cx: 428, cy: 205, r: 4, delay: 0 },
          { cx: 165, cy: 380, r: 3, delay: 1.4 },
          { cx: 385, cy: 448, r: 3.5, delay: 2.3 },
          { cx: 205, cy: 175, r: 3, delay: 3.1 },
        ].map((b, i) => (
          <g key={i}>
            <circle className="of-blip-ring" cx={b.cx} cy={b.cy} r={b.r * 3} fill="none" stroke="hsl(var(--primary))" strokeOpacity="0.5" style={{ animationDelay: `${b.delay}s` }} />
            <circle className="of-blip" cx={b.cx} cy={b.cy} r={b.r} fill="hsl(var(--primary))" style={{ animationDelay: `${b.delay}s` }} />
          </g>
        ))}
      </svg>

      {/* The hawk at the center of the field */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="relative flex h-44 w-44 items-center justify-center rounded-full border border-border bg-card/80 backdrop-blur-sm sm:h-56 sm:w-56">
          <div className="of-halo absolute inset-0 rounded-full border border-primary/40" />
          <Logo size={112} animated />
        </div>
      </div>

      {/* Floating telemetry chips */}
      <div className="of-chip of-chip-1 absolute left-[6%] top-[16%] rounded border border-border bg-card/90 px-2 py-1 font-mono text-2xs text-muted-foreground backdrop-blur-sm">
        login_failed · 401
      </div>
      <div className="of-chip of-chip-2 absolute right-[4%] top-[38%] rounded border border-severity-critical/40 bg-card/90 px-2 py-1 font-mono text-2xs text-severity-critical backdrop-blur-sm">
        brute_force · T1110.001
      </div>
      <div className="of-chip of-chip-3 absolute bottom-[14%] left-[14%] rounded border border-border bg-card/90 px-2 py-1 font-mono text-2xs text-muted-foreground backdrop-blur-sm">
        automation_detected
      </div>
      <div className="of-chip of-chip-4 absolute bottom-[24%] right-[10%] rounded border border-primary/40 bg-card/90 px-2 py-1 font-mono text-2xs text-primary backdrop-blur-sm">
        incident #104 · correlated
      </div>
    </div>
  );
}
