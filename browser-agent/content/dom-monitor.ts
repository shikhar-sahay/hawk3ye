/**
 * Content Script: DOM Mutation Monitor
 * Detects DOM mutations, CSP violations, and monitors DOM integrity
 */

import type { BrowserEvent, AgentConfig, BackgroundToContentMessage } from "../shared/types";

// Configuration received from background
let config: AgentConfig | null = null;
let isEnabled = false;

// DOM integrity monitoring
let baselineHashes: Map<string, string> = new Map();
let integrityCheckTimer: ReturnType<typeof setInterval> | null = null;
let mutationQueue: BrowserEvent[] = [];
let mutationFlushTimer: ReturnType<typeof setTimeout> | null = null;

// CSP violation listener
let cspViolationHandler: ((event: SecurityPolicyViolationEvent) => void) | null = null;

// Mutation observer
let mutationObserver: MutationObserver | null = null;

/**
 * Initialize the DOM monitor
 */
async function initialize(): Promise<void> {
  try {
    // Request config from background
    const response = await chrome.runtime.sendMessage({ type: "GET_CONFIG" } as any);
    if (response?.payload) {
      config = response.payload as AgentConfig;
      isEnabled = true;
      setupListeners();
      console.log("[Hawk3ye] DOM Monitor initialized");
    }
  } catch (error) {
    console.error("[Hawk3ye] DOM Monitor initialization failed:", error);
  }
}

/**
 * Set up all event listeners
 */
function setupListeners(): void {
  if (!config) return;

  if (config.enableDomMonitoring) {
    setupMutationObserver();
  }

  if (config.enableCspMonitoring) {
    setupCspViolationListener();
  }

  if (config.enableIntegrityMonitoring) {
    captureBaselineHashes();
    startIntegrityChecks();
  }

  // Page load event
  if (document.readyState === "complete") {
    sendPageLoadEvent();
  } else {
    window.addEventListener("load", sendPageLoadEvent, { once: true });
  }

  // Listen for config updates from background
  chrome.runtime.onMessage.addListener(handleBackgroundMessage);
}

/**
 * Handle messages from background script
 */
function handleBackgroundMessage(message: BackgroundToContentMessage): void {
  switch (message.type) {
    case "CONFIG":
      if (message.payload) {
        config = message.payload;
        // Re-setup listeners if config changed
        cleanup();
        setupListeners();
      }
      break;
    case "ERROR":
      console.error("[Hawk3ye] Background error:", message.payload.message);
      break;
  }
}

/**
 * Set up MutationObserver for DOM changes
 */
function setupMutationObserver(): void {
  if (mutationObserver) return;

  mutationObserver = new MutationObserver((mutations) => {
    if (!config?.enableDomMonitoring) return;

    for (const mutation of mutations) {
      // Filter out noise (Hawk3ye's own elements, style changes, etc.)
      if (shouldIgnoreMutation(mutation)) continue;

      const event = createDomMutationEvent(mutation);
      queueEvent(event);
    }
  });

  mutationObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeOldValue: true,
    characterData: true,
    characterDataOldValue: true,
  });
}

/**
 * Determine if a mutation should be ignored
 */
function shouldIgnoreMutation(mutation: MutationRecord): boolean {
  const target = mutation.target as Node;

  // Ignore mutations in script/style elements we don't care about
  if (target.nodeType === Node.ELEMENT_NODE) {
    const element = target as Element;

    // Ignore mutations to our own tracking elements
    if (element.hasAttribute("data-hawkeye-ignore")) return true;

    // Ignore style mutations (too noisy)
    if (mutation.type === "attributes" && mutation.attributeName === "style") return true;

    // Ignore data-* attribute changes (often used by frameworks)
    if (mutation.type === "attributes" && mutation.attributeName?.startsWith("data-")) return true;

    // Ignore class changes on common UI elements (too noisy)
    if (mutation.type === "attributes" && mutation.attributeName === "class") {
      const classList = element.classList;
      if (classList.contains("hover") || classList.contains("active") || classList.contains("focus")) {
        return true;
      }
    }
  }

  // Ignore text node changes in non-critical elements
  if (mutation.type === "characterData") {
    const parent = target.parentElement;
    if (parent && (parent.tagName === "SCRIPT" || parent.tagName === "STYLE" || parent.tagName === "NOSCRIPT")) {
      return true;
    }
  }

  return false;
}

