/**
 * Hawk3ye Browser Agent - DOM Mutation Monitor Content Script
 * Monitors DOM changes, CSP violations, and DOM integrity
 */

import type {
  AgentConfig,
  DOMMutationRecord,
  IntegrityCheckResult,
  CSPViolationReport,
  ContentToBackgroundMessage,
  BackgroundToContentMessage,
} from '../shared/types';

// ============================================================================
// Configuration
// ============================================================================

let config: Partial<AgentConfig> = {
  enableCSPMonitoring: true,
  enableDOMIntegrity: true,
  enableBotDetection: true,
  integrityCheckIntervalMs: 60000,
  botDetectionThreshold: 70,
};

// ============================================================================
// State
// ============================================================================

const mutationQueue: DOMMutationRecord[] = [];
let mutationFlushTimer: number | null = null;
const integrityBaselines = new Map<string, string>();
let integrityCheckTimer: number | null = null;
let isInitialized = false;

// ============================================================================
// Initialization
// ============================================================================

async function initialize(): Promise<void> {
  if (isInitialized) return;

  // Request config from background
  try {
    const response = await sendToBackground({ type: 'GET_CONFIG' });
    if (response?.config) {
      config = { ...config, ...response.config };
    }
  } catch {
    console.warn('[Hawk3ye Content] Failed to get config from background');
  }

  // Set up CSP violation listener
  if (config.enableCSPMonitoring) {
    setupCSPListener();
  }

  // Set up DOM mutation observer
  setupMutationObserver();

  // Set up DOM integrity monitoring
  if (config.enableDOMIntegrity) {
    await captureIntegrityBaselines();
    startIntegrityChecks();
  }

  // Notify background that page is ready
  sendToBackground({
    type: 'PAGE_READY',
    url: window.location.href,
    title: document.title,
  });

  isInitialized = true;
  console.log('[Hawk3ye Content] Initialized', { url: window.location.href });
}

// ============================================================================
// CSP Violation Monitoring
// ============================================================================

function setupCSPListener(): void {
  document.addEventListener('securitypolicyviolation', (event) => {
    if (!config.enableCSPMonitoring) return;

    const violation: CSPViolationReport = {
      'csp-report': {
        'document-uri': event.documentURI,
        referrer: event.referrer || '',
        'violated-directive': event.violatedDirective,
        'effective-directive': event.effectiveDirective,
        'original-policy': event.originalPolicy,
        'blocked-uri': event.blockedURI,
        'line-number': event.lineNumber,
        'column-number': event.columnNumber,
        'source-file': event.sourceFile,
        'script-sample': event.sample || '',
        'status-code': event.statusCode,
      },
    };

    sendToBackground({
      type: 'CSP_VIOLATION',
      violation,
    });
  });

  console.log('[Hawk3ye Content] CSP violation listener registered');
}

// ============================================================================
// DOM Mutation Monitoring
// ============================================================================

function setupMutationObserver(): void {
  const observer = new MutationObserver((mutations) => {
    if (!config.enableDOMIntegrity) return;

    const records: DOMMutationRecord[] = mutations.map((mutation) => ({
      type: mutation.type,
      target: getElementSelector(mutation.target),
      attributeName: mutation.attributeName || undefined,
      oldValue: mutation.oldValue || undefined,
      newValue: mutation.type === 'attributes'
        ? (mutation.target as Element).getAttribute(mutation.attributeName || '') || undefined
        : undefined,
      addedNodes: Array.from(mutation.addedNodes).map((n) => getNodeDescription(n)),
      removedNodes: Array.from(mutation.removedNodes).map((n) => getNodeDescription(n)),
      timestamp: Date.now(),
    }));

    // Filter out noise (text node changes, etc.)
    const significant = records.filter(isSignificantMutation);
    if (significant.length > 0) {
      mutationQueue.push(...significant);
      scheduleMutationFlush();
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeOldValue: true,
    characterData: true,
    characterDataOldValue: true,
  });

  console.log('[Hawk3ye Content] MutationObserver registered');
}

function getElementSelector(element: Node): string {
  if (element.nodeType === Node.ELEMENT_NODE) {
    const el = element as Element;
    if (el.id) return `#${el.id}`;
    if (el.className && typeof el.className === 'string') {
      const classes = el.className.split(' ').filter((c) => c).join('.');
      if (classes) return `${el.tagName.toLowerCase()}.${classes}`;
    }
    return el.tagName.toLowerCase();
  }
  return element.nodeName;
}

function getNodeDescription(node: Node): string {
  if (node.nodeType === Node.ELEMENT_NODE) {
    return getElementSelector(node);
  }
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node as Text).textContent || '';
    return `#text: "${text.slice(0, 50)}"`;
  }
  return node.nodeName;
}

function isSignificantMutation(record: DOMMutationRecord): boolean {
  // Ignore text-only changes in non-critical elements
  if (record.type === 'characterData') return false;

  // Ignore additions/removals of comments
  if (record.addedNodes.some((n) => n.startsWith('#comment'))) return false;
  if (record.removedNodes.some((n) => n.startsWith('#comment'))) return false;

  // Always track script, iframe, form, input changes
  const criticalTags = ['script', 'iframe', 'form', 'input', 'button', 'a', 'link', 'meta'];
  const targetTag = record.target.split('.')[0].split('#')[0];
  if (criticalTags.includes(targetTag.toLowerCase())) return true;

  // Track attribute changes on critical attributes
  const criticalAttrs = ['src', 'href', 'action', 'onclick', 'onload', 'onerror', 'integrity'];
  if (record.attributeName && criticalAttrs.includes(record.attributeName.toLowerCase())) {
    return true;
  }

  return true; // Default to tracking
}

