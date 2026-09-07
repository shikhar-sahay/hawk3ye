/**
 * Content Script: Client-side Bot/Automation Detection
 * Detects headless browsers, automation frameworks, and behavioral anomalies
 */

import type { BrowserEvent, AgentConfig, BotSignal, BackgroundToContentMessage } from "../shared/types";

let config: AgentConfig | null = null;
let isEnabled = false;
let detectionTimer: ReturnType<typeof setInterval> | null = null;
let behavioralData: BehavioralData = {
  mouseMovements: [],
  clicks: [],
  scrolls: [],
  keyPresses: [],
  startTime: Date.now(),
};

interface BehavioralData {
  mouseMovements: Array<{ x: number; y: number; t: number }>;
  clicks: Array<{ x: number; y: number; t: number; target: string }>;
  scrolls: Array<{ x: number; y: number; t: number }>;
  keyPresses: Array<{ key: string; t: number }>;
  startTime: number;
}

/**
 * Initialize the bot detector
 */
async function initialize(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_CONFIG" } as any);
    if (response?.payload) {
      config = response.payload as AgentConfig;
      isEnabled = config.enableBotDetection;

      if (isEnabled) {
        setupBehavioralListeners();
        startPeriodicDetection();
        console.log("[Hawk3ye] Bot Detector initialized");
      }
    }
  } catch (error) {
    console.error("[Hawk3ye] Bot Detector initialization failed:", error);
  }
}

/**
 * Set up behavioral event listeners
 */
function setupBehavioralListeners(): void {
  // Mouse movements (sampled)
  let lastMouseTime = 0;
  document.addEventListener("mousemove", (event) => {
    const now = Date.now();
    if (now - lastMouseTime > 50) { // Sample at ~20Hz
      behavioralData.mouseMovements.push({ x: event.clientX, y: event.clientY, t: now });
      if (behavioralData.mouseMovements.length > 500) {
        behavioralData.mouseMovements = behavioralData.mouseMovements.slice(-500);
      }
      lastMouseTime = now;
    }
  }, { passive: true });

  // Clicks
  document.addEventListener("click", (event) => {
    const target = event.target as Element;
    behavioralData.clicks.push({
      x: event.clientX,
      y: event.clientY,
      t: Date.now(),
      target: getElementSelector(target),
    });
    if (behavioralData.clicks.length > 100) {
      behavioralData.clicks = behavioralData.clicks.slice(-100);
    }
  }, { passive: true });

  // Scrolls
  document.addEventListener("scroll", (event) => {
    behavioralData.scrolls.push({
      x: window.scrollX,
      y: window.scrollY,
      t: Date.now(),
    });
    if (behavioralData.scrolls.length > 100) {
      behavioralData.scrolls = behavioralData.scrolls.slice(-100);
    }
  }, { passive: true });

  // Key presses
  document.addEventListener("keydown", (event) => {
    behavioralData.keyPresses.push({
      key: event.key,
      t: Date.now(),
    });
    if (behavioralData.keyPresses.length > 200) {
      behavioralData.keyPresses = behavioralData.keyPresses.slice(-200);
    }
  }, { passive: true });
}

/**
 * Start periodic bot detection
 */
function startPeriodicDetection(): void {
  if (detectionTimer) return;

  // Run initial detection after 5 seconds (allow page to fully load)
  setTimeout(() => runDetection(), 5000);

  // Then run every 60 seconds
  detectionTimer = setInterval(() => runDetection(), 60000);
}

/**
 * Run all bot detection checks
 */
