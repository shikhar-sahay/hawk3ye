/**
 * Hawk3ye Browser Agent - Background Service Worker
 * Handles event batching, API communication, CSP report processing,
 * and message routing between content scripts and the backend
 */

import { APIClient, getAPIClient } from '../shared/api-client';
import type {
  AgentConfig,
  CSPViolationReport,
  DOMMutationRecord,
  IntegrityCheckResult,
  BotDetectionResult,
  RawEventIngest,
  ContentToBackgroundMessage,
  BackgroundToContentMessage,
} from '../shared/types';
import { STORAGE_KEYS } from '../shared/types';

// ============================================================================
// State Management
// ============================================================================

let apiClient: APIClient | null = null;
let config: AgentConfig | null = null;

// ============================================================================
// Initialization
// ============================================================================

async function initialize(): Promise<void> {
  console.log('[Hawk3ye Background] Initializing...');

  // Load stored config
  const stored = await chrome.storage.local.get(STORAGE_KEYS.CONFIG);
  const storedConfig = stored[STORAGE_KEYS.CONFIG] as Partial<AgentConfig> | undefined;

  // Default config (will be overridden by popup/settings)
  const defaultConfig: Partial<AgentConfig> = {
    apiEndpoint: 'http://localhost:8000/api/v1',
    apiKey: '',
    sourceId: 1,
  };

  config = { ...defaultConfig, ...storedConfig } as AgentConfig;

  // Initialize API client
  apiClient = getAPIClient(config);

  console.log('[Hawk3ye Background] Initialized with config:', {
    apiEndpoint: config.apiEndpoint,
    sourceId: config.sourceId,
    hasApiKey: !!config.apiKey,
  });

  // Test connection if API key is set
  if (config.apiKey) {
    const healthy = await apiClient.healthCheck();
    console.log('[Hawk3ye Background] Health check:', healthy ? 'OK' : 'FAILED');
  }
}

// ============================================================================
// Message Handlers
// ============================================================================

async function handleContentMessage(
  message: ContentToBackgroundMessage,
  sender: chrome.runtime.MessageSender
): Promise<void> {
  if (!apiClient || !config) {
    console.warn('[Hawk3ye Background] Not initialized, queueing message');
    return;
  }

  try {
    switch (message.type) {
      case 'EVENT_BATCH': {
        await apiClient.enqueueEvents(message.events);
        break;
      }

      case 'CSP_VIOLATION': {
        const event = convertCSPViolationToEvent(message.violation);
        await apiClient.enqueueEvent(event);
        break;
      }

      case 'DOM_MUTATION': {
        const events = convertDOMMutationsToEvents(message.mutations);
        await apiClient.enqueueEvents(events);
        break;
      }

      case 'INTEGRITY_VIOLATION': {
        const event = convertIntegrityViolationToEvent(message.violation);
        await apiClient.enqueueEvent(event);
        break;
      }

      case 'BOT_DETECTED': {
        const event = convertBotDetectionToEvent(message.result);
        await apiClient.enqueueEvent(event);
        break;
      }

      case 'PAGE_READY': {
        // Page loaded, could send page view event
        const event: RawEventIngest = {
          event_type: 'page_view',
          timestamp: new Date().toISOString(),
          metadata: {
            category: 'navigation',
            url: message.url,
            title: message.title,
            referrer: document.referrer,
          },
        };
        await apiClient.enqueueEvent(event);
        break;
      }

      case 'GET_CONFIG': {
        // Send current config to content script
        sendToContentScript(sender.tab?.id, {
          type: 'CONFIG_UPDATE',
          config: {
            enableCSPMonitoring: config.enableCSPMonitoring,
            enableDOMIntegrity: config.enableDOMIntegrity,
            enableBotDetection: config.enableBotDetection,
            integrityCheckIntervalMs: config.integrityCheckIntervalMs,
            botDetectionThreshold: config.botDetectionThreshold,
          },
        });
        break;
      }

      case 'PING': {
        // Respond to ping
        sendToContentScript(sender.tab?.id, { type: 'PONG' });
        break;
      }

      default: {
        // TypeScript exhaustiveness check
        const _exhaustive: never = message;
        console.warn('[Hawk3ye Background] Unknown message type:', _exhaustive);
      }
    }
  } catch (error) {
    console.error('[Hawk3ye Background] Error handling message:', error);
    sendToContentScript(sender.tab?.id, {
      type: 'ERROR',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ============================================================================
// Event Converters
// ============================================================================

function convertCSPViolationToEvent(violation: CSPViolationReport): RawEventIngest {
  const report = violation['csp-report'];
  return {
    event_type: 'csp_violation',
    timestamp: new Date().toISOString(),
    metadata: {
      category: 'csp_violation',
      document_uri: report['document-uri'],
      referrer: report.referrer,
      violated_directive: report['violated-directive'],
      effective_directive: report['effective-directive'],
      original_policy: report['original-policy'],
      blocked_uri: report['blocked-uri'],
      line_number: report['line-number'],
      column_number: report['column-number'],
      source_file: report['source-file'],
      script_sample: report['script-sample'],
      status_code: report['status-code'],
    },
  };
}

function convertDOMMutationsToEvents(mutations: DOMMutationRecord[]): RawEventIngest[] {
  return mutations.map((mutation) => ({
    event_type: `dom_${mutation.type}`,
    timestamp: new Date(mutation.timestamp).toISOString(),
    metadata: {
      category: 'dom_mutation',
      target: mutation.target,
      attribute_name: mutation.attributeName,
      old_value: mutation.oldValue,
      new_value: mutation.newValue,
      added_nodes_count: mutation.addedNodes.length,
      removed_nodes_count: mutation.removedNodes.length,
      added_nodes: mutation.addedNodes,
      removed_nodes: mutation.removedNodes,
    },
  }));
}

function convertIntegrityViolationToEvent(violation: IntegrityCheckResult): RawEventIngest {
  return {
    event_type: 'integrity_violation',
    timestamp: new Date(violation.timestamp).toISOString(),
    metadata: {
      category: 'integrity_check',
      element: violation.element,
      expected_hash: violation.expectedHash,
      actual_hash: violation.actualHash,
      matched: violation.matched,
    },
  };
}

function convertBotDetectionToEvent(result: BotDetectionResult): RawEventIngest {
  return {
    event_type: 'bot_detection',
    timestamp: new Date(result.timestamp).toISOString(),
    metadata: {
      category: 'bot_detection',
      score: result.score,
      is_bot: result.isBot,
      indicators: result.indicators.map((i) => ({
        name: i.name,
        detected: i.detected,
        confidence: i.confidence,
        details: i.details,
      })),
    },
  };
}

// ============================================================================
// Message Passing Helpers
// ============================================================================

function sendToContentScript(
  tabId: number | undefined,
  message: BackgroundToContentMessage
): void {
  if (!tabId) return;

  chrome.tabs.sendMessage(tabId, message).catch((err) => {
    // Ignore "Receiving end does not exist" errors - content script not loaded
    if (!err.message.includes('Receiving end does not exist')) {
      console.warn('[Hawk3ye Background] Failed to send to content script:', err);
    }
  });
}

function broadcastToAllTabs(message: BackgroundToContentMessage): void {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab.id) {
        sendToContentScript(tab.id, message);
      }
    }
  });
}