function scheduleMutationFlush(): void {
  if (mutationFlushTimer) return;

  mutationFlushTimer = window.setTimeout(() => {
    flushMutations();
    mutationFlushTimer = null;
  }, 1000); // Batch mutations for 1 second
}

function flushMutations(): void {
  if (mutationQueue.length === 0) return;

  const mutations = [...mutationQueue];
  mutationQueue.length = 0;

  sendToBackground({
    type: 'DOM_MUTATION',
    mutations,
  });
}

// ============================================================================
// DOM Integrity Monitoring
// ============================================================================

async function captureIntegrityBaselines(): Promise<void> {
  // Define critical elements to monitor
  const criticalSelectors = [
    'form',
    'input[type="password"]',
    'input[type="email"]',
    'input[name*="token"]',
    'input[name*="csrf"]',
    'button[type="submit"]',
    'a[href^="https://"]',
    'script[src]',
    'iframe[src]',
    'link[rel="stylesheet"]',
    'meta[name="csp"]',
    '[data-hawkeye-integrity]',
  ];

  for (const selector of criticalSelectors) {
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
      const key = getElementKey(el);
      const hash = await computeElementHash(el);
      integrityBaselines.set(key, hash);
    }
  }

  // Store baselines in session storage for persistence across navigations
  sessionStorage.setItem('hawkeye:integrity_baselines', JSON.stringify(
    Array.from(integrityBaselines.entries())
  ));

  console.log('[Hawk3ye Content] Captured integrity baselines for', integrityBaselines.size, 'elements');
}

function getElementKey(element: Element): string {
  // Create a stable identifier for the element
  const path = getElementPath(element);
  const attrs = ['id', 'name', 'type', 'action', 'src', 'href', 'integrity']
    .map((attr) => element.getAttribute(attr))
    .filter(Boolean)
    .join('|');
  return `${path}|${attrs}`;
}

function getElementPath(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase();
    if (current.id) {
      selector += `#${current.id}`;
      parts.unshift(selector);
      break;
    } else {
      const siblings = Array.from(current.parentElement?.children || []);
      const index = siblings.indexOf(current);
      if (index >= 0) {
        selector += `:nth-child(${index + 1})`;
      }
    }
    parts.unshift(selector);
    current = current.parentElement;
  }

  return parts.join(' > ');
}

async function computeElementHash(element: Element): Promise<string> {
  // Hash critical attributes and innerHTML for scripts/iframes
  const criticalAttrs = ['src', 'href', 'integrity', 'action', 'onclick', 'onload', 'onerror'];
  const attrString = criticalAttrs
    .map((attr) => element.getAttribute(attr))
    .filter(Boolean)
    .join('|');

  let content = attrString;

  if (element.tagName === 'SCRIPT' || element.tagName === 'IFRAME') {
    content += '|' + (element.innerHTML || (element as HTMLScriptElement).src || '');
  }

  // Simple hash function (in production, use SubtleCrypto)
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return Math.abs(hash).toString(16);
}

function startIntegrityChecks(): void {
  if (integrityCheckTimer) return;

  const interval = config.integrityCheckIntervalMs || 60000;

  integrityCheckTimer = window.setInterval(async () => {
    await checkIntegrity();
  }, interval);

  console.log('[Hawk3ye Content] Integrity checks started, interval:', interval);
}

async function checkIntegrity(): Promise<void> {
  const violations: IntegrityCheckResult[] = [];

  for (const [key, expectedHash] of integrityBaselines) {
    const element = findElementByKey(key);
    if (!element) {
      // Element removed - could be a violation
      violations.push({
        element: key,
        expectedHash,
        actualHash: 'REMOVED',
        matched: false,
        timestamp: Date.now(),
      });
      continue;
    }

    const actualHash = await computeElementHash(element);
    if (actualHash !== expectedHash) {
      violations.push({
        element: key,
        expectedHash,
        actualHash,
        matched: false,
        timestamp: Date.now(),
      });

      // Update baseline to new value (could be legitimate update)
      integrityBaselines.set(key, actualHash);
    }
  }

  if (violations.length > 0) {
    sendToBackground({
      type: 'INTEGRITY_VIOLATION',
      violation: violations[0], // Send first violation, could batch
    });
  }
}

function findElementByKey(key: string): Element | null {
  // This is a simplified lookup - in production, use a more robust method
  const [path] = key.split('|');
  try {
    return document.querySelector(path);
  } catch {
    return null;
  }
}

// ============================================================================
// Message Passing
// ============================================================================

function sendToBackground(message: ContentToBackgroundMessage): Promise<BackgroundToContentMessage | void> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        // Ignore "Receiving end does not exist" - background might not be ready
        if (!chrome.runtime.lastError.message.includes('Receiving end does not exist')) {
          console.warn('[Hawk3ye Content] Message error:', chrome.runtime.lastError.message);
        }
        resolve();
      } else {
        resolve(response);
      }
    });
  });
}

// Listen for config updates from background
chrome.runtime.onMessage.addListener(
  (message: BackgroundToContentMessage, _sender, sendResponse) => {
    switch (message.type) {
      case 'CONFIG_UPDATE':
        config = { ...config, ...message.config };
        console.log('[Hawk3ye Content] Config updated:', message.config);
        sendResponse({ success: true });
        break;

      case 'FLUSH_EVENTS':
        flushMutations();
        sendResponse({ success: true });
        break;

      case 'PONG':
        // Heartbeat response
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
    return true;
  }
);

// ============================================================================
// Cleanup
// ============================================================================

window.addEventListener('beforeunload', () => {
  flushMutations();
  if (mutationFlushTimer) clearTimeout(mutationFlushTimer);
  if (integrityCheckTimer) clearInterval(integrityCheckTimer);
});

// ============================================================================
// Initialize
// ============================================================================

// Run at document_start, so wait for DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

export {};