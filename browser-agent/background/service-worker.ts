/**
 * Background Service Worker for Hawk3ye Browser Agent
 * Handles event batching, API communication, configuration management
 */

import { getApiClient, resetApiClient } from "../shared/api-client";
import type {
  AgentConfig,
  StoredConfig,
  ContentToBackgroundMessage,
  BackgroundToContentMessage,
  BrowserEvent,
  ExtensionStats,
} from "../shared/types";

// Global API client instance
let apiClient: ReturnType<typeof getApiClient> | null = null;
let currentConfig: StoredConfig | null = null;
let isInitialized = false;

/**
 * Initialize the agent with stored configuration
 */
async function initializeAgent(): Promise<void> {
  if (isInitialized) return;

  try {
    const { getApiClient } = await import("../shared/api-client");
    apiClient = await getApiClient();
    currentConfig = (await chrome.storage.sync.get(null)) as StoredConfig;

    if (currentConfig?.apiKey && currentConfig?.apiEndpoint) {
      // Recover any queued events from previous sessions
      const { ApiClient } = await import("../shared/api-client");
      const recoveredEvents = await ApiClient.recoverQueuedEvents();
      if (recoveredEvents.length > 0 && apiClient) {
        for (const event of recoveredEvents) {
          await apiClient.addEvent(event);
        }
        console.log(`[Hawk3ye] Recovered ${recoveredEvents.length} queued events`);
      }
    }

    isInitialized = true;
    console.log("[Hawk3ye] Background service worker initialized");
  } catch (error) {
    console.error("[Hawk3ye] Failed to initialize agent:", error);
  }
}

/**
 * Send message to all content scripts
 */
async function broadcastToContentScripts(message: BackgroundToContentMessage): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id) {
        try {
          await chrome.tabs.sendMessage(tab.id, message);
        } catch {
          // Tab might not have content script loaded, ignore
        }
      }
    }
  } catch (error) {
    console.error("[Hawk3ye] Failed to broadcast to content scripts:", error);
  }
}

/**
 * Handle messages from content scripts
 */
chrome.runtime.onMessage.addListener((message: ContentToBackgroundMessage, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(
  message: ContentToBackgroundMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: BackgroundToContentMessage) => void
): Promise<void> {
  try {
    switch (message.type) {
      case "BATCH_EVENTS": {
        if (!apiClient) {
          sendResponse({ type: "ERROR", payload: { message: "Agent not initialized" } });
          return;
        }
        for (const event of message.payload) {
          await apiClient.addEvent(event);
        }
        sendResponse({ type: "ACK", payload: { batch_id: "immediate", success: true } });
        break;
      }

      case "CSP_VIOLATION":
      case "DOM_INTEGRITY_VIOLATION":
      case "BOT_DETECTED":
      case "PAGE_LOAD": {
        if (!apiClient) {
          sendResponse({ type: "ERROR", payload: { message: "Agent not initialized" } });
          return;
        }
        await apiClient.addEvent(message.payload);
        sendResponse({ type: "ACK", payload: { batch_id: "single", success: true } });
        break;
      }

      case "GET_CONFIG": {
        if (!currentConfig) {
          sendResponse({ type: "CONFIG", payload: null });
          return;
        }
        sendResponse({
          type: "CONFIG",
          payload: {
            apiEndpoint: currentConfig.apiEndpoint,
            apiKey: currentConfig.apiKey,
            sourceId: currentConfig.sourceId,
            batchSize: currentConfig.batchSize,
            flushIntervalMs: currentConfig.flushIntervalMs,
            enableDomMonitoring: currentConfig.enableDomMonitoring,
            enableCspMonitoring: currentConfig.enableCspMonitoring,
            enableBotDetection: currentConfig.enableBotDetection,
            enableIntegrityMonitoring: currentConfig.enableIntegrityMonitoring,
            integrityCheckIntervalMs: currentConfig.integrityCheckIntervalMs,
            botDetectionThreshold: currentConfig.botDetectionThreshold,
          } as AgentConfig,
        });
        break;
      }

      case "PING": {
        sendResponse({ type: "PONG" });
        break;
      }

      default:
        sendResponse({ type: "ERROR", payload: { message: `Unknown message type: ${(message as any).type}` } });
    }
  } catch (error) {
    console.error("[Hawk3ye] Error handling message:", error);
    sendResponse({ type: "ERROR", payload: { message: error instanceof Error ? error.message : "Unknown error" } });
  }
}

/**
 * Handle storage changes (config updates)
 */
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "sync") return;

  const newConfig: Partial<StoredConfig> = {};
  for (const [key, change] of Object.entries(changes)) {
    newConfig[key as keyof StoredConfig] = change.newValue;
  }

  if (Object.keys(newConfig).length > 0) {
    currentConfig = { ...currentConfig, ...newConfig } as StoredConfig;

    // Reinitialize API client if config changed significantly
    if (newConfig.apiEndpoint || newConfig.apiKey || newConfig.sourceId) {
      resetApiClient();
      await initializeAgent();

      // Broadcast new config to content scripts
      if (currentConfig) {
        await broadcastToContentScripts({
          type: "CONFIG",
          payload: {
            apiEndpoint: currentConfig.apiEndpoint,
            apiKey: currentConfig.apiKey,
            sourceId: currentConfig.sourceId,
            batchSize: currentConfig.batchSize,
            flushIntervalMs: currentConfig.flushIntervalMs,
            enableDomMonitoring: currentConfig.enableDomMonitoring,
            enableCspMonitoring: currentConfig.enableCspMonitoring,
            enableBotDetection: currentConfig.enableBotDetection,
            enableIntegrityMonitoring: currentConfig.enableIntegrityMonitoring,
            integrityCheckIntervalMs: currentConfig.integrityCheckIntervalMs,
            botDetectionThreshold: currentConfig.botDetectionThreshold,
          } as AgentConfig,
        });
      }
    }
  }
});

