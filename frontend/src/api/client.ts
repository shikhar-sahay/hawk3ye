/**
 * Hawk3ye Frontend - API Client
 * Centralized API client with TanStack Query integration
 */

import type {
  Source,
  SourceCreate,
  SourceUpdate,
  ApiKey,
  ApiKeyCreate,
  ApiKeyResponse,
  NormalizedEvent,
  EventListParams,
  Alert,
  AlertListParams,
  AlertStatusUpdate,
  AlertStats,
  Incident,
  IncidentListParams,
  IncidentStatusUpdate,
  IncidentStats,
  RawEventIngest,
  BatchEventsIngest,
  EventIngestResponse,
  BatchIngestResponse,
  DashboardStats,
  TimeSeriesDataPoint,
  MITRECoverage,
  SourceEventCounts,
} from "@/types";
import { getStoredApiKey, notifyUnauthorized } from "@/auth";

/** Error with an HTTP status code, thrown by every API call */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const API_BASE = `${import.meta.env.VITE_API_BASE_URL ?? ""}/api/v1`;

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const apiKey = getStoredApiKey();
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(apiKey && { "X-API-Key": apiKey }),
        ...options.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        // Key missing/invalid/expired - let the app route back to login
        notifyUnauthorized();
      }
      // The Vite dev proxy answers a down backend with a 500/502 whose body
      // is plain text, so JSON parsing fails; surface a actionable message
      // instead of a generic "Unknown error".
      const raw = await response.text().catch(() => "");
      let detail = "";
      try {
        const parsed = JSON.parse(raw) as { detail?: string };
        detail = parsed.detail ?? "";
      } catch {
        detail = "";
      }
      if (!detail) {
        if ([500, 502, 503, 504].includes(response.status)) {
          detail =
            "Could not reach the Hawk3ye backend. Make sure the server is running, then try again.";
        } else {
          detail = `Request failed (HTTP ${response.status})`;
        }
      }
      throw new ApiError(detail, response.status);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  // ==================== Sources ====================

  async getSources(params: { limit?: number; offset?: number; search?: string; is_active?: boolean } = {}): Promise<{ sources: Source[]; total: number; limit: number; offset: number }> {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const query = searchParams.toString();
    return this.request(`/sources${query ? `?${query}` : ""}`);
  }

  async getSource(id: number): Promise<Source> {
    return this.request<Source>(`/sources/${id}`);
  }

  async createSource(data: SourceCreate): Promise<Source> {
    return this.request<Source>("/sources", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateSource(id: number, data: SourceUpdate): Promise<Source> {
    return this.request<Source>(`/sources/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteSource(id: number): Promise<void> {
    return this.request<void>(`/sources/${id}`, {
      method: "DELETE",
    });
  }

  // ==================== API Keys ====================

  async getApiKeys(sourceId: number): Promise<ApiKey[]> {
    return this.request<ApiKey[]>(`/sources/${sourceId}/api-keys`);
  }

  async createApiKey(sourceId: number, data: ApiKeyCreate): Promise<ApiKeyResponse> {
    return this.request<ApiKeyResponse>(`/sources/${sourceId}/api-keys`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async revokeApiKey(sourceId: number, keyId: number): Promise<void> {
    return this.request<void>(`/sources/${sourceId}/api-keys/${keyId}`, {
      method: "DELETE",
    });
  }

  async getSourceEventCounts(): Promise<SourceEventCounts[]> {
    return this.request<SourceEventCounts[]>("/sources/event-counts");
  }

  // ==================== Events ====================

  async getEvents(params: EventListParams = {}): Promise<{ events: NormalizedEvent[]; total: number; limit: number; offset: number }> {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    return this.request(`/events/query?${searchParams.toString()}`);
  }

  async getEvent(id: number): Promise<NormalizedEvent> {
    return this.request<NormalizedEvent>(`/events/${id}`);
  }

  async getEventAlerts(eventId: number): Promise<Alert[]> {
    return this.request<Alert[]>(`/events/${eventId}/alerts`);
  }

  // ==================== Alerts ====================

  async getAlerts(params: AlertListParams = {}): Promise<{ alerts: Alert[]; total: number; limit: number; offset: number }> {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    return this.request(`/alerts?${searchParams.toString()}`);
  }

  async getAlert(id: number): Promise<Alert> {
    return this.request<Alert>(`/alerts/${id}`);
  }

  async updateAlertStatus(id: number, data: AlertStatusUpdate): Promise<Alert> {
    return this.request<Alert>(`/alerts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async getAlertStats(): Promise<AlertStats> {
    return this.request<AlertStats>("/alerts/stats");
  }

  async getAlertsOverTime(hours: number = 24): Promise<TimeSeriesDataPoint[]> {
    return this.request<TimeSeriesDataPoint[]>(`/alerts/time-series?hours=${hours}`);
  }

  async getMITRECoverage(): Promise<MITRECoverage> {
    return this.request<MITRECoverage>("/alerts/mitre-coverage");
  }

  // ==================== Incidents ====================

  async getIncidents(params: IncidentListParams = {}): Promise<{ incidents: Incident[]; total: number; limit: number; offset: number }> {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    return this.request(`/incidents?${searchParams.toString()}`);
  }

  async getIncident(id: number): Promise<Incident> {
    return this.request<Incident>(`/incidents/${id}`);
  }

  async getIncidentAlerts(incidentId: number): Promise<Alert[]> {
    return this.request<Alert[]>(`/incidents/${incidentId}/alerts`);
  }

  async updateIncidentStatus(id: number, data: IncidentStatusUpdate): Promise<Incident> {
    return this.request<Incident>(`/incidents/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async getIncidentStats(): Promise<IncidentStats> {
    return this.request<IncidentStats>("/incidents/stats");
  }

  // ==================== Ingestion ====================

  async ingestEvent(data: RawEventIngest): Promise<EventIngestResponse> {
    return this.request<EventIngestResponse>("/events", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async ingestBatch(data: BatchEventsIngest): Promise<BatchIngestResponse> {
    return this.request<BatchIngestResponse>("/events/batch", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // ==================== Dashboard ====================

  async getDashboardStats(): Promise<DashboardStats> {
    const [alertStats, incidentStats, sourcesResponse, sourceEventCounts] = await Promise.all([
      this.getAlertStats(),
      this.getIncidentStats(),
      this.getSources({ limit: 1, offset: 0 }), // Only need the total; counts come from event-counts
      this.getSourceEventCounts().catch(() => []), // Fallback to empty array if endpoint fails
    ]);

    const totalEvents = sourceEventCounts.reduce((sum, s) => sum + s.event_count, 0);

    return {
      alerts: alertStats,
      incidents: incidentStats,
      sources: {
        total: sourcesResponse.total,
        active: sourceEventCounts.filter((s) => s.is_active).length || sourcesResponse.total,
        inactive: Math.max(0, sourcesResponse.total - (sourceEventCounts.filter((s) => s.is_active).length || sourcesResponse.total)),
      },
      events_24h: totalEvents, // Total events across all sources (best available without 24h endpoint)
    };
  }
}

export const apiClient = new ApiClient();

// ==================== Query Keys ====================

export const queryKeys = {
  sources: {
    all: ["sources"] as const,
    detail: (id: number) => ["sources", id] as const,
  },
  apiKeys: {
    all: (sourceId: number) => ["sources", sourceId, "api-keys"] as const,
  },
  events: {
    all: ["events"] as const,
    list: (params: EventListParams) => ["events", "list", params] as const,
    detail: (id: number) => ["events", id] as const,
    alerts: (eventId: number) => ["events", eventId, "alerts"] as const,
  },
  alerts: {
    all: ["alerts"] as const,
    list: (params: AlertListParams) => ["alerts", "list", params] as const,
    detail: (id: number) => ["alerts", id] as const,
    stats: ["alerts", "stats"] as const,
    overTime: (hours: number) => ["alerts", "over-time", hours] as const,
    mitreCoverage: ["alerts", "mitre-coverage"] as const,
  },
  incidents: {
    all: ["incidents"] as const,
    list: (params: IncidentListParams) => ["incidents", "list", params] as const,
    detail: (id: number) => ["incidents", id] as const,
    alerts: (incidentId: number) => ["incidents", incidentId, "alerts"] as const,
    stats: ["incidents", "stats"] as const,
  },
  dashboard: {
    stats: ["dashboard", "stats"] as const,
  },
};