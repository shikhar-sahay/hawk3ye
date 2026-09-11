/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend origin for REST calls, e.g. https://hawkeye-api-f01y.onrender.com (empty = same origin) */
  readonly VITE_API_BASE_URL?: string;
  /** WebSocket base for /ws, e.g. wss://hawkeye-api-f01y.onrender.com (empty = same origin) */
  readonly VITE_WS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