// ============================================================================
// Chrome API Listeners
// ============================================================================

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener(
  (message: ContentToBackgroundMessage, sender, sendResponse) => {
    handleContentMessage(message, sender).then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep message channel open for async response
  }
);

// Handle extension installation/update
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Hawk3ye Background] Extension installed/updated:', details.reason);

  if (details.reason === 'install') {
    // Set default config on first install
    chrome.storage.local.set({
      [STORAGE_KEYS.CONFIG]: {
        apiEndpoint: 'http://localhost:8000/api/v1',
        apiKey: '',
        sourceId: 1,
      },
    });
  }
});

// Handle storage changes (from popup)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[STORAGE_KEYS.CONFIG]) {
    const newConfig = changes[STORAGE_KEYS.CONFIG].newValue as Partial<AgentConfig>;
    if (newConfig && apiClient) {
      apiClient.updateConfig(newConfig);
      config = { ...config!, ...newConfig };

      // Broadcast config update to all content scripts
      broadcastToAllTabs({
        type: 'CONFIG_UPDATE',
        config: {
          enableCSPMonitoring: config.enableCSPMonitoring,
          enableDOMIntegrity: config.enableDOMIntegrity,
          enableBotDetection: config.enableBotDetection,
          integrityCheckIntervalMs: config.integrityCheckIntervalMs,
          botDetectionThreshold: config.botDetectionThreshold,
        },
      });

      console.log('[Hawk3ye Background] Config updated:', newConfig);
    }
  }
});

// Handle alarms for periodic tasks
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'flush-events' && apiClient) {
    apiClient.flush().catch((err) => {
      console.error('[Hawk3ye Background] Scheduled flush failed:', err);
    });
  }
});

// Set up periodic flush alarm
chrome.alarms.create('flush-events', { periodInMinutes: 0.5 }); // Every 30 seconds

// ============================================================================
// CSP Reporting Endpoint (for report-uri directive)
// ============================================================================

// Listen for CSP reports sent via report-uri / report-to
chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    // Check if this is a CSP report POST
    const isCSPReport = details.url.includes('/csp/report') &&
      details.method === 'POST' &&
      details.requestHeaders?.some((h) => h.name.toLowerCase() === 'content-type' &&
        h.value?.includes('application/csp-report'));

    if (isCSPReport && config?.enableCSPMonitoring) {
      // The actual report body will be handled by the content script's
      // SecurityPolicyViolationEvent listener, but we can also intercept here
      console.log('[Hawk3ye Background] CSP report detected via webRequest');
    }
  },
  { urls: ['<all_urls>'] },
  ['requestHeaders']
);

// ============================================================================
// Cleanup on Suspend
// ============================================================================

chrome.runtime.onSuspend.addListener(() => {
  console.log('[Hawk3ye Background] Suspending, flushing queue...');
  apiClient?.destroy();
});

// ============================================================================
// Initialize
// ============================================================================

initialize().catch((err) => {
  console.error('[Hawk3ye Background] Initialization failed:', err);
});

export {};