/**
 * Create a DOM mutation event from a MutationRecord
 */
function createDomMutationEvent(mutation: MutationRecord): BrowserEvent {
  const target = mutation.target as Node;
  let targetElement = "";
  let mutationType: BrowserEvent["metadata"]["mutation_type"] = "subtree";

  if (target.nodeType === Node.ELEMENT_NODE) {
    const element = target as Element;
    targetElement = getElementSelector(element);
  } else if (target.nodeType === Node.TEXT_NODE) {
    targetElement = getElementSelector(target.parentElement!);
    mutationType = "characterData";
  } else if (target.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
    targetElement = "document";
  }

  const addedNodes: string[] = [];
  const removedNodes: string[] = [];

  mutation.addedNodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      addedNodes.push(getElementSelector(node as Element));
    } else if (node.nodeType === Node.TEXT_NODE) {
      addedNodes.push(`#text: ${node.textContent?.slice(0, 100)}`);
    }
  });

  mutation.removedNodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      removedNodes.push(getElementSelector(node as Element));
    } else if (node.nodeType === Node.TEXT_NODE) {
      removedNodes.push(`#text: ${node.textContent?.slice(0, 100)}`);
    }
  });

  return {
    source_id: config?.sourceId || 1,
    category: "dom_mutation",
    timestamp: new Date().toISOString(),
    client_ip: "", // Will be filled by backend
    user_agent: navigator.userAgent,
    url: window.location.href,
    path: window.location.pathname,
    query_params: Object.fromEntries(new URLSearchParams(window.location.search)),
    metadata: {
      mutation_type: mutation.type === "attributes" ? "attributes" : mutationType,
      target_element: targetElement,
      added_nodes: addedNodes.length > 0 ? addedNodes : undefined,
      removed_nodes: removedNodes.length > 0 ? removedNodes : undefined,
      attribute_name: mutation.attributeName || undefined,
      old_value: mutation.oldValue || undefined,
      new_value: mutation.type === "attributes" ? (target as Element).getAttribute(mutation.attributeName || "") : undefined,
    },
  };
}

/**
 * Generate a CSS selector for an element
 */
function getElementSelector(element: Element | null): string {
  if (!element) return "unknown";

  if (element.id) {
    return `#${element.id}`;
  }

  const path: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase();

    if (current.className && typeof current.className === "string") {
      const classes = current.className.split(/\s+/).filter((c) => c && !c.startsWith("hawkeye-"));
      if (classes.length > 0) {
        selector += "." + classes.slice(0, 2).join(".");
      }
    }

    // Add nth-child if needed for uniqueness
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter((el) => el.tagName === current.tagName);
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }

    path.unshift(selector);
    current = parent;

    if (path.length > 4) break; // Limit depth
  }

  return path.join(" > ");
}

/**
 * Set up CSP violation listener
 */
function setupCspViolationListener(): void {
  if (cspViolationHandler) return;

  cspViolationHandler = (event: SecurityPolicyViolationEvent) => {
    if (!config?.enableCspMonitoring) return;

    const cspEvent: BrowserEvent = {
      source_id: config.sourceId,
      category: "csp_violation",
      timestamp: new Date().toISOString(),
      user_agent: navigator.userAgent,
      url: window.location.href,
      path: window.location.pathname,
      metadata: {
        csp_directive: event.directive,
        blocked_uri: event.blockedURI,
        violated_directive: event.violatedDirective,
        source_file: event.sourceFile,
        line_number: event.lineNumber,
        column_number: event.columnNumber,
        status_code: event.statusCode,
      },
    };

    sendEventImmediate(cspEvent);
  };

  document.addEventListener("securitypolicyviolation", cspViolationHandler);
}

/**
 * Capture baseline hashes for integrity monitoring
 */