async function runDetection(): Promise<void> {
  if (!config || !isEnabled) return;

  const signals: BotSignal[] = [];
  let totalScore = 0;

  // 1. WebDriver detection
  const webdriverSignals = detectWebDriver();
  signals.push(...webdriverSignals);
  totalScore += webdriverSignals.reduce((sum, s) => sum + s.confidence * 30, 0);

  // 2. Automation properties
  const automationSignals = detectAutomationProperties();
  signals.push(...automationSignals);
  totalScore += automationSignals.reduce((sum, s) => sum + s.confidence * 25, 0);

  // 3. Permissions API
  const permissionSignals = await detectPermissions();
  signals.push(...permissionSignals);
  totalScore += permissionSignals.reduce((sum, s) => sum + s.confidence * 15, 0);

  // 4. WebGL fingerprinting
  const webglSignals = detectWebGLFingerprint();
  signals.push(...webglSignals);
  totalScore += webglSignals.reduce((sum, s) => sum + s.confidence * 10, 0);

  // 5. Behavioral analysis
  const behavioralSignals = analyzeBehavior();
  signals.push(...behavioralSignals);
  totalScore += behavioralSignals.reduce((sum, s) => sum + s.confidence * 20, 0);

  // Normalize score to 0-100
  const botScore = Math.min(100, Math.round(totalScore));

  // Send event if threshold exceeded
  if (botScore >= (config.botDetectionThreshold || 70)) {
    const event: BrowserEvent = {
      source_id: config.sourceId,
      category: "bot_detection",
      timestamp: new Date().toISOString(),
      user_agent: navigator.userAgent,
      url: window.location.href,
      path: window.location.pathname,
      metadata: {
        bot_score: botScore,
        bot_signals: signals,
        detection_method: getPrimaryDetectionMethod(signals),
      },
    };

    await sendBotDetectionEvent(event);
  }
}

/**
 * Detect WebDriver property
 */
function detectWebDriver(): BotSignal[] {
  const signals: BotSignal[] = [];

  // navigator.webdriver (standard)
  if (navigator.webdriver === true) {
    signals.push({
      type: "webdriver_property",
      description: "navigator.webdriver is true",
      confidence: 0.95,
      evidence: { property: "navigator.webdriver", value: true },
    });
  }

  // Check for webdriver in various forms
  const webdriverChecks = [
    () => (window as any).webdriver,
    () => (window as any)._phantom,
    () => (window as any)._selenium,
    () => (window as any)._webdriver,
    () => (document as any).__webdriver_evaluate__,
    () => (document as any).__selenium_evaluate__,
    () => (document as any).__driver_evaluate__,
  ];

  for (const check of webdriverChecks) {
    try {
      if (check()) {
        signals.push({
          type: "webdriver_global",
          description: "WebDriver global property detected",
          confidence: 0.9,
          evidence: { check: check.toString() },
        });
        break;
      }
    } catch {
      // Ignore errors
    }
  }

  return signals;
}

/**
 * Detect automation-related properties
 */
function detectAutomationProperties(): BotSignal[] {
  const signals: BotSignal[] = [];

  // Chrome automation flags
  const automationFlags = [
    "__webdriver_script_fn",
    "__webdriver_evaluate",
    "__selenium_evaluate",
    "__fxdriver_evaluate",
    "__driver_evaluate",
    "__webdriver_unwrapped",
    "__webdriver_script_function",
    "cdc_ado",
    "cdc_las",
    "cdc_jmo",
    "wdc_",
  ];

  for (const flag of automationFlags) {
    for (const key of Object.keys(window)) {
      if (key.startsWith(flag) || key.includes(flag)) {
        signals.push({
          type: "automation_property",
          description: `Automation property detected: ${key}`,
          confidence: 0.85,
          evidence: { property: key },
        });
      }
    }
  }

  // Check for callPhantom, _phantom, __nightmare
  const phantomProps = ["callPhantom", "_phantom", "__nightmare", "_hs"];
  for (const prop of phantomProps) {
    if ((window as any)[prop]) {
      signals.push({
        type: "automation_framework",
        description: `PhantomJS/Nightmare property detected: ${prop}`,
        confidence: 0.9,
        evidence: { property: prop },
      });
    }
  }

  return signals;
}

/**
 * Detect suspicious permissions
 */
