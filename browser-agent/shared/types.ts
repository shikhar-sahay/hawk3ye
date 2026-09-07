/**
 * Shared types between content scripts, background worker, and Hawk3ye backend
 * These match the backend schemas in hawkeye/schemas/
 */

export interface RawEvent {
  source_id: number;
  category: "http_request" | "auth_attempt" | "api_call" | "page_load" | "dom_mutation" | "csp_violation" | "bot_detection" | "session_event" | "sensitive_action";
  timestamp: string; // ISO 8601
  client_ip?: string;
  user_agent?: string;
  method?: string;
  url?: string;
  path?: string;
  query_params?: Record<string, string>;
  headers?: Record<string, string>;
  body_hash?: string;
  status_code?: number;
  response_time_ms?: number;
  user_id?: string;
  session_id?: string;
  request_id?: string;
  metadata?: Record<string, unknown>;
}

export interface NormalizedEvent extends RawEvent {
  id: number;
  event_hash: string;
  mitre_tactics: string[];
  mitre_techniques: string[];
  risk_score: number;
  anomaly_score: number;
  geo_country?: string;
  geo_city?: string;
  asn?: string;
  is_tor: boolean;
  is_proxy: boolean;
  is_datacenter: boolean;
}

export interface Alert {
  id: number;
  source_id: number;
  detection_type: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  confidence: number;
  status: "new" | "processing" | "acknowledged" | "resolved" | "suppressed";
  mitre_tactics: string[];
  mitre_techniques: string[];
  affected_ips: string[];
  affected_users: string[];
  evidence: Record<string, unknown>;
  raw_event_ids: number[];
  created_at: string;
  updated_at: string;
}

export interface Incident {
  id: number;
  source_id: number;
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  status: "open" | "investigating" | "contained" | "resolved" | "closed";
  mitre_tactics: string[];
  mitre_techniques: string[];
  affected_ips: string[];
  affected_users: string[];
  alert_ids: number[];
  created_at: string;
  updated_at: string;
  resolved_at?: string;
}

export interface Source {
  id: number;
  name: string;
  description?: string;
  base_url: string;
  is_active: boolean;
  api_key_prefix: string;
  api_key_hash: string;
  rate_limit_per_minute: number;
  created_at: string;
  updated_at: string;
  last_seen_at?: string;
}

export interface ApiKey {
  id: number;
  source_id: number;
  key_prefix: string;
  key_hash: string;
  name?: string;
  is_active: boolean;
  expires_at?: string;
  created_at: string;
  last_used_at?: string;
}

/**
 * Browser Agent specific event types
 */
export interface BrowserEvent extends RawEvent {
  category: "dom_mutation" | "csp_violation" | "bot_detection" | "page_load";
  metadata: {
    // DOM mutation specific
    mutation_type?: "childList" | "attributes" | "characterData" | "subtree";
    target_element?: string;
    added_nodes?: string[];
    removed_nodes?: string[];
    attribute_name?: string;
    old_value?: string;
    new_value?: string;

    // CSP violation specific
    csp_directive?: string;
    blocked_uri?: string;
    violated_directive?: string;
    source_file?: string;
    line_number?: number;
    column_number?: number;
    status_code?: number;

    // Bot detection specific
    bot_score?: number;
    bot_signals?: BotSignal[];
    detection_method?: "webdriver" | "automation_props" | "permissions" | "webgl" | "behavioral" | "timing";

    // Page load specific
    load_time_ms?: number;
    dom_content_loaded_ms?: number;
    resource_count?: number;
  };
}

export interface BotSignal {
  type: string;
  description: string;
  confidence: number; // 0-1
  evidence?: Record<string, unknown>;
}

export interface BatchedEvents {
  events: BrowserEvent[];
  source_id: number;
  api_key: string;
  batch_id: string;
  timestamp: string;
}

/**
 * Message types for communication between content scripts and background
 */
export type ContentToBackgroundMessage =
  | { type: "BATCH_EVENTS"; payload: BrowserEvent[] }
  | { type: "CSP_VIOLATION"; payload: BrowserEvent }
  | { type: "DOM_INTEGRITY_VIOLATION"; payload: BrowserEvent }
  | { type: "BOT_DETECTED"; payload: BrowserEvent }
  | { type: "PAGE_LOAD"; payload: BrowserEvent }
  | { type: "GET_CONFIG" }
  | { type: "PING" };

export type BackgroundToContentMessage =
  | { type: "CONFIG"; payload: AgentConfig }
  | { type: "ACK"; payload: { batch_id: string; success: boolean } }
  | { type: "ERROR"; payload: { message: string } }
  | { type: "PONG" };

export interface AgentConfig {
  apiEndpoint: string;
  apiKey: string;
  sourceId: number;
  batchSize: number;
  flushIntervalMs: number;
  enableDomMonitoring: boolean;
  enableCspMonitoring: boolean;
  enableBotDetection: boolean;
  enableIntegrityMonitoring: boolean;
  integrityCheckIntervalMs: number;
  botDetectionThreshold: number;
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: AgentConfig = {
  apiEndpoint: "http://localhost:8000",
  apiKey: "",
  sourceId: 1,
  batchSize: 50,
  flushIntervalMs: 30000,
  enableDomMonitoring: true,
  enableCspMonitoring: true,
  enableBotDetection: true,
  enableIntegrityMonitoring: true,
  integrityCheckIntervalMs: 60000,
  botDetectionThreshold: 70,
};

/**
 * Stored configuration in chrome.storage
 */
export interface StoredConfig {
  apiEndpoint: string;
  apiKey: string;
  sourceId: number;
  batchSize: number;
  flushIntervalMs: number;
  enableDomMonitoring: boolean;
  enableCspMonitoring: boolean;
  enableBotDetection: boolean;
  enableIntegrityMonitoring: boolean;
  integrityCheckIntervalMs: number;
  botDetectionThreshold: number;
  isEnabled: boolean;
}

/**
 * Event queue item for IndexedDB
 */
export interface QueuedEvent {
  id?: number;
  event: BrowserEvent;
  timestamp: number;
  retries: number;
  addedAt: number;
}

/**
 * Health check response from backend
 */
export interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  version: string;
  uptime_seconds: number;
  database: "connected" | "disconnected";
  detection_engine: "running" | "stopped";
  correlation_engine: "running" | "stopped";
}

/**
 * Ingestion response from backend
 */
export interface IngestionResponse {
  accepted: number;
  rejected: number;
  event_ids: number[];
  errors?: Array<{ index: number; error: string }>;
}

/**
 * Statistics for the extension popup
 */
export interface ExtensionStats {
  eventsQueued: number;
  eventsSent: number;
  eventsFailed: number;
  lastFlush: number | null;
  lastError: string | null;
  isConnected: boolean;
  config: StoredConfig;
}