function captureBaselineHashes(): void {
  if (!config?.enableIntegrityMonitoring) return;

  baselineHashes.clear();

  // Critical elements to monitor
  const selectors = [
    "form",
    'input[type="password"]',
    'input[type="email"]',
    'input[type="text"][name*="user"]',
    'input[type="text"][name*="login"]',
    'input[type="text"][name*="email"]',
    "button[type=submit]",
    'button:has-text("login")',
    'button:has-text("sign in")',
    'button:has-text("pay")',
    'button:has-text("checkout")',
    'a[href*="payment"]',
    'a[href*="checkout"]',
    'a[href*="billing"]',
    "script[src]",
    "iframe[src]",
    "[data-critical]",
  ];

  for (const selector of selectors) {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el, index) => {
        const key = `${selector}[${index}]`;
        const hash = computeElementHash(el);
        if (hash) baselineHashes.set(key, hash);
      });
    } catch {
      // Selector might be invalid, ignore
    }
  }

  // Also hash all script src attributes
  document.querySelectorAll("script[src]").forEach((script, index) => {
    const key = `script[src][${index}]`;
    const src = script.getAttribute("src");
    if (src) {
      baselineHashes.set(key, simpleHash(src));
    }
  });

  // Hash all iframe src
  document.querySelectorAll("iframe[src]").forEach((iframe, index) => {
    const key = `iframe[src][${index}]`;
    const src = iframe.getAttribute("src");
    if (src) {
      baselineHashes.set(key, simpleHash(src));
    }
  });
}

/**
 * Compute a simple hash of an element's critical attributes
 */
function computeElementHash(element: Element): string | null {
  const parts: string[] = [];

  parts.push(element.tagName.toLowerCase());

  if (element.id) parts.push(`id:${element.id}`);
  if (element.className && typeof element.className === "string") {
    parts.push(`class:${element.className}`);
  }

  // Critical attributes
  const criticalAttrs = ["action", "method", "href", "src", "name", "type", "value", "onclick", "onload", "onerror"];
  for (const attr of criticalAttrs) {
    const value = element.getAttribute(attr);
    if (value) parts.push(`${attr}:${value}`);
  }

  // For forms, include input names
  if (element.tagName === "FORM") {
    const inputs = element.querySelectorAll("input, select, textarea");
    inputs.forEach((input) => {
      const name = input.getAttribute("name");
      if (name) parts.push(`input:${name}`);
    });
  }

  if (parts.length === 1) return null; // Only tag name, not distinctive enough

  return simpleHash(parts.join("|"));
}

/**
 * Simple hash function
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Start periodic integrity checks
 */
function startIntegrityChecks(): void {
  if (integrityCheckTimer) return;
  if (!config?.integrityCheckIntervalMs) return;

  integrityCheckTimer = setInterval(() => {
    checkIntegrity();
  }, config.integrityCheckIntervalMs);
}

/**
 * Check integrity of monitored elements
 */
function checkIntegrity(): void {
  if (!config?.enableIntegrityMonitoring) return;

  for (const [key, baselineHash] of baselineHashes.entries()) {
    try {
      // Parse selector to find element
      const elements = document.querySelectorAll(key.split("[")[0]);
      const indexMatch = key.match(/\[(\d+)\]$/);
      const index = indexMatch ? parseInt(indexMatch[1], 10) : 0;

      if (elements[index]) {
        const currentHash = computeElementHash(elements[index]);
        if (currentHash && currentHash !== baselineHash) {
          // Integrity violation detected
          const event: BrowserEvent = {
            source_id: config.sourceId,
            category: "dom_mutation",
            timestamp: new Date().toISOString(),
            user_agent: navigator.userAgent,
            url: window.location.href,
            path: window.location.pathname,
            metadata: {
              mutation_type: "attributes",
              target_element: key,
              attribute_name: "integrity_hash",
              old_value: baselineHash,
              new_value: currentHash,
            },
          };

          sendEventImmediate(event);

          // Update baseline to new hash
          baselineHashes.set(key, currentHash);
        }
      } else {
        // Element was removed
        const event: BrowserEvent = {
          source_id: config.sourceId,
          category: "dom_mutation",
          timestamp: new Date().toISOString(),
          user_agent: navigator.userAgent,
          url: window.location.href,
          path: window.location.pathname,
          metadata: {
            mutation_type: "childList",
            target_element: key,
            removed_nodes: [key],
          },
        };

        sendEventImmediate(event);
        baselineHashes.delete(key);
      }
    } catch {
      // Selector might be invalid now, ignore
    }
  }

  // Also check for new scripts/iframes that weren't in baseline
  checkNewScriptsAndIframes();
}

/**
 * Check for newly injected scripts/iframes
 */
