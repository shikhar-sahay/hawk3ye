/**
 * API client for Hawk3ye backend communication
 * Handles batching, retries, authentication, and offline queue persistence
 */

import { openDB, DBSchema, IDBPDatabase } from "idb";
import type {
  BrowserEvent,
  BatchedEvents,
  IngestionResponse,
  AgentConfig,
  StoredConfig,
  QueuedEvent,
  HealthResponse,
} from "./types";

interface AgentDBSchema extends DBSchema {
  events: {
    key: number;
    value: QueuedEvent;
    indexes: { "by-timestamp": number };
  };
  config: {
    key: string;
    value: StoredConfig;
  };
  stats: {
    key: string;
    value: {
      eventsSent: number;
      eventsFailed: number;
      lastFlush: number | null;
      lastError: string | null;
    };
  };
}

const DB_NAME = "hawkeye-agent-db";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<AgentDBSchema>> | null = null;

function getDB(): Promise<IDBPDatabase<AgentDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<AgentDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore("events", { keyPath: "id", autoIncrement: true }).createIndex("by-timestamp", "timestamp");
        db.createObjectStore("config", { keyPath: "id" });
        db.createObjectStore("stats", { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

export class ApiClient {
  private config: AgentConfig;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private eventQueue: BrowserEvent[] = [];
  private isFlushing = false;
  private abortController: AbortController | null = null;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...config };
    this.persistConfig();
  }

  /**
   * Get current configuration
   */
  getConfig(): AgentConfig {
    return { ...this.config };
  }

  /**
   * Persist config to IndexedDB
   */
  private async persistConfig(): Promise<void> {
    const db = await getDB();
    await db.put("config", { id: "main", ...this.config } as StoredConfig & { id: string });
  }

  /**
   * Load config from IndexedDB
   */
  static async loadConfig(): Promise<AgentConfig | null> {
    const db = await getDB();
    const stored = await db.get("config", "main");
    if (!stored) return null;
    const { id, ...config } = stored;
    return config as AgentConfig;
  }

  /**
   * Add event to queue and schedule flush
   */
  async addEvent(event: BrowserEvent): Promise<void> {
    this.eventQueue.push(event);

    // Persist to IndexedDB for offline survival
    await this.persistEvent(event);

    // Schedule flush if not already scheduled
    if (!this.flushTimer && this.eventQueue.length >= this.config.batchSize) {
      this.flush();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), this.config.flushIntervalMs);
    }
  }

  /**
   * Persist single event to IndexedDB
   */
  private async persistEvent(event: BrowserEvent): Promise<void> {
    const db = await getDB();
    await db.add("events", {
      event,
      timestamp: Date.now(),
      retries: 0,
      addedAt: Date.now(),
    });
  }

  /**
   * Flush event queue to backend
   */
  async flush(): Promise<IngestionResponse | null> {
    if (this.isFlushing || this.eventQueue.length === 0) {
      return null;
    }

    this.isFlushing = true;
    this.flushTimer = null;

    const eventsToSend = [...this.eventQueue];
    this.eventQueue = [];

    const batch: BatchedEvents = {
      events: eventsToSend,
      source_id: this.config.sourceId,
      api_key: this.config.apiKey,
      batch_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };

    try {
      const response = await this.sendBatch(batch);

      if (response.accepted > 0) {
        await this.removePersistedEvents(eventsToSend.length);
        await this.updateStats({ eventsSent: response.accepted });
      }

      if (response.rejected > 0) {
        // Re-queue rejected events for retry
        const rejectedEvents = eventsToSend.filter((_, i) =>
          response.errors?.some((e) => e.index === i)
        );
        for (const event of rejectedEvents) {
          this.eventQueue.unshift(event);
        }
        await this.updateStats({ eventsFailed: response.rejected });
      }

      await this.updateStats({ lastFlush: Date.now(), lastError: null });
      return response;
    } catch (error) {
      // Re-queue all events on failure
      this.eventQueue.unshift(...eventsToSend);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await this.updateStats({ lastError: errorMessage, eventsFailed: eventsToSend.length });
      throw error;
    } finally {
      this.isFlushing = false;

      // Schedule next flush if there are more events
      if (this.eventQueue.length > 0) {
        this.flushTimer = setTimeout(() => this.flush(), this.config.flushIntervalMs);
      }
    }
  }

  /**
   * Send batch to Hawk3ye backend
   */
  private async sendBatch(batch: BatchedEvents): Promise<IngestionResponse> {
    this.abortController = new AbortController();
    const timeoutId = setTimeout(() => this.abortController?.abort(), 30000);

    try {
      const response = await fetch(`${this.config.apiEndpoint}/api/v1/events/ingest/batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": this.config.apiKey,
        },
        body: JSON.stringify(batch),
        signal: this.abortController.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return (await response.json()) as IngestionResponse;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("Request timeout");
      }
      throw error;
    }
  }

  /**
   * Remove persisted events from IndexedDB (oldest first)
   */
  private async removePersistedEvents(count: number): Promise<void> {
    const db = await getDB();
    const events = await db.getAllFromIndex("events", "by-timestamp", IDBKeyRange.lowerBound(0), count);
    for (const event of events) {
      if (event.id) await db.delete("events", event.id);
    }
  }

  /**
   * Update statistics in IndexedDB
   */
  private async updateStats(updates: Partial<{ eventsSent: number; eventsFailed: number; lastFlush: number | null; lastError: string | null }>): Promise<void> {
    const db = await getDB();
    const current = (await db.get("stats", "main")) || {
      id: "main",
      eventsSent: 0,
      eventsFailed: 0,
      lastFlush: null,
      lastError: null,
    };
    await db.put("stats", { ...current, ...updates, id: "main" });
  }

  /**
   * Get statistics
   */
  static async getStats(): Promise<{ eventsSent: number; eventsFailed: number; lastFlush: number | null; lastError: string | null }> {
    const db = await getDB();
    const stats = await db.get("stats", "main");
    return stats || { eventsSent: 0, eventsFailed: 0, lastFlush: null, lastError: null };
  }

  /**
   * Get queued events count from IndexedDB
   */
  static async getQueuedCount(): Promise<number> {
    const db = await getDB();
    return db.count("events");
  }

  /**
   * Recover queued events from IndexedDB on startup
   */
  static async recoverQueuedEvents(): Promise<BrowserEvent[]> {
    const db = await getDB();
    const queued = await db.getAllFromIndex("events", "by-timestamp");
    return queued.map((q) => q.event);
  }

  /**
   * Clear all queued events (e.g., on config change)
   */
  static async clearQueue(): Promise<void> {
    const db = await getDB();
    await db.clear("events");
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<HealthResponse | null> {
    try {
      this.abortController = new AbortController();
      const timeoutId = setTimeout(() => this.abortController?.abort(), 10000);

      const response = await fetch(`${this.config.apiEndpoint}/health`, {
        signal: this.abortController.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return { status: "unhealthy", version: "unknown", uptime_seconds: 0, database: "disconnected", detection_engine: "stopped", correlation_engine: "stopped" };
      }

      return (await response.json()) as HealthResponse;
    } catch {
      return null;
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}

/**
 * Singleton instance getter
 */
let apiClientInstance: ApiClient | null = null;

export async function getApiClient(): Promise<ApiClient> {
  if (apiClientInstance) return apiClientInstance;

  const config = await ApiClient.loadConfig();
  if (!config) {
    throw new Error("Agent not configured. Please set API endpoint and key in options.");
  }

  apiClientInstance = new ApiClient(config);
  return apiClientInstance;
}

export function resetApiClient(): void {
  if (apiClientInstance) {
    apiClientInstance.destroy();
    apiClientInstance = null;
  }
}