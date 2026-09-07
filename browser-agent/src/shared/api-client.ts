/**
 * API Client for Hawk3ye Browser Agent
 * Handles HTTP communication with the Hawk3ye backend
 */

import type {
  RawEventIngest,
  BatchEventsIngest,
  BatchIngestResponse,
  AgentConfig,
  QueuedEvent,
} from './types';

const DEFAULT_CONFIG: Partial<AgentConfig> = {
  batchSize: 50,
  flushIntervalMs: 30000,
  enableCSPMonitoring: true,
  enableDOMIntegrity: true,
  enableBotDetection: true,
  integrityCheckIntervalMs: 60000,
  botDetectionThreshold: 70,
};

export class APIClient {
  private config: AgentConfig;
  private eventQueue: QueuedEvent[] = [];
  private flushTimer: number | null = null;
  private isOnline = true;
  private db: IDBDatabase | null = null;

  constructor(config: Partial<AgentConfig> = {}) {
    this.config = {
      apiEndpoint: config.apiEndpoint || 'http://localhost:8000/api/v1',
      apiKey: config.apiKey || '',
      sourceId: config.sourceId || 1,
      ...DEFAULT_CONFIG,
      ...config,
    } as AgentConfig;

    this.initDB();
    this.startFlushTimer();
    this.setupOnlineListener();
  }

  // =========================================================================
  // IndexedDB for Offline Persistence
  // =========================================================================

  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('hawkeye-agent', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        this.loadQueuedEvents().then(() => resolve()).catch(reject);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('events')) {
          db.createObjectStore('events', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('config')) {
          db.createObjectStore('config', { keyPath: 'key' });
        }
      };
    });
  }

  private async loadQueuedEvents(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('events', 'readonly');
      const store = tx.objectStore('events');
      const request = store.getAll();

      request.onsuccess = () => {
        this.eventQueue = request.result.map((r) => ({
          event: r.event,
          timestamp: r.timestamp,
          retries: r.retries,
        }));
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  private async saveQueuedEvents(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('events', 'readwrite');
      const store = tx.objectStore('events');

      // Clear and rewrite
      const clearRequest = store.clear();
      clearRequest.onsuccess = () => {
        for (const item of this.eventQueue) {
          store.add(item);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  private async saveConfig(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('config', 'readwrite');
      const store = tx.objectStore('config');
      store.put({ key: 'config', value: this.config });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // =========================================================================
  // Configuration
  // =========================================================================

  updateConfig(updates: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
    this.restartFlushTimer();
  }

  getConfig(): AgentConfig {
    return { ...this.config };
  }

  // =========================================================================
  // Event Queue Management
  // =========================================================================

  /**
   * RawEventIngest now matches backend schema directly (after types.ts update).
   * This method is a pass-through since the types are already aligned.
   */
  private toBackendEvent(event: RawEventIngest): RawEventIngest {
    // The event is already in backend-compatible format
    // Just ensure optional fields are properly handled
    return {
      event_type: event.event_type,
      timestamp: event.timestamp,
      user_id: event.user_id,
      session_id: event.session_id,
      ip: event.ip,
      user_agent: event.user_agent,
      route: event.route,
      method: event.method,
      status_code: event.status_code,
      metadata: event.metadata,
    };
  }

  async enqueueEvent(event: RawEventIngest): Promise<void> {
    const queuedEvent: QueuedEvent = {
      event: this.toBackendEvent(event),
      timestamp: Date.now(),
      retries: 0,
    };

    this.eventQueue.push(queuedEvent);

    // Flush immediately if batch size reached
    if (this.eventQueue.length >= this.config.batchSize) {
      await this.flush();
    } else {
      await this.saveQueuedEvents();
    }
  }

  async enqueueEvents(events: RawEventIngest[]): Promise<void> {
    for (const event of events) {
      await this.enqueueEvent(event);
    }
  }

  async flush(): Promise<BatchIngestResponse | null> {
    if (this.eventQueue.length === 0 || !this.isOnline) {
      return null;
    }

    const batch = this.eventQueue.splice(0, this.config.batchSize);
    const payload: BatchEventsIngest = {
      events: batch.map((q) => q.event),
    };

    try {
      const response = await this.post<BatchIngestResponse>('/events/ingest/batch', payload);

      // Save remaining queue
      await this.saveQueuedEvents();

      // If failed > 0, we don't have per-event error details, so re-queue all from this batch
      if (!response.success || response.failed > 0) {
        for (const failed of batch) {
          this.eventQueue.unshift({
            event: failed.event,
            timestamp: failed.timestamp,
            retries: failed.retries + 1,
          });
        }
        await this.saveQueuedEvents();
      }

      return response;
    } catch (error) {
      // Re-queue events on failure
      this.eventQueue.unshift(...batch);
      await this.saveQueuedEvents();

      // Schedule retry with exponential backoff
      this.scheduleRetry(batch);
      throw error;
    }
  }

  private scheduleRetry(batch: QueuedEvent[]): void {
    const maxRetries = 3;
    const retryable = batch.filter((b) => b.retries < maxRetries);

    if (retryable.length === 0) {
      console.warn('[Hawk3ye] Max retries exceeded, dropping events:', batch.length);
      return;
    }

    const delay = Math.min(1000 * 2 ** retryable[0].retries, 30000);
    setTimeout(() => {
      if (this.isOnline) {
        this.flush();
      }
    }, delay);
  }

  // =========================================================================
  // HTTP Methods
  // =========================================================================

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.config.apiEndpoint}${path}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-API-Key': this.config.apiKey,
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(`API Error ${response.status}: ${error.detail || 'Unknown error'}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  // =========================================================================
  // Flush Timer
  // =========================================================================

  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = window.setInterval(() => {
      if (this.eventQueue.length > 0 && this.isOnline) {
        this.flush().catch((err) => {
          console.error('[Hawk3ye] Flush failed:', err);
        });
      }
    }, this.config.flushIntervalMs);
  }

  private restartFlushTimer(): void {
    this.startFlushTimer();
  }

  stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  // =========================================================================
  // Online/Offline Handling
  // =========================================================================

  private setupOnlineListener(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('[Hawk3ye] Back online, flushing queue');
      this.flush().catch((err) => console.error('[Hawk3ye] Online flush failed:', err));
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('[Hawk3ye] Gone offline, queueing events');
    });

    // Check initial state
    this.isOnline = navigator.onLine;
  }

  // =========================================================================
  // Health Check
  // =========================================================================

  async healthCheck(): Promise<boolean> {
    try {
      await this.get('/health');
      return true;
    } catch {
      return false;
    }
  }

  // =========================================================================
  // Cleanup
  // =========================================================================

  destroy(): void {
    this.stopFlushTimer();
    this.flush().catch(console.error);
  }
}

// Singleton instance for background script
let apiClientInstance: APIClient | null = null;

export function getAPIClient(config?: Partial<AgentConfig>): APIClient {
  if (!apiClientInstance) {
    apiClientInstance = new APIClient(config);
  }
  return apiClientInstance;
}

export function setAPIClient(client: APIClient): void {
  apiClientInstance = client;
}