function checkNewScriptsAndIframes(): void {
  if (!config?.enableIntegrityMonitoring) return;

  // Check scripts
  document.querySelectorAll("script[src]").forEach((script, index) => {
    const key = `script[src][${index}]`;
    const src = script.getAttribute("src");
    if (src && !baselineHashes.has(key)) {
      const event: BrowserEvent = {
        source_id: config!.sourceId,
        category: "dom_mutation",
        timestamp: new Date().toISOString(),
        user_agent: navigator.userAgent,
        url: window.location.href,
        path: window.location.pathname,
        metadata: {
          mutation_type: "childList",
          target_element: "head",
          added_nodes: [`script[src="${src}"]`],
        },
      };
      sendEventImmediate(event);
      baselineHashes.set(key, simpleHash(src));
    }
  });

  // Check iframes
  document.querySelectorAll("iframe[src]").forEach((iframe, index) => {
    const key = `iframe[src][${index}]`;
    const src = iframe.getAttribute("src");
    if (src && !baselineHashes.has(key)) {
      const event: BrowserEvent = {
        source_id: config!.sourceId,
        category: "dom_mutation",
        timestamp: new Date().toISOString(),
        user_agent: navigator.userAgent,
        url: window.location.href,
        path: window.location.pathname,
        metadata: {
          mutation_type: "childList",
          target_element: "body",
          added_nodes: [`iframe[src="${src}"]`],
        },
      };
      sendEventImmediate(event);
      baselineHashes.set(key, simpleHash(src));
    }
  });
}

/**
 * Send page load event
 */
function sendPageLoadEvent(): void {
  if (!config) return;

  const navigationTiming = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;

  const event: BrowserEvent = {
    source_id: config.sourceId,
    category: "page_load",
    timestamp: new Date().toISOString(),
    user_agent: navigator.userAgent,
    url: window.location.href,
    path: window.location.pathname,
    query_params: Object.fromEntries(new URLSearchParams(window.location.search)),
    metadata: {
      load_time_ms: navigationTiming ? Math.round(navigationTiming.loadEventEnd - navigationTiming.fetchStart) : undefined,
      dom_content_loaded_ms: navigationTiming ? Math.round(navigationTiming.domContentLoadedEventEnd - navigationTiming.fetchStart) : undefined,
      resource_count: performance.getEntriesByType("resource").length,
    },
  };

  sendEventImmediate(event);
}

/**
 * Queue event for batch sending
 */
function queueEvent(event: BrowserEvent): void {
  mutationQueue.push(event);

  if (mutationFlushTimer) {
    clearTimeout(mutationFlushTimer);
  }

  mutationFlushTimer = setTimeout(() => {
    flushMutationQueue();
  }, 1000); // Flush mutations after 1 second of inactivity
}

/**
 * Flush mutation queue to background
 */
async function flushMutationQueue(): Promise<void> {
  if (mutationQueue.length === 0) return;

  const events = [...mutationQueue];
  mutationQueue = [];

  try {
    await chrome.runtime.sendMessage({ type: "BATCH_EVENTS", payload: events });
  } catch (error) {
    console.error("[Hawk3ye] Failed to send mutation batch:", error);
    // Re-queue on failure
    mutationQueue.unshift(...events);
  }
}

/**
 * Send single event immediately (for high-priority events like CSP violations)
 */
async function sendEventImmediate(event: BrowserEvent): Promise<void> {
  try {
    await chrome.runtime.sendMessage({ type: event.category.toUpperCase() as any, payload: event });
  } catch (error) {
    console.error("[Hawk3ye] Failed to send immediate event:", error);
  }
}

/**
 * Cleanup listeners
 */
function cleanup(): void {
  if (mutationObserver) {
    mutationObserver.disconnect();
    mutationObserver = null;
  }

  if (cspViolationHandler) {
    document.removeEventListener("securitypolicyviolation", cspViolationHandler);
    cspViolationHandler = null;
  }

  if (integrityCheckTimer) {
    clearInterval(integrityCheckTimer);
    integrityCheckTimer = null;
  }

  if (mutationFlushTimer) {
    clearTimeout(mutationFlushTimer);
    mutationFlushTimer = null;
  }

  mutationQueue = [];
  baselineHashes.clear();
}

// Initialize on load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}

// Cleanup on unload
window.addEventListener("beforeunload", cleanup);

// Export for testing
export { initialize, cleanup, queueEvent, flushMutationQueue };