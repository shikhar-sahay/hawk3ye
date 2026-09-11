"use client";

import * as React from "react";
import { API_KEY_STORAGE, getStoredApiKey } from "@/auth";
import { useBackendReadinessOptional } from "@/context/BackendReadinessContext";

/**
 * WebSocket message types matching the backend protocol
 */
export type WSMessageType =
  | "alert"
  | "incident"
  | "event"
  | "ping"
  | "pong"
  | "connected"
  | "error"
  | "subscribed"
  | "unsubscribed";

/**
 * Base message structure
 */
export interface WSMessage {
  type: WSMessageType;
  timestamp: string;
  event_id?: number;
  data?: unknown;
  connection_id?: string;
  source_id?: number;
  source_name?: string;
  subscriptions?: string[];
  session_id?: string;
}

/**
 * Client -> Server message
 */
export interface WSClientMessage {
  type: "pong" | "subscribe" | "unsubscribe" | "ping" | "reconnect";
  data?: {
    types?: string[];
    session_id?: string;
    last_event_id?: number;
  };
}

/**
 * Alert payload from WebSocket
 */
export interface AlertPayload {
  id: number;
  source_id: number;
  detection_type: string;
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  confidence: number;
  status: "new" | "processing" | "correlated" | "dismissed";
  evidence: Record<string, unknown>;
  mitre_tactics: string[];
  mitre_techniques: string[];
  affected_entities: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * Incident payload from WebSocket
 */
export interface IncidentPayload {
  id: number;
  source_id: number;
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  status: "open" | "investigating" | "contained" | "resolved" | "closed";
  affected_ips: string[];
  affected_users: string[];
  mitre_tactics: string[];
  mitre_techniques: string[];
  alert_count: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

/**
 * Event payload from WebSocket
 */
export interface EventPayload {
  id: number;
  source_id: number;
  category: string;
  event_type: string;
  severity: "critical" | "high" | "medium" | "low";
  timestamp: string;
  user_id: string | null;
  ip: string | null;
  route: string | null;
  method: string | null;
  status_code: number | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  mitre_tactic: string | null;
  mitre_technique: string | null;
  created_at: string;
}

/**
 * Connected confirmation message data
 */
export interface ConnectedData {
  connection_id: string;
  source_id: number;
  source_name: string;
  subscriptions: string[];
  session_id?: string;
}

/**
 * Error message data
 */
export interface WSErrorData {
  code: string;
  message: string;
}

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "reconnecting" | "error";

type WSMessageHandler = (message: WSMessage) => void;

interface UseWebSocketOptions {
  /** API key for authentication */
  apiKey?: string;
  /** Event types to subscribe to */
  subscriptions?: ("alerts" | "incidents" | "events")[];
  /** Enable automatic reconnection */
  autoReconnect?: boolean;
  /** Maximum reconnection attempts (0 = infinite) */
  maxReconnectAttempts?: number;
  /** Base delay for exponential backoff (ms) */
  reconnectBaseDelay?: number;
  /** Maximum delay for exponential backoff (ms) */
  reconnectMaxDelay?: number;
  /** Heartbeat interval (ms) */
  heartbeatInterval?: number;
  /** Callback when connection status changes */
  onStatusChange?: (status: ConnectionStatus) => void;
  /** Callback when an alert is received */
  onAlert?: (alert: AlertPayload, eventId: number) => void;
  /** Callback when an incident is received */
  onIncident?: (incident: IncidentPayload, eventId: number) => void;
  /** Callback when an event is received */
  onEvent?: (event: EventPayload, eventId: number) => void;
  /** Callback when connection error occurs */
  onError?: (error: Error) => void;
  /** Callback when connected */
  onConnect?: (data: ConnectedData) => void;
  /** Callback when disconnected */
  onDisconnect?: () => void;
}

interface WebSocketContextValue {
  /** Current connection status */
  status: ConnectionStatus;
  /** Current session ID for reconnection */
  sessionId: string | null;
  /** Last event ID received */
  lastEventId: number;
  /** Whether the WebSocket is initialized with an API key */
  isInitialized: boolean;
  /** Subscribe to event types */
  subscribe: (types: ("alerts" | "incidents" | "events")[]) => void;
  /** Unsubscribe from event types */
  unsubscribe: (types: ("alerts" | "incidents" | "events")[]) => void;
  /** Manually trigger reconnection */
  reconnect: () => void;
  /** Disconnect from WebSocket */
  disconnect: () => void;
  /** Send raw message */
  send: (message: WSClientMessage) => void;
  /** Whether there's an active connection */
  isConnected: boolean;
  /** Register a callback for specific message types */
  on: (types: WSMessage["type"] | WSMessage["type"][], handler: WSMessageHandler) => () => void;
  /** Configure the WebSocket connection (call once on app init) */
  configure: (options: UseWebSocketOptions) => void;
  /** Get current configuration */
  getConfig: () => UseWebSocketOptions | null;
  /** Explicitly connect with current config (for manual reconnect) */
  connect: () => void;
}

const WebSocketContext = React.createContext<WebSocketContextValue | null>(null);

interface WebSocketProviderProps {
  children: React.ReactNode;
  /** Optional: override default subscriptions */
  subscriptions?: ("alerts" | "incidents" | "events")[];
}

/**
 * WebSocketProvider - Provides a single shared WebSocket connection across the app
 * Uses an event emitter pattern to broadcast messages to all subscribers
 */
export function WebSocketProvider({
  children,
  subscriptions = ["alerts", "incidents", "events"],
}: WebSocketProviderProps) {
  const [status, setStatus] = React.useState<ConnectionStatus>("disconnected");
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [lastEventId, setLastEventId] = React.useState(0);
  const [isInitialized, setIsInitialized] = React.useState(false);
  const [config, setConfig] = React.useState<UseWebSocketOptions | null>(null);

  // Track the last apiKey used for connection to avoid unnecessary reconnects
  const connectedApiKeyRef = React.useRef<string | null>(null);

  // Event emitter for message handlers
  const handlersRef = React.useRef<Map<string, Set<WSMessageHandler>>>(new Map());
  const wsRef = React.useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const messageQueueRef = React.useRef<Array<{ message: WSClientMessage; resolve: () => void }>>([]);
  const reconnectAttemptsRef = React.useRef(0);
  const isIntentionalDisconnectRef = React.useRef(false);
  const isMountedRef = React.useRef(true);
  const currentSubscriptionsRef = React.useRef<Set<string>>(new Set(subscriptions));
  const sessionIdRef = React.useRef<string | null>(null);
  const lastEventIdRef = React.useRef<number>(0);

  // Use a mutable ref object to avoid TypeScript readonly issues
  const callbackRefs = React.useRef({
    onStatusChange: null as UseWebSocketOptions["onStatusChange"] | null,
    onAlert: null as UseWebSocketOptions["onAlert"] | null,
    onIncident: null as UseWebSocketOptions["onIncident"] | null,
    onEvent: null as UseWebSocketOptions["onEvent"] | null,
    onError: null as UseWebSocketOptions["onError"] | null,
    onConnect: null as UseWebSocketOptions["onConnect"] | null,
    onDisconnect: null as UseWebSocketOptions["onDisconnect"] | null,
  });

  // Heartbeat interval constant (avoids config dependency recreation)
  const HEARTBEAT_INTERVAL = 30000;

  // Configure function to set callbacks and options
  const configure = React.useCallback((options: UseWebSocketOptions) => {
    setConfig(options);
    callbackRefs.current.onStatusChange = options.onStatusChange ?? null;
    callbackRefs.current.onAlert = options.onAlert ?? null;
    callbackRefs.current.onIncident = options.onIncident ?? null;
    callbackRefs.current.onEvent = options.onEvent ?? null;
    callbackRefs.current.onError = options.onError ?? null;
    callbackRefs.current.onConnect = options.onConnect ?? null;
    callbackRefs.current.onDisconnect = options.onDisconnect ?? null;

    // Update subscriptions if provided
    if (options.subscriptions) {
      currentSubscriptionsRef.current = new Set(options.subscriptions);
    }

    // If apiKey provided in config, update apiKey state to trigger reconnection
    if (options.apiKey) {
      setApiKey(options.apiKey);
    }
  }, []);

  const getConfig = React.useCallback(() => config, [config]);

  // Get API key from localStorage. Use state to make it reactive to
  // localStorage changes. Config apiKey takes precedence if provided.
  const [apiKey, setApiKey] = React.useState<string | null>(() => getStoredApiKey());

  // Listen for localStorage changes to update apiKey (cross-tab)
  React.useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === API_KEY_STORAGE) {
        setApiKey(event.newValue || getStoredApiKey());
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  // Clear reconnect timeout
  const clearReconnectTimeout = React.useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  // Clear heartbeat interval
  const clearHeartbeat = React.useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  // Start heartbeat - uses constant interval to avoid config dependency
  const startHeartbeat = React.useCallback(() => {
    clearHeartbeat();
    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ping" }));
      }
    }, HEARTBEAT_INTERVAL);
  }, [clearHeartbeat]);

  // Process queued messages
  const processMessageQueue = React.useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    while (messageQueueRef.current.length > 0) {
      const { message, resolve } = messageQueueRef.current.shift()!;
      ws.send(JSON.stringify(message));
      resolve();
    }
  }, []);

  // Send message (queues if not connected)
  const send = React.useCallback((message: WSClientMessage) => {
    return new Promise<void>((resolve) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
        resolve();
      } else {
        messageQueueRef.current.push({ message, resolve });
      }
    });
  }, []);

  // Update status
  const updateStatus = React.useCallback((newStatus: ConnectionStatus) => {
    if (!isMountedRef.current) return;
    setStatus(newStatus);
  }, []);

  // Handle incoming messages
  const handleMessage = React.useCallback((event: MessageEvent) => {
    try {
      const message: WSMessage = JSON.parse(event.data);

      // Handle server ping - respond with pong
      if (message.type === "ping") {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "pong" }));
        }
        return;
      }

      // Update session/lastEventId for reconnection
      if (message.type === "connected") {
        const data = message.data as ConnectedData;
        const sessionId = data.session_id || null;
        setSessionId(sessionId);
        sessionIdRef.current = sessionId;
        setLastEventId(0);
        lastEventIdRef.current = 0;
        updateStatus("connected");
        startHeartbeat();
        processMessageQueue();
        callbackRefs.current.onConnect?.(data);
        callbackRefs.current.onStatusChange?.("connected");
      } else if (message.type === "alert") {
        const alert = message.data as AlertPayload;
        const eventId = message.event_id || 0;
        setLastEventId(eventId);
        lastEventIdRef.current = eventId;
        callbackRefs.current.onAlert?.(alert, eventId);
      } else if (message.type === "incident") {
        const incident = message.data as IncidentPayload;
        const eventId = message.event_id || 0;
        setLastEventId(eventId);
        lastEventIdRef.current = eventId;
        callbackRefs.current.onIncident?.(incident, eventId);
      } else if (message.type === "event") {
        const evt = message.data as EventPayload;
        const eventId = message.event_id || 0;
        setLastEventId(eventId);
        lastEventIdRef.current = eventId;
        callbackRefs.current.onEvent?.(evt, eventId);
      } else if (message.type === "error") {
        const errorData = message.data as WSErrorData;
        console.error("WebSocket error:", errorData);
        if (errorData.code === "SESSION_EXPIRED" || errorData.code === "INVALID_RECONNECT") {
          setSessionId(null);
          sessionIdRef.current = null;
          setLastEventId(0);
          lastEventIdRef.current = 0;
        }
        callbackRefs.current.onError?.(new Error(errorData.message));
      }

      // Broadcast to all handlers for this message type
      const typeHandlers = handlersRef.current.get(message.type);
      if (typeHandlers) {
        typeHandlers.forEach((handler) => {
          try {
            handler(message);
          } catch (error) {
            console.error("Error in WebSocket message handler:", error);
          }
        });
      }

      // Also broadcast to wildcard handlers
      const wildcardHandlers = handlersRef.current.get("*");
      if (wildcardHandlers) {
        wildcardHandlers.forEach((handler) => {
          try {
            handler(message);
          } catch (error) {
            console.error("Error in WebSocket wildcard handler:", error);
          }
        });
      }
    } catch (error) {
      console.error("Failed to parse WebSocket message:", error);
    }
  }, [updateStatus, startHeartbeat, processMessageQueue]);

  // Register a callback for message types
  const on = React.useCallback((types: WSMessage["type"] | WSMessage["type"][], handler: WSMessageHandler) => {
    const typeArray = Array.isArray(types) ? types : [types];

    typeArray.forEach((type) => {
      if (!handlersRef.current.has(type)) {
        handlersRef.current.set(type, new Set());
      }
      handlersRef.current.get(type)!.add(handler);
    });

    // Return unsubscribe function
    return () => {
      typeArray.forEach((type) => {
        handlersRef.current.get(type)?.delete(handler);
      });
    };
  }, []);

  // Connect to WebSocket - uses connectedApiKeyRef to avoid apiKey dependency
  const connect = React.useCallback(() => {
    if (!isMountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }
    const currentApiKey = connectedApiKeyRef.current;
    if (!currentApiKey) {
      return;
    }

    isIntentionalDisconnectRef.current = false;
    updateStatus("connecting");

    try {
      const subscribeParam = Array.from(currentSubscriptionsRef.current).join(",");
      const apiKeyParam = currentApiKey ? `&api_key=${encodeURIComponent(currentApiKey)}` : "";
      // Same-origin /ws by default (dev proxy or reverse proxy). In split
      // deployments set VITE_WS_URL to the bare backend origin, e.g.
      // wss://hawkeye-api-f01y.onrender.com (the /ws path is appended below).
      const wsBase = import.meta.env.VITE_WS_URL ?? "";
      const wsUrl = `${wsBase}/ws?subscribe=${encodeURIComponent(subscribeParam)}${apiKeyParam}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        };

      ws.onmessage = handleMessage;

      ws.onclose = (event) => {
        console.debug("WebSocket closed:", event.code);
        clearHeartbeat();
        clearReconnectTimeout();

        if (!isMountedRef.current) return;

        // 1008 = policy violation: backend rejected our API key (missing,
        // invalid, or inactive source). Retrying cannot succeed until the
        // user signs in again, so surface an error and stop reconnecting.
        if (event.code === 1008) {
          isIntentionalDisconnectRef.current = true;
          updateStatus("error");
          callbackRefs.current.onStatusChange?.("error");
          callbackRefs.current.onError?.(new Error(event.reason || "WebSocket authentication failed"));
          return;
        }

        updateStatus("disconnected");
        callbackRefs.current.onStatusChange?.("disconnected");
        callbackRefs.current.onDisconnect?.();

        // Attempt reconnection if not intentional and auto-reconnect is enabled
        if (!isIntentionalDisconnectRef.current) {
          const shouldReconnect = reconnectAttemptsRef.current < 10; // Max 10 attempts

          if (shouldReconnect) {
            updateStatus("reconnecting");
            callbackRefs.current.onStatusChange?.("reconnecting");
            reconnectAttemptsRef.current += 1;

            // Exponential backoff with jitter
            const delay = Math.min(
              1000 * Math.pow(2, reconnectAttemptsRef.current - 1) + Math.random() * 1000,
              30000
            );

            reconnectTimeoutRef.current = setTimeout(() => {
              if (isMountedRef.current && !isIntentionalDisconnectRef.current) {
                const currentSessionId = sessionIdRef.current;
                const currentLastEventId = lastEventIdRef.current;
                if (currentSessionId && currentLastEventId > 0) {
                  connect();
                  setTimeout(() => {
                    send({
                      type: "reconnect",
                      data: { session_id: currentSessionId, last_event_id: currentLastEventId },
                    });
                  }, 100);
                } else {
                  connect();
                }
              }
            }, delay);
          } else {
            updateStatus("error");
            callbackRefs.current.onStatusChange?.("error");
          }
        }
      };

      // Network-level errors are always followed by a close event which owns
      // the status transition; here we only notify error listeners to avoid
      // the indicator flickering between Error and Reconnecting.
      ws.onerror = () => {
        callbackRefs.current.onError?.(new Error("WebSocket connection error"));
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
      if (isMountedRef.current) {
        updateStatus("error");
        callbackRefs.current.onStatusChange?.("error");
        callbackRefs.current.onError?.(error as Error);
      }
    }
  }, [
    handleMessage,
    updateStatus,
    clearHeartbeat,
    clearReconnectTimeout,
    send,
  ]);

  // Disconnect - intentional disconnect (user action or apiKey change)
  const disconnect = React.useCallback(() => {
    isIntentionalDisconnectRef.current = true;
    // Only clear connectedApiKeyRef for intentional disconnects (user clicked disconnect or apiKey changing)
    // Do NOT clear on cleanup/unmount - we want to preserve the key for potential reconnection
    connectedApiKeyRef.current = null;
    clearReconnectTimeout();
    clearHeartbeat();

    const ws = wsRef.current;
    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onclose = null;
      ws.onerror = null;
      ws.close(1000, "Intentional disconnect");
      wsRef.current = null;
    }

    if (isMountedRef.current) {
      updateStatus("disconnected");
      callbackRefs.current.onStatusChange?.("disconnected");
      callbackRefs.current.onDisconnect?.();
    }
  }, [clearReconnectTimeout, clearHeartbeat, updateStatus]);

  // Cleanup disconnect - for unmount/cleanup only, preserves connectedApiKeyRef for potential remount
  const cleanupDisconnect = React.useCallback(() => {
    // Mark as intentional disconnect to prevent reconnect logic in onclose handler
    isIntentionalDisconnectRef.current = true;
    // Don't clear connectedApiKeyRef - preserve for potential remount (StrictMode)
    clearReconnectTimeout();
    clearHeartbeat();

    const ws = wsRef.current;
    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onclose = null;
      ws.onerror = null;
      ws.close(1000, "Cleanup disconnect");
      wsRef.current = null;
    }

    if (isMountedRef.current) {
      updateStatus("disconnected");
      callbackRefs.current.onStatusChange?.("disconnected");
      callbackRefs.current.onDisconnect?.();
    }
  }, [clearReconnectTimeout, clearHeartbeat, updateStatus]);

  // Reconnect manually
  const reconnect = React.useCallback(() => {
    reconnectAttemptsRef.current = 0;
    // Preserve the current API key for reconnection (from ref or state)
    const currentApiKey = connectedApiKeyRef.current || apiKey;
    disconnect();
    setTimeout(() => {
      if (isMountedRef.current && currentApiKey) {
        connectedApiKeyRef.current = currentApiKey;
        connect();
      }
    }, 100);
  }, [disconnect, connect, apiKey]);

  // Subscribe to event types
  const subscribe = React.useCallback((types: ("alerts" | "incidents" | "events")[]) => {
    const validTypes = new Set(["alerts", "incidents", "events"]);
    types.filter((t) => validTypes.has(t)).forEach((t) => currentSubscriptionsRef.current.add(t));
    send({ type: "subscribe", data: { types: Array.from(currentSubscriptionsRef.current) } });
  }, [send]);

  // Unsubscribe from event types
  const unsubscribe = React.useCallback((types: ("alerts" | "incidents" | "events")[]) => {
    const validTypes = new Set(["alerts", "incidents", "events"]);
    types.filter((t) => validTypes.has(t)).forEach((t) => currentSubscriptionsRef.current.delete(t));
    send({ type: "unsubscribe", data: { types: Array.from(currentSubscriptionsRef.current) } });
  }, [send]);

  // Single effect: ensure a connection exists whenever we have an API key.
  // Defers connection while the backend is waking (Render cold start) so
  // the browser console is not spammed with failed handshake errors.
  const backendReadiness = useBackendReadinessOptional();
  const backendReady = backendReadiness?.isReady ?? true;

  React.useEffect(() => {
    isMountedRef.current = true;
    setIsInitialized(!!apiKey);

    // While the backend is still waking, tear down any stale socket and
    // wait. The effect re-runs when backendReady flips to true (via the
    // BackendReadiness gate unblocking the route) or when apiKey changes.
    if (!backendReady) {
      if (wsRef.current) cleanupDisconnect();
      return () => {
        isMountedRef.current = false;
      };
    }

    if (apiKey) {
      if (apiKey !== connectedApiKeyRef.current) {
        // Key changed: tear down any existing socket first
        disconnect();
      }
      connectedApiKeyRef.current = apiKey;
      reconnectAttemptsRef.current = 0;
      isIntentionalDisconnectRef.current = false;
      connect();
    } else {
      disconnect();
    }

    return () => {
      // Cleanup disconnect on unmount - preserves connectedApiKeyRef for
      // StrictMode remount. Set isMountedRef.current = false FIRST to prevent
      // async onclose from scheduling a reconnect.
      isMountedRef.current = false;
      cleanupDisconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, backendReady]);

  const value: WebSocketContextValue = {
    status,
    sessionId,
    lastEventId,
    isInitialized,
    subscribe,
    unsubscribe,
    reconnect,
    disconnect,
    connect,
    send,
    isConnected: status === "connected",
    on,
    configure,
    getConfig,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

/**
 * Hook to access the shared WebSocket connection
 * Must be used within a WebSocketProvider
 */
export function useWebSocketContext(): WebSocketContextValue {
  const context = React.useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocketContext must be used within a WebSocketProvider");
  }
  return context;
}

/**
 * Hook to access just the connection status (for simple status indicators)
 */
export function useConnectionStatus(): ConnectionStatus {
  const { status } = useWebSocketContext();
  return status;
}

/**
 * Hook to access connection status with initialized check
 * Returns "disconnected" if not initialized (no API key)
 */
export function useConnectionStatusWithInit(): ConnectionStatus {
  const { status, isInitialized } = useWebSocketContext();
  if (!isInitialized) return "disconnected";
  return status;
}

/**
 * Hook to subscribe to specific WebSocket message types
 */
export function useWebSocketMessage(
  types: WSMessage["type"] | WSMessage["type"][],
  handler: (message: WSMessage) => void
) {
  const { on } = useWebSocketContext();
  React.useEffect(() => {
    return on(types, handler);
  }, [on, types, handler]);
}