async function detectPermissions(): Promise<BotSignal[]> {
  const signals: BotSignal[] = [];

  try {
    // Check notifications permission (bots often deny)
    const notifPerm = await navigator.permissions.query({ name: "notifications" });
    if (notifPerm.state === "denied") {
      signals.push({
        type: "permissions",
        description: "Notifications permission denied (common in headless)",
        confidence: 0.3,
        evidence: { permission: "notifications", state: notifPerm.state },
      });
    }
  } catch {
    // Permissions API not supported
  }

  try {
    // Check clipboard permission
    const clipPerm = await navigator.permissions.query({ name: "clipboard-read" });
    if (clipPerm.state === "granted") {
      // Not necessarily bot-like, but worth noting
    }
  } catch {
    // Ignore
  }

  return signals;
}

/**
 * WebGL fingerprinting for headless detection
 */
function detectWebGLFingerprint(): BotSignal[] {
  const signals: BotSignal[] = [];

  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl") as WebGLRenderingContext | null;

    if (!gl) {
      signals.push({
        type: "webgl",
        description: "WebGL not available (possible headless)",
        confidence: 0.4,
        evidence: { webgl: false },
      });
      return signals;
    }

    // Check renderer and vendor (headless often has specific values)
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    if (debugInfo) {
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);

      const headlessIndicators = [
        "swiftshader",
        "llvmpipe",
        "mesa",
        "headless",
        "google inc.",
        "swift",
      ];

      const rendererLower = (renderer || "").toLowerCase();
      const vendorLower = (vendor || "").toLowerCase();

      for (const indicator of headlessIndicators) {
        if (rendererLower.includes(indicator) || vendorLower.includes(indicator)) {
          signals.push({
            type: "webgl",
            description: `Headless WebGL renderer detected: ${renderer} / ${vendor}`,
            confidence: 0.7,
            evidence: { renderer, vendor },
          });
          break;
        }
      }
    }

    // Check for WebGL2
    const gl2 = canvas.getContext("webgl2");
    if (!gl2) {
      signals.push({
        type: "webgl",
        description: "WebGL2 not available",
        confidence: 0.2,
        evidence: { webgl2: false },
      });
    }

  } catch {
    // WebGL not supported
  }

  return signals;
}

/**
 * Analyze behavioral patterns
 */
function analyzeBehavior(): BotSignal[] {
  const signals: BotSignal[] = [];
  const now = Date.now();
  const duration = now - behavioralData.startTime;

  // Need minimum data
  if (duration < 30000) return signals; // Less than 30 seconds

  // 1. Mouse movement entropy
  const mouseEntropy = calculateEntropy(behavioralData.mouseMovements.map(m => `${m.x},${m.y}`));
  if (behavioralData.mouseMovements.length > 10 && mouseEntropy < 2.0) {
    signals.push({
      type: "behavioral",
      description: "Low mouse movement entropy (robotic movement)",
      confidence: 0.6,
      evidence: { entropy: mouseEntropy, samples: behavioralData.mouseMovements.length },
    });
  }

  // 2. Click timing regularity
  if (behavioralData.clicks.length > 5) {
    const intervals = [];
    for (let i = 1; i < behavioralData.clicks.length; i++) {
      intervals.push(behavioralData.clicks[i].t - behavioralData.clicks[i - 1].t);
    }
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) / intervals.length;
    const cv = Math.sqrt(variance) / avgInterval; // Coefficient of variation

    if (cv < 0.1) { // Very regular timing
      signals.push({
        type: "behavioral",
        description: "Highly regular click intervals (automated clicking)",
        confidence: 0.7,
        evidence: { cv, avgInterval, clicks: behavioralData.clicks.length },
      });
    }
  }

  // 3. Scroll behavior
  if (behavioralData.scrolls.length > 3) {
    const scrollIntervals = [];
    for (let i = 1; i < behavioralData.scrolls.length; i++) {
      scrollIntervals.push(behavioralData.scrolls[i].t - behavioralData.scrolls[i - 1].t);
    }
    const avgScrollInterval = scrollIntervals.reduce((a, b) => a + b, 0) / scrollIntervals.length;
    if (avgScrollInterval < 100) { // Scrolling too fast/regular
      signals.push({
        type: "behavioral",
        description: "Automated scrolling pattern detected",
        confidence: 0.5,
        evidence: { avgInterval: avgScrollInterval, scrolls: behavioralData.scrolls.length },
      });
    }
  }

  // 4. No human-like idle periods
  const activeTime = behavioralData.mouseMovements.length * 50 + behavioralData.clicks.length * 100 + behavioralData.scrolls.length * 50;
  const activityRatio = activeTime / duration;
  if (activityRatio > 0.8) { // >80% active time
    signals.push({
      type: "behavioral",
      description: "No human-like idle periods (continuous activity)",
      confidence: 0.5,
      evidence: { activityRatio, duration },
    });
  }

  // 5. Perfect linear mouse movements
  if (behavioralData.mouseMovements.length > 20) {
    let linearCount = 0;
    for (let i = 2; i < behavioralData.mouseMovements.length; i++) {
      const p1 = behavioralData.mouseMovements[i - 2];
      const p2 = behavioralData.mouseMovements[i - 1];
      const p3 = behavioralData.mouseMovements[i];

      // Check if three points are collinear
      const area = Math.abs(
        (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y)) / 2
      );
      if (area < 1) linearCount++;
    }

    const linearRatio = linearCount / (behavioralData.mouseMovements.length - 2);
    if (linearRatio > 0.7) {
      signals.push({
        type: "behavioral",
        description: "Predominantly linear mouse movements (automated)",
        confidence: 0.65,
        evidence: { linearRatio, samples: behavioralData.mouseMovements.length },
      });
    }
  }

  return signals;
}

