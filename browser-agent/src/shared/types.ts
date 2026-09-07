/**
 * Shared TypeScript types for Hawk3ye Browser Agent
 * These types mirror the backend schemas in hawkeye/schemas/events.py
 */

// ============================================================================
// Enums (matching hawkeye/models/enums.py)
// ============================================================================

export enum Severity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum DetectionType {
  BRUTE_FORCE = 'brute_force',
  CREDENTIAL_STUFFING = 'credential_stuffing',
  ENUMERATION = 'enumeration',
  BOT = 'bot',
  SENSITIVE_ACTION = 'sensitive_action',
  SESSION_HIJACKING = 'session_hijacking',
  API_ABUSE = 'api_abuse',
}

export enum EventCategory {
  AUTH = 'auth',
  NAVIGATION = 'navigation',
  FORM_SUBMIT = 'form_submit',
  API_REQUEST = 'api_request',
  CSP_VIOLATION = 'csp_violation',
  DOM_MUTATION = 'dom_mutation',
  BOT_DETECTION = 'bot_detection',
  INTEGRITY_CHECK = 'integrity_check',
  CUSTOM = 'custom',
}

export enum AlertStatus {
  NEW = 'new',
  PROCESSING = 'processing',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
  SUPPRESSED = 'suppressed',
}

