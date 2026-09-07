/**
 * Hawk3ye Frontend - Type Definitions
 * Matches the backend API schemas
 */

// ==================== Base Types ====================

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ApiError {
  detail: string;
  code?: string;
}

// ==================== Source Types ====================

export interface Source {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SourceListResponse {
  sources: Source[];
  total: number;
  limit: number;
  offset: number;
}

export interface SourceEventCounts {
  source_id: number;
  source_name: string;
  event_count: number;
  alert_count: number;
  incident_count: number;
  is_active: boolean;
}

export interface SourceCreate {
  name: string;
  description?: string;
  is_active?: boolean;
}

export interface SourceUpdate {
  name?: string;
  description?: string;
  is_active?: boolean;
}

// ==================== API Key Types ====================

export interface ApiKey {
  id: number;
  source_id: number;
  name: string;
  key_prefix: string;
  key_hash: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  last_used_at: string | null;
}

export interface ApiKeyCreate {
  name: string;
  expires_in_days?: number;
}

export interface ApiKeyResponse extends ApiKey {
  api_key: string; // Only returned on creation
}

// ==================== Event Types ====================

export interface NormalizedEvent {
  id: number;
  source_id: number;
  category: string;
  event_type: string;
  severity: "critical" | "high" | "medium" | "low";
  timestamp: string;
  user_id: string | null;
  session_id: string | null;
  ip: string | null;
  user_agent: string | null;
  route: string | null;
  method: string | null;
  status_code: number | null;
  metadata: Record<string, unknown>;
  mitre_tactic: string | null;
  mitre_technique: string | null;
  created_at: string;
}

export interface EventListParams {
  category?: string;
  event_type?: string;
  severity?: string;
  user_id?: string;
  ip?: string;
  route?: string;
  method?: string;
  status_code?: number;
  start_time?: string;
  end_time?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

// ==================== Alert Types ====================

export interface Alert {
  id: number;
  source_id: number;
  event_id: number;
  detection_type: string;
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  confidence: number;
  /** Backend AlertStatus vocabulary */
  status: "new" | "processing" | "correlated" | "dismissed";
  evidence: Record<string, unknown>;
  mitre_tactics: string[];
  mitre_techniques: string[];
  created_at: string;
  updated_at: string;
}

export interface AlertListParams {
  severity?: string;
  status?: string;
  detection_type?: string;
  search?: string;
  start_time?: string;
  end_time?: string;
  limit?: number;
  offset?: number;
}

export interface AlertStatusUpdate {
  status: "new" | "processing" | "correlated" | "dismissed";
}

export interface AlertStats {
  total: number;
  by_severity: Record<string, number>;
  by_status: Record<string, number>;
  by_detection_type: Record<string, number>;
  by_detector: Record<string, number>;
  avg_confidence: number | null;
}

// ==================== Incident Types ====================

export interface IncidentAlert {
  id: number;
  incident_id: number;
  alert_id: number;
  sequence: number;
}

export interface Incident {
  id: number;
  source_id: number;
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  /** Backend IncidentStatus vocabulary */
  status: "open" | "investigating" | "contained" | "resolved" | "closed";
  affected_ips: string[];
  affected_users: string[];
  mitre_tactics: string[];
  mitre_techniques: string[];
  alert_count: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  alerts?: Alert[];
}

export interface IncidentListParams {
  severity?: string;
  status?: string;
  affected_ip?: string;
  affected_user?: string;
  search?: string;
  start_time?: string;
  end_time?: string;
  limit?: number;
  offset?: number;
}

export interface IncidentStatusUpdate {
  status: "open" | "investigating" | "contained" | "resolved" | "closed";
}

export interface IncidentStats {
  total: number;
  by_severity: Record<string, number>;
  by_status: Record<string, number>;
  open_count: number;
  critical_count: number;
}

// ==================== Ingestion Types ====================

export interface RawEventIngest {
  timestamp: string;
  category: string;
  event_type: string;
  severity?: "critical" | "high" | "medium" | "low";
  user_id?: string;
  ip?: string;
  route?: string;
  method?: string;
  status_code?: number;
  user_agent?: string;
  request_body?: Record<string, unknown>;
  response_body?: Record<string, unknown>;
  headers?: Record<string, unknown>;
  mitre_tactics?: string[];
  mitre_techniques?: string[];
}

export interface BatchEventsIngest {
  events: RawEventIngest[];
}

export interface EventIngestResponse {
  success: boolean;
  event_id?: number;
  normalized_event_id?: number;
  error?: string;
}

export interface BatchIngestResponse {
  success: boolean;
  accepted: number;
  failed: number;
  event_ids: number[];
}

// ==================== WebSocket Types ====================

export interface WSMessage {
  type: "alert" | "incident" | "ping" | "pong" | "connected" | "error" | "subscribed" | "unsubscribed";
  timestamp: string;
  event_id?: number;
  data?: unknown;
  connection_id?: string;
  source_id?: number;
  source_name?: string;
  subscriptions?: string[];
  session_id?: string;
}

export interface WSConnectMessage {
  type: "subscribe" | "unsubscribe" | "pong" | "ping" | "reconnect";
  data?: {
    types?: string[];
    session_id?: string;
    last_event_id?: number;
  };
}

// ==================== Dashboard/Stats Types ====================

export interface DashboardStats {
  alerts: AlertStats;
  incidents: IncidentStats;
  sources: {
    total: number;
    active: number;
    inactive: number;
  };
  events_24h: number;
}

export interface TimeSeriesDataPoint {
  timestamp: string;
  value: number;
  label?: string;
}

export interface SeverityDistribution {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface DetectionTypeDistribution {
  [detectionType: string]: number;
}

export interface MITRETacticDistribution {
  [tactic: string]: number;
}

export interface MITRECoverage {
  by_tactic: Record<string, number>;
  by_technique: Record<string, number>;
  total_alerts_with_mitre: number;
}

// ==================== Settings Types ====================

export interface AppSettings {
  theme: "light" | "dark" | "system";
  sidebar_collapsed: boolean;
  notifications_enabled: boolean;
  auto_refresh_interval: number;
}