/**
 * Periodic flush alarm
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "hawkeye-flush" && apiClient) {
    try {
      await apiClient.flush();
    } catch (error) {
      console.error("[Hawk3ye] Periodic flush failed:", error);
    }
  }
});

/**
 * Handle extension installation/update
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log("[Hawk3ye] Extension installed/updated:", details.reason);

  // Create default config if not exists
  const stored = await chrome.storage.sync.get(null);
  if (!stored.apiEndpoint) {
    await chrome.storage.sync.set({
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
      isEnabled: true,
    } as StoredConfig);
  }

  // Create periodic flush alarm
  await chrome.alarms.create("hawkeye-flush", { periodInMinutes: 1 });

  await initializeAgent();
});

/**
 * Handle browser startup
 */
chrome.runtime.onStartup.addListener(async () => {
  console.log("[Hawk3ye] Browser startup, initializing agent");
  await initializeAgent();
});

/**
 * Handle messages from popup/options pages
 */
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_STATS") {
    getStats().then(sendResponse);
    return true;
  }
  if (message.type === "FORCE_FLUSH") {
    forceFlush().then((result) => sendResponse({ success: true, result }));
    return true;
  }
  if (message.type === "HEALTH_CHECK") {
    healthCheck().then(sendResponse);
    return true;
  }
  if (message.type === "UPDATE_CONFIG") {
    updateConfig(message.payload).then(() => sendResponse({ success: true }));
    return true;
  }
  return false;
});

/**
 * Get extension statistics for popup
 */
async function getStats(): Promise<ExtensionStats> {
  const { ApiClient } = await import("../shared/api-client");
  const [queuedCount, stats] = await Promise.all([
    ApiClient.getQueuedCount(),
    ApiClient.getStats(),
  ]);

  return {
    eventsQueued: queuedCount,
    eventsSent: stats.eventsSent,
    eventsFailed: stats.eventsFailed,
    lastFlush: stats.lastFlush,
    lastError: stats.lastError,
    isConnected: !!(currentConfig?.apiKey && currentConfig?.apiEndpoint),
    config: currentConfig || {
      apiEndpoint: "",
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
      isEnabled: false,
    },
  };
}

/**
 * Force flush the event queue
 */
async function forceFlush(): Promise<any> {
  if (!apiClient) {
    throw new Error("Agent not initialized");
  }
  return apiClient.flush();
}

/**
 * Health check
 */
async function healthCheck(): Promise<any> {
  if (!apiClient) {
    return { status: "unhealthy", error: "Not initialized" };
  }
  return apiClient.healthCheck();
}

/**
 * Update configuration
 */
async function updateConfig(config: Partial<StoredConfig>): Promise<void> {
  currentConfig = { ...currentConfig, ...config } as StoredConfig;
  await chrome.storage.sync.set(currentConfig);
  resetApiClient();
  await initializeAgent();
}

// Initialize on load
initializeAgent();

// Export for testing
export { initializeAgent, getStats, forceFlush, healthCheck, updateConfig };