export enum IncidentStatus {
  OPEN = 'open',
  INVESTIGATING = 'investigating',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

// ============================================================================
// Core Event Types
// ============================================================================

export interface RawEvent {
  id?: number;
  source_id: number;
  timestamp: string; // ISO 8601
  category: EventCategory;
  event_type: string;
  payload: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  user_id?: string;
  session_id?: string;
  request_id?: string;
  created_at?: string;
}

export interface NormalizedEvent extends RawEvent {
  id: number;
  mitre_tactic?: string;
  mitre_technique?: string;
  detection_types?: DetectionType[];
  confidence?: number;
  severity?: Severity;
}

// ============================================================================
// Ingestion Payloads (matching hawkeye/schemas/ingestion.py RawEventIngest)
// ============================================================================

export interface RawEventIngest {
  event_type: string;
  timestamp?: string;
  user_id?: string;
  session_id?: string;
  ip?: string;
  user_agent?: string;
  route?: string;
  method?: string;
  status_code?: number;
  metadata?: Record<string, unknown>;
}

export interface BatchEventsIngest {
  events: RawEventIngest[];
}

export interface BatchIngestResponse {
  success: boolean;
  accepted: number;
  failed: number;
  event_ids: number[];
}

// ============================================================================
// Alert & Incident Types (matching hawkeye/schemas/events.py)
// ============================================================================

export interface Alert {
  id: number;
  source_id: number;
  normalized_event_id: number;
  detection_type: DetectionType;
  severity: Severity;
  confidence: number;
  title: string;
  description: string;
  evidence: Record<string, unknown>;
  mitre_tactic?: string;
  mitre_technique?: string;
  status: AlertStatus;
  created_at: string;
  updated_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
}

export interface Incident {
  id: number;
  source_id: number;
  title: string;
  description: string;
  severity: Severity;
  status: IncidentStatus;
  mitre_tactics: string[];
  mitre_techniques: string[];
  affected_ips: string[];
  affected_users: string[];
  alert_count: number;
  first_alert_at: string;
  last_alert_at: string;
  created_at: string;
  updated_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
  closed_at?: string;
}

export interface IncidentAlert {
  incident_id: number;
  alert_id: number;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface AlertListResponse extends PaginatedResponse<Alert> {}
export interface IncidentListResponse extends PaginatedResponse<Incident> {}

// ============================================================================
// WebSocket Types (matching hawkeye/api/websocket.py)
// ============================================================================

export type WSMessageType =
  | 'connected'
  | 'alert'
  | 'incident'
  | 'event'
  | 'ping'
  | 'pong'
  | 'error'
  | 'subscribe'
  | 'unsubscribe'
  | 'reconnect';

export interface WSMessage<T = unknown> {
  type: WSMessageType;
  timestamp: string;
  event_id?: number;
  data?: T;
}

export interface WSConnectedData {
  connection_id: string;
  source_id: number;
  source_name: string;
  subscriptions: string[];
  session_id: string;
}

export interface WSAlertData {
  alert: Alert;
}

export interface WSIncidentData {
  incident: Incident;
}

export interface WSEventData {
  event: NormalizedEvent;
}

export interface WSErrorData {
  code: string;
  message: string;
}

export interface WSSubscribeData {
  types: string[];
}

export interface WSReconnectData {
  session_id: string;
  last_event_id: number;
}

// ============================================================================
// Browser Agent Specific Types
// ============================================================================

export interface AgentConfig {
  apiEndpoint: string;
  apiKey: string;
  sourceId: number;
  batchSize: number;
  flushIntervalMs: number;
  enableCSPMonitoring: boolean;
  enableDOMIntegrity: boolean;
  enableBotDetection: boolean;
  integrityCheckIntervalMs: number;
  botDetectionThreshold: number;
}

export interface QueuedEvent {
  event: RawEventIngest;
  timestamp: number;
  retries: number;
}

export interface CSPViolationReport {
  'csp-report': {
    'document-uri': string;
    referrer: string;
    'violated-directive': string;
    'effective-directive': string;
    'original-policy': string;
    'blocked-uri': string;
    'line-number': number;
    'column-number': number;
    'source-file': string;
    'script-sample': string;
    'status-code': number;
  };
}

export interface DOMMutationRecord {
  type: 'attributes' | 'characterData' | 'childList' | 'subtree';
  target: string; // CSS selector or element description
  attributeName?: string;
  oldValue?: string;
  newValue?: string;
  addedNodes: string[];
  removedNodes: string[];
  timestamp: number;
}

export interface IntegrityCheckResult {
  element: string; // CSS selector
  expectedHash: string;
  actualHash: string;
  matched: boolean;
  timestamp: number;
}

export interface BotDetectionResult {
  score: number; // 0-100
  indicators: BotIndicator[];
  isBot: boolean;
  timestamp: number;
}

export interface BotIndicator {
  name: string;
  detected: boolean;
  confidence: number;
  details?: Record<string, unknown>;
}

export interface StoredConfig {
  apiEndpoint: string;
  apiKey: string;
  sourceId: number;
  settings: Partial<AgentConfig>;
}

// ============================================================================
// Message Passing Types (Content Script ↔ Background)
// ============================================================================

export type ContentToBackgroundMessage =
  | { type: 'EVENT_BATCH'; events: RawEventIngest[] }
  | { type: 'CSP_VIOLATION'; violation: CSPViolationReport }
  | { type: 'DOM_MUTATION'; mutations: DOMMutationRecord[] }
  | { type: 'INTEGRITY_VIOLATION'; violation: IntegrityCheckResult }
  | { type: 'BOT_DETECTED'; result: BotDetectionResult }
  | { type: 'PAGE_READY'; url: string; title: string }
  | { type: 'GET_CONFIG' }
  | { type: 'PING' };

export type BackgroundToContentMessage =
  | { type: 'CONFIG_UPDATE'; config: Partial<AgentConfig> }
  | { type: 'FLUSH_EVENTS' }
  | { type: 'PONG' }
  | { type: 'ERROR'; error: string };

// ============================================================================
// Storage Keys
// ============================================================================

export const STORAGE_KEYS = {
  CONFIG: 'hawkeye:config',
  EVENT_QUEUE: 'hawkeye:event_queue',
  INTEGRITY_BASELINES: 'hawkeye:integrity_baselines',
  BOT_DETECTION_CACHE: 'hawkeye:bot_detection_cache',
  SESSION_DATA: 'hawkeye:session_data',
} as const;