import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions) {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  })
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return formatDistanceToNow(d, { addSuffix: true })
}

/**
 * Semantic severity palette. Values reference CSS custom properties so light
 * and dark themes each get a legible variant. Distinguishable by hue AND
 * lightness, never by hue alone (accessibility).
 */
export function getSeverityColor(severity: string): string {
  switch (severity?.toLowerCase()) {
    case 'critical':
      return 'text-severity-critical bg-severity-critical/10 border-severity-critical/30'
    case 'high':
      return 'text-severity-high bg-severity-high/10 border-severity-high/30'
    case 'medium':
      return 'text-severity-medium bg-severity-medium/10 border-severity-medium/30'
    case 'low':
      return 'text-severity-low bg-severity-low/10 border-severity-low/30'
    case 'info':
      return 'text-info bg-info/10 border-info/30'
    default:
      return 'text-muted-foreground bg-muted border-border'
  }
}

export function getStatusColor(status: string): string {
  switch (status?.toLowerCase()) {
    // Alert processing statuses
    case 'new':
      return 'text-severity-critical bg-severity-critical/10 border-severity-critical/30'
    case 'processing':
      return 'text-warning bg-warning/10 border-warning/30'
    case 'correlated':
      return 'text-info bg-info/10 border-info/30'
    case 'dismissed':
      return 'text-muted-foreground bg-muted border-border'
    // Incident lifecycle statuses
    case 'open':
      return 'text-destructive bg-destructive/10 border-destructive/20'
    case 'investigating':
      return 'text-info bg-info/10 border-info/30'
    case 'contained':
      return 'text-warning bg-warning/10 border-warning/30'
    case 'resolved':
      return 'text-success bg-success/10 border-success/30'
    default:
      return 'text-muted-foreground bg-muted border-border'
  }
}

export function getDetectionTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    brute_force: 'Brute Force',
    credential_stuffing: 'Credential Stuffing',
    enumeration: 'Enumeration',
    bot_detection: 'Bot Activity',
    sensitive_action: 'Sensitive Action',
    session_hijacking: 'Session Hijacking',
    api_abuse: 'API Abuse',
  }
  return labels[type] || type
}

export function getMitreTacticLabel(tactic: string): string {
  const labels: Record<string, string> = {
    reconnaissance: 'Reconnaissance',
    resource_development: 'Resource Development',
    initial_access: 'Initial Access',
    execution: 'Execution',
    persistence: 'Persistence',
    privilege_escalation: 'Privilege Escalation',
    defense_evasion: 'Defense Evasion',
    credential_access: 'Credential Access',
    discovery: 'Discovery',
    lateral_movement: 'Lateral Movement',
    collection: 'Collection',
    command_and_control: 'Command & Control',
    exfiltration: 'Exfiltration',
    impact: 'Impact',
  }
  return labels[tactic] || tactic
}

export function getSeverityBadgeVariant(severity: string): "default" | "destructive" | "outline" | "secondary" {
  switch (severity?.toLowerCase()) {
    case 'critical':
      return 'destructive'
    case 'high':
      return 'default'
    case 'medium':
      return 'secondary'
    case 'low':
      return 'outline'
    default:
      return 'outline'
  }
}

export function getStatusBadgeVariant(status: string): "default" | "destructive" | "outline" | "secondary" {
  switch (status?.toLowerCase()) {
    // Alert processing statuses (backend AlertStatus)
    case 'new':
      return 'destructive'
    case 'processing':
      return 'default'
    case 'correlated':
      return 'secondary'
    case 'dismissed':
      return 'outline'
    // Incident lifecycle statuses (backend IncidentStatus)
    case 'open':
      return 'destructive'
    case 'investigating':
      return 'default'
    case 'contained':
      return 'secondary'
    case 'resolved':
      return 'secondary'
    case 'closed':
      return 'outline'
    default:
      return 'outline'
  }
}

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

export function formatTimestamp(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

/**
 * Copy text to the clipboard, with a fallback for contexts where the
 * async Clipboard API is unavailable or denied (e.g. non-secure origins).
 * Resolves true when the text was copied, false otherwise.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fall back to a temporary textarea + execCommand
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}