/**
 * Calculate Shannon entropy
 */
function calculateEntropy(values: string[]): number {
  const counts: Record<string, number> = {};
  for (const v of values) {
    counts[v] = (counts[v] || 0) + 1;
  }

  let entropy = 0;
  const total = values.length;
  for (const count of Object.values(counts)) {
    const p = count / total;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/**
 * Get primary detection method from signals
 */
function getPrimaryDetectionMethod(signals: BotSignal[]): BrowserEvent["metadata"]["detection_method"] {
  if (signals.some(s => s.type === "webdriver_property" || s.type === "webdriver_global")) {
    return "webdriver";
  }
  if (signals.some(s => s.type === "automation_property" || s.type === "automation_framework")) {
    return "automation_props";
  }
  if (signals.some(s => s.type === "permissions")) {
    return "permissions";
  }
  if (signals.some(s => s.type === "webgl")) {
    return "webgl";
  }
  return "behavioral";
}

/**
 * Send bot detection event to background
 */
async function sendBotDetectionEvent(event: BrowserEvent): Promise<void> {
  try {
    await chrome.runtime.sendMessage({ type: "BOT_DETECTED", payload: event });
  } catch (error) {
    console.error("[Hawk3ye] Failed to send bot detection event:", error);
  }
}

/**
 * Get element selector for behavioral tracking
 */
function getElementSelector(element: Element): string {
  if (element.id) return `#${element.id}`;
  const tag = element.tagName.toLowerCase();
  const classes = Array.from(element.classList).slice(0, 2).join(".");
  return classes ? `${tag}.${classes}` : tag;
}

/**
 * Cleanup
 */
function cleanup(): void {
  if (detectionTimer) {
    clearInterval(detectionTimer);
    detectionTimer = null;
  }
  behavioralData = {
    mouseMovements: [],
    clicks: [],
    scrolls: [],
    keyPresses: [],
    startTime: Date.now(),
  };
}

// Initialize
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}

// Cleanup on unload
window.addEventListener("beforeunload", cleanup);

// Listen for config updates
chrome.runtime.onMessage.addListener((message: BackgroundToContentMessage) => {
  if (message.type === "CONFIG" && message.payload) {
    config = message.payload;
    isEnabled = config.enableBotDetection;

    if (isEnabled && !detectionTimer) {
      setupBehavioralListeners();
      startPeriodicDetection();
    } else if (!isEnabled && detectionTimer) {
      cleanup();
    }
  }
});

// Export for testing
export { initialize, cleanup, runDetection };