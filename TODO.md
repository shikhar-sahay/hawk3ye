# Hawk3ye v2 Engineering Backlog

## Task Format
Each task has:
- **Priority**: P0 (Blocker) | P1 (High) | P2 (Medium) | P3 (Low)
- **Completion Criteria**: Measurable definition of done
- **Dependencies**: Task IDs that must complete first

---

## P0 - Blockers (Must Fix Before MVP) ✅ ALL COMPLETE

### T-001: Fix BotDetector `_check_automation_patterns` undefined variable ✅ DONE
- **File**: `hawkeye/services/detection/bot.py` (line ~113)
- **Issue**: References undefined `alerts` list variable
- **Resolution**: Code review shows issue was already fixed in commit 13ed3a2 — `alerts` properly initialized and used in `detect()` method
- **Dependencies**: None
- **Verified**: All tests pass

### T-002: Fix BotDetector `_analyze_user_agent` duplicate return ✅ DONE
- **File**: `hawkeye/services/detection/bot.py` (lines 167-177)
- **Issue**: Duplicate return statement (unreachable code)
- **Resolution**: Code review shows single return at end of method — already fixed in commit 13ed3a2
- **Dependencies**: None
- **Verified**: All tests pass

### T-003: Fix DetectionContext `time_window_start` uses wrong config ✅ DONE
- **File**: `hawkeye/services/detection/base.py` (DetectionContext class)
- **Issue**: Uses `settings.correlation_time_window_hours` but should use detection-specific window
- **Resolution**:
  - Added `detection_time_window_minutes = 60` to `hawkeye/config.py`
  - Updated `DetectionContext.__post_init__` to use detection window
- **Dependencies**: None
- **Verified**: All tests pass; DetectionContext now defaults to 60-minute window

### T-004: Verify all tests pass (pytest 100% green) ✅ DONE
- **Command**: `pytest tests/ -v`
- **Result**: 33/33 tests pass (was 18/18, now 33/33 with WebSocket)
- **Dependencies**: T-001, T-002, T-003
- **Verified**: Complete

---

## P0 - Integration Audit Blockers ✅ ALL COMPLETE

### T-030: Fix Double Route Prefix — Ingestion Endpoints ✅ DONE
- **File**: `hawkeye/api/v1/ingestion.py` (remove `prefix="/events"` from router)
- **Issue**: Endpoints resolve to `/api/v1/events/events/ingest` instead of `/api/v1/events/ingest`
- **Dependencies**: None
- **Completion Criteria**: `POST /api/v1/events/ingest` returns 202, `GET /api/v1/events/ingest` returns 405
- **Estimated Effort**: 10 minutes
- **Completed**: 2026-07-24

### T-031: Fix Double Route Prefix — Events Query Endpoints ✅ DONE
- **File**: `hawkeye/api/v1/events.py` (remove `prefix="/events"` from router)
- **Issue**: Endpoints resolve to `/api/v1/events/events/query` instead of `/api/v1/events/query`
- **Dependencies**: None
- **Completion Criteria**: `GET /api/v1/events/query` returns 200 with valid response
- **Estimated Effort**: 10 minutes
- **Completed**: 2026-07-24

### T-032: Add Header/Cookie Auth to WebSocket (`get_ws_source`) ✅ DONE
- **File**: `hawkeye/api/websocket.py` (get_ws_source function)
- **Issue**: WebSocket auth only supports query param (`?api_key=`) — exposes keys in logs
- **Dependencies**: None
- **Completion Criteria**:
  - `Authorization: Bearer <key>` header works (priority 1)
  - `X-API-Key: <key>` header works (priority 2)
  - `?api_key=<key>` query param still works for backward compatibility (priority 3)
  - Priority order enforced: Bearer > X-API-Key > Query
- **Estimated Effort**: 20 minutes
- **Completed**: 2026-07-24

### T-033: Implement WebSocket Reconnection Protocol ✅ DONE
- **File**: `hawkeye/api/websocket.py` (ConnectionManager + endpoint handlers)
- **Issue**: No WebSocket reconnection protocol — disconnect = permanent loss
- **Dependencies**: T-032 (auth must work for reconnect)
- **Completion Criteria**:
  - Client can send `{"type": "reconnect", "data": {"session_id": "...", "last_event_id": N}}`
  - Server validates session_id exists and not expired (1hr TTL)
  - Server replays missed messages (event_id > last_event_id)
  - ConnectionManager stores session data with message history (max 1000 msgs)
  - New connection_id issued, same session_id preserved
- **Estimated Effort**: 60 minutes
- **Completed**: 2026-07-24

---

## P1 - Milestone 2: WebSocket Backend ✅ ALL COMPLETE

### T-010: WebSocket endpoint `/ws` in FastAPI app with lifespan ✅ DONE
- **Files**: `hawkeye/main.py`, `hawkeye/api/websocket.py`
- **Completion Criteria**: WebSocket endpoint registered, lifespan starts/stops ConnectionManager
- **Completed**: 2026-07-24

### T-011: Real-time alert broadcast via DetectionEngine ✅ DONE
- **File**: `hawkeye/services/detection/engine.py` (_broadcast_alert method)
- **Completion Criteria**: Alerts broadcast to ConnectionManager immediately on creation
- **Completed**: 2026-07-24

### T-012: Real-time incident broadcast via CorrelationEngine ✅ DONE
- **File**: `hawkeye/services/correlation/engine.py` (_broadcast_incident method)
- **Completion Criteria**: Incidents broadcast to ConnectionManager on create/update
- **Completed**: 2026-07-24

### T-013: WebSocket authentication via API key ✅ DONE (Enhanced in T-032)
- **File**: `hawkeye/api/websocket.py` (get_ws_source)
- **Completion Criteria**: Multiple auth methods supported with priority order
- **Completed**: 2026-07-24

### T-014: Heartbeat/ping-pong + stats endpoint ✅ DONE
- **File**: `hawkeye/api/websocket.py` (ConnectionManager._heartbeat_loop, /ws/stats)
- **Completion Criteria**: 30s ping/pong, stale cleanup, /ws/stats returns counts
- **Completed**: 2026-07-24

### T-015: ConnectionManager class with subscriptions ✅ DONE
- **File**: `hawkeye/api/websocket.py` (ConnectionManager class)
- **Completion Criteria**: connect/disconnect/broadcast, per-source isolation, subscriptions
- **Completed**: 2026-07-24

---

## P1 - Milestone 3: Frontend Dashboard ✅ ALL COMPLETE

### T-020: Frontend Setup — React + TypeScript + Vite ✅ COMPLETE
- **Files**: `frontend/` (new directory)
- **Dependencies**: T-010 through T-015, T-030 through T-033 (ALL COMPLETE)
- **Completion Criteria**:
  - `npm create vite@latest frontend -- --template react-ts` ✅
  - Tailwind CSS configured ✅
  - shadcn/ui initialized ✅
  - ESLint + Prettier configured ✅
  - Dev server runs (`npm run dev`) ✅
  - TypeScript strict mode enabled ✅
- **Estimated Effort**: 2-3 hours
- **Completed**: 2026-07-25

### T-021: Tailwind + shadcn/ui Components ✅ COMPLETE
- **Files**: `frontend/src/components/ui/`
- **Dependencies**: T-020
- **Completion Criteria**:
  - Core components: Button, Card, Table, Badge, Avatar, Dropdown, Toast, Tabs, Dialog, ScrollArea, Separator, Label, Input, Select, Switch, Tooltip, AlertDialog, etc. ✅
  - Dark/light theme provider working ✅
  - Components follow shadcn/ui patterns ✅
- **Completed**: 2026-07-25

### T-022: Real-time Alert Feed (WebSocket) ✅ COMPLETE
- **Files**: `frontend/src/hooks/useWebSocket.ts`, `frontend/src/components/AlertFeed.tsx`, `frontend/src/pages/Alerts.tsx`
- **Dependencies**: T-020, T-021
- **Completion Criteria**:
  - WebSocket hook connects to `/ws` with API key ✅
  - Auto-reconnect on disconnect (uses reconnection protocol) ✅
  - AlertFeed component displays real-time alerts with severity badges ✅
  - Subscribe/unsubscribe to alert types ✅
  - Shows connection status indicator ✅
- **Estimated Effort**: 3-4 hours
- **Completed**: 2026-07-27

### T-023: Incident Timeline View ✅ COMPLETE
- **Files**: `frontend/src/components/IncidentTimeline.tsx`, `frontend/src/pages/Incidents.tsx`
- **Dependencies**: T-020, T-021
- **Completion Criteria**:
  - Timeline visualization of incidents with MITRE tactics ✅
  - Click to expand incident details ✅
  - Filter by status, severity, time range ✅
  - Real-time updates via WebSocket incident subscription ✅
- **Estimated Effort**: 3-4 hours
- **Completed**: 2026-07-27

### T-024: Alert/Incident Detail Views ✅ COMPLETE
- **Files**: `frontend/src/components/AlertDetail.tsx`, `frontend/src/components/IncidentDetail.tsx`
- **Dependencies**: T-020, T-021
- **Completion Criteria**:
  - Modal/drawer views for alert and incident details ✅
  - Shows evidence, MITRE tags, affected entities, confidence ✅
  - Status update actions (acknowledge, resolve, suppress) ✅
  - Related events/alerts list ✅
- **Estimated Effort**: 3-4 hours
- **Status**: ✅ COMPLETE — 2026-07-27

### T-025: Statistics Dashboard with Charts ✅ COMPLETE
- **Files**: `frontend/src/components/StatsDashboard.tsx`, `frontend/src/components/charts/`
- **Dependencies**: T-020, T-021
- **Completion Criteria**:
  - Overview cards: total alerts, open incidents, critical severity, sources ✅
  - Time-series chart: alerts over time (last 24h, 7d, 30d) ✅
  - Pie chart: alerts by severity ✅
  - Bar chart: alerts by detection type ✅
  - MITRE tactics heatmap ✅
  - Data fetched via REST API, updates via WebSocket ✅
- **Estimated Effort**: 4-5 hours
- **Status**: ✅ COMPLETE — 2026-07-27

**Charts Implemented**:
- `AlertsOverTimeChart.tsx` — Time-series area chart with gradient fill
- `SeverityDistributionChart.tsx` — Donut chart (Critical/High/Medium/Low)
- `DetectionTypeChart.tsx` — Vertical/horizontal bar chart (7 detection types)
- `MITRECoverageChart.tsx` — Horizontal bar chart (14 MITRE tactics)
- `EventsBySourceChart.tsx` — Stacked horizontal bar (events/alerts/incidents by source)
- `RecentActivityPanel.tsx` — Summary cards with icons and counts

### T-026: Source/API Key Management UI ✅ COMPLETE
- **Files**: `frontend/src/components/SourceManager.tsx`, `frontend/src/pages/Sources.tsx`
- **Dependencies**: T-020, T-021
- **Completion Criteria**:
  - List sources with status, event counts ✅
  - Create/edit/delete sources ✅
  - Generate/revoke/rotate API keys ✅
  - Copy API key to clipboard ✅
  - Key expiry management ✅
- **Estimated Effort**: 3-4 hours
- **Status**: ✅ COMPLETE — 2026-07-27

### T-027: Dark/Light Theme ✅ COMPLETE
- **Files**: `frontend/src/components/ThemeToggle.tsx`, `frontend/src/components/layout/TopNav.tsx`
- **Dependencies**: T-020, T-021
- **Completion Criteria**:
  - System preference detection ✅
  - Manual toggle in header ✅
  - Persists to localStorage ✅
  - All components respect theme ✅
- **Estimated Effort**: 1 hour
- **Status**: ✅ COMPLETE — 2026-07-27 (ThemeProvider done, toggle integrated in TopNav)

### T-028: Optional Polish Items

#### T-028a: Events Page Real Backend Integration ✅ ALREADY COMPLETE
- **File**: `frontend/src/pages/Events.tsx`
- **Dependencies**: T-020 through T-025, T-030, T-031 (ALL COMPLETE)
- **Completion Criteria**:
  - Remove all hardcoded/mock event data ✅
  - Connect EventsPage to backend API (`/api/v1/events/query`) ✅
  - Use proper API client and TanStack Query ✅
  - Support searching, filtering, pagination ✅
  - Preserve existing UI/UX ✅
  - Show proper loading, empty and error states ✅
  - No fake placeholder data ✅
- **Status**: ✅ COMPLETE — 2026-07-28 (was already done, docs were outdated)

#### T-028b: Events Page WebSocket Live Updates ✅ ALREADY COMPLETE
- **File**: `frontend/src/pages/Events.tsx`
- **Dependencies**: T-028a, T-022 (useWebSocket hook)
- **Completion Criteria**:
  - Add WebSocket subscription for real-time event updates ✅
  - Integrate with existing `useWebSocket` hook ✅
- **Status**: ✅ COMPLETE — Events.tsx subscribes to "events" and handles `onEvent` callback

#### T-028c: Dashboard - Fix EventsBySourceChart (random data) ✅ ALREADY COMPLETE
- **File**: `frontend/src/components/charts/EventsBySourceChart.tsx`
- **Dependencies**: T-025, T-026 (Sources API provides event counts)
- **Completion Criteria**: Replace Math.random() with real API data from `/api/v1/sources/event-counts` ✅
- **Status**: ✅ COMPLETE — StatsDashboard fetches from `apiClient.getSourceEventCounts()`

#### T-028d: Dashboard - Fix MITRECoverageChart (empty) ✅ HANDLED
- **File**: `frontend/src/components/charts/MITRECoverageChart.tsx`
- **Dependencies**: T-025 (backend provides MITRE data)
- **Completion Criteria**: Connect to aggregated MITRE data from alerts via `/api/v1/alerts/mitre-coverage` ✅
- **Status**: ✅ COMPLETE — Shows "No MITRE ATT&CK data" empty state when no alerts have MITRE tags (expected behavior)

#### T-028e: TopNav WebSocket Status Indicator ✅ ALREADY COMPLETE
- **File**: `frontend/src/components/layout/TopNav.tsx`
- **Dependencies**: T-022 (useWebSocket hook)
- **Completion Criteria**: Replace static "Connected" badge with real status from `useWebSocket` ✅
- **Status**: ✅ COMPLETE — Events.tsx has detailed WebSocket status panel; TopNav uses ConnectionStatusInline

---

## P2 - Milestone 3: Frontend Polish (Remaining)

### T-029: Source Event Counts Column ✅ COMPLETE (Backend + Frontend)

### T-030: Pagination for Sources Table ✅ COMPLETE
- **Files**: `frontend/src/components/SourceManager.tsx`, `hawkeye/api/v1/sources.py`
- **Dependencies**: T-026
- **Completion Criteria**: Currently loads all sources; add server-side pagination with limit/offset
- **Estimated Effort**: 1-2 hours
- **Priority**: P2 (nice to have)
- **Status**: ✅ COMPLETE — Implemented with page/pageSize state, server-side pagination, pagination controls

### T-031: Code-split Chart Components ✅ COMPLETE
- **Files**: `frontend/src/components/charts/`, `frontend/src/components/StatsDashboard.tsx`, `frontend/vite.config.ts`
- **Dependencies**: T-025 (charts implemented)
- **Completion Criteria**:
  - Use `React.lazy()` + `Suspense` for 6 chart components ✅
  - Configure Vite manual chunks for `recharts` and each chart ✅
  - Reduce initial JS bundle from ~1 MB to <600 KB ✅
  - Verify build passes, no regressions ✅
- **Estimated Effort**: 2-3 hours
- **Priority**: P1 (build warns about chunk size)
- **Status**: ✅ COMPLETE — 2026-08-02 (code-splitting actually implemented; was documented complete but used static imports)
  - Initial bundle: ~1.04 MB → ~600 KB (gzipped: 287 KB → 171 KB)
  - 6 chart chunks loaded on demand
  - Build passes, lint clean, tests pass

### T-034: Backend Lint Cleanup 🟢 OPTIONAL POLISH
- **Files**: `hawkeye/api/v1/*.py`, `hawkeye/services/detection/*.py`
- **Dependencies**: None
- **Completion Criteria**: Fix 57 ruff issues (C901 complexity, E501 line length, E741 ambiguous vars, ANN201 missing types, SIM102 nested ifs, I001 import sorting, ERA001 commented code, F401 unused imports, F811 redefinitions)
- **Estimated Effort**: 3-4 hours
- **Priority**: P3 (style only, no functional impact)
- **Status**: Optional — can be done after Milestone 3

---

## P1 - Milestone 3.5: Dashboard Polish + Functionality (DASH-POLISH-01) ✅ ALL COMPLETE

### DASH-POLISH-01: Dashboard Polish + Functionality Phase ✅ COMPLETE (2026-08-24)

**Summary:** Comprehensive polish of the existing Hawkeye dashboard to make it a genuinely usable, production-ready security monitoring interface backed by REAL backend data.

#### ISSUE-1: WebSocket Consolidation (P0) ✅ COMPLETE (2026-08-17)
- **Files Modified:**
  - `frontend/src/context/WebSocketContext.tsx` — Added type definitions, single source of truth
  - `frontend/src/pages/Alerts.tsx` — Migrated to useWebSocketContext + useWebSocketMessage
  - `frontend/src/pages/Incidents.tsx` — Migrated to useWebSocketContext + useWebSocketMessage
  - `frontend/src/pages/Events.tsx` — Verified already using WebSocketContext
  - `frontend/src/components/AlertFeed.tsx` — Updated import to use WebSocketContext types
  - `frontend/src/components/IncidentTimeline.tsx` — Updated import to use WebSocketContext types
  - `frontend/src/hooks/useWebSocket.ts` — **REMOVED**
- **Verification:** Frontend build ✅, Lint ✅, Backend tests 33/33 ✅
- **Result:** Single WebSocket connection for entire app; no more flickering indicator

#### ISSUE-2: Refresh Buttons Fix (P1) ✅ COMPLETE (2026-08-17)
- **Files Modified:**
  - `frontend/src/pages/Alerts.tsx` — Added `isFetching` to useQuery, Refresh button uses `isFetching` for spinner/disabled
  - `frontend/src/pages/Incidents.tsx` — Added `isFetching` to useQuery, Refresh button uses `isFetching` for spinner/disabled
  - `frontend/src/components/SourceManager.tsx` — Added `isFetching` to useQuery, Refresh button uses `isFetching` for spinner/disabled (Loader2 icon)
  - `frontend/src/pages/Events.tsx` — Added `isFetching` to useQuery, Refresh button uses `isFetching` for spinner/disabled (consistency)
- **Root Cause:** TanStack Query v5 `isLoading` only true for initial load; `isFetching` needed for refetch
- **Resolution:** Changed all 4 Refresh buttons to use `isFetching` for spinner and disabled state
- **Verification:** Frontend build ✅, Lint ✅, Backend tests 33/33 ✅, TypeScript ✅
- **Result:** Refresh buttons now properly show loading spinner and disable during refetch

#### ISSUE-3: Dashboard Time-Range Controls (P1) ✅ COMPLETE (2026-08-24)
- **File:** `frontend/src/components/StatsDashboard.tsx`
- **Criteria:** Clickable 24h/7d/30d controls that update timeRange and refetch chart data
- **Implementation:** Added `timeRange` state with `useState`, clickable buttons with active state styling, queryKey dependency triggers refetch
- **Verification:** Frontend build ✅, Lint ✅, TypeScript ✅, Buttons functional with active state

#### ISSUE-4: Global Search Enhancement (P2) ✅ COMPLETE (2026-08-24)
- **File:** `frontend/src/components/layout/TopNav.tsx`
- **Backend:** `hawkeye/api/v1/alerts.py`, `hawkeye/api/v1/incidents.py`, `hawkeye/api/v1/sources.py`, `hawkeye/schemas/alerts.py`
- **Types:** `frontend/src/types/index.ts`
- **Criteria:** Autocomplete, unified search across alerts/incidents/events/sources
- **Implementation:** Debounced search (250ms), parallel API calls to all 4 endpoints, dropdown with keyboard navigation (ArrowUp/Down, Enter, Escape), click-to-navigate, loading spinner
- **Verification:** Frontend build ✅, Lint ✅, TypeScript ✅, Search functional

#### ISSUE-5: Notification Bell (P2) ✅ COMPLETE (2026-08-24)
- **File:** `frontend/src/components/layout/TopNav.tsx`
- **Criteria:** Show recent high-severity alerts/incidents from WebSocket data
- **Implementation:** Notification dropdown with max 10 items, filters critical/high severity, real-time updates via WebSocket, timestamps, click-to-navigate to detail pages, clear all button, badge count indicator
- **Verification:** Frontend build ✅, Lint ✅, TypeScript ✅, Notifications appear in real-time

#### ISSUE-6: Profile/User Menu (P2) ✅ COMPLETE (2026-08-24)
- **Files:** `frontend/src/components/layout/TopNav.tsx`, `frontend/src/pages/Settings.tsx`
- **Criteria:** Profile, Security Settings, Sign Out handlers; Sign Out clears localStorage API key
- **Implementation:** Profile → `/settings?tab=profile`, Security Settings → `/settings?tab=api`, Sign Out → clears localStorage API key + reloads page
- **Verification:** Frontend build ✅, Lint ✅, TypeScript ✅, All menu items functional

#### ISSUE-7: General Visual/UX Polish (P3) ✅ COMPLETE (2026-08-24)
- **Files:** Various
- **Criteria:** Consistent spacing, loading states, empty states, layout stability
- **Implementation:** Applied consistent patterns across all components - loading skeletons, empty states, proper disabled states, stable layouts
- **Verification:** Frontend build ✅, Lint ✅, TypeScript ✅, Visual consistency achieved

---

## P2 - Milestone 4: Browser Security Agent (Planned → IN PROGRESS)

### T-040: Chrome MV3 Extension Scaffold 🟢 NEXT
- **Files**: `browser-agent/` (flat layout: `background/`, `content/`, `shared/`)
- **Dependencies**: Milestone 3 complete (ALL COMPLETE)
- **Current State (2026-08-24)**: Flat-layout scaffold committed. `npm run typecheck`
  FAILS with 8 TypeScript errors in `content/dom-monitor.ts`,
  `content/bot-detector.ts`, and `shared/api-client.ts` (StoredConfig id typing,
  PermissionName, SecurityPolicyViolationEvent.directive, DOM traversal types).
  Legacy `src/` layout intentionally kept as reference until the flat layout
  typechecks; remove it once parity is confirmed.
- **Next Steps**:
  1. Fix the 8 TS errors so `npm run typecheck` passes
  2. Build extension (`npm run build`) and load unpacked into Chrome
  3. Verify service worker + content scripts run without console errors
  4. Remove legacy `browser-agent/src/`
- **Completion Criteria**:
  - `manifest.json` — MV3 manifest with permissions, host_permissions, background service worker, content scripts
  - `background/service-worker.ts` — Event batching, API communication, CSP report handling
  - `content/dom-monitor.ts` — DOM mutation observer, CSP violation listener, DOM integrity checks
  - `content/bot-detector.ts` — Client-side bot/automation detection
  - `shared/types.ts` — Event schemas matching Hawk3ye backend (RawEvent, NormalizedEvent, etc.)
  - `shared/api-client.ts` — HTTP client for Hawk3ye REST API + WebSocket
  - `vite.config.ts` — Build config for extension (multiple entry points)
  - `package.json` — Dependencies and build scripts
  - Extension loads in Chrome without errors
  - Background service worker registers and handles messages
  - Content script injects on target pages
  - Basic message passing between content script and background works
  - Build produces valid extension bundle in `dist/`
- **Estimated Effort**: 4-6 hours
- **Priority**: P1 (starts Milestone 4)

### T-041: Content Script for DOM Monitoring
- **Files**: `browser-agent/content/dom-monitor.ts`, `browser-agent/content/bot-detector.ts`
- **Dependencies**: T-040
- **Completion Criteria**:
  - MutationObserver tracks DOM changes (script injection, iframe insertion, form modifications)
  - CSP violation detection via `SecurityPolicyViolationEvent` listener
  - DOM integrity monitoring (checksum/hash of critical elements)
  - Event batching with configurable flush interval
  - Events sent to background script via `chrome.runtime.sendMessage`
- **Estimated Effort**: 4-5 hours

### T-042: CSP Violation Detection & Reporting
- **Files**: `browser-agent/content/csp-reporter.ts`, `browser-agent/background/csp-handler.ts`
- **Dependencies**: T-041
- **Completion Criteria**:
  - Listen for `securitypolicyviolation` events on document
  - Extract violation details: directive, blocked URI, violated directive, source file, line/column
  - Report to background script for batching
  - Background forwards to Hawk3ye `/api/v1/events/ingest` with `category: "csp_violation"`
  - Handle report-only vs enforce mode
- **Estimated Effort**: 2-3 hours

### T-043: DOM Integrity Monitoring
- **Files**: `browser-agent/content/integrity-monitor.ts`
- **Dependencies**: T-041
- **Completion Criteria**:
  - Define critical DOM elements to monitor (forms, payment fields, auth buttons, scripts)
  - Compute baseline hashes on page load
  - Periodic re-check (configurable interval) for unauthorized modifications
  - Detect: attribute changes, innerHTML changes, script src changes, new script/iframe injection
  - Report anomalies to background script with element details and before/after state
- **Estimated Effort**: 3-4 hours

### T-044: Bot/Automation Detection (Client-side)
- **Files**: `browser-agent/content/bot-detector.ts`
- **Dependencies**: T-040
- **Completion Criteria**:
  - Detect headless browser indicators (webdriver, automation properties)
  - Check for automation frameworks (Puppeteer, Playwright, Selenium signatures)
  - Analyze navigator properties, permissions, WebGL fingerprints
  - Behavioral analysis: mouse movement entropy, click timing, scroll patterns
  - Score 0-100, report if threshold exceeded
  - Events sent with `category: "bot_detection"`, `detection_type: "bot"`
- **Estimated Effort**: 3-4 hours

### T-045: Event Batching & Batch Send to API
- **Files**: `browser-agent/background/event-batcher.ts`, `browser-agent/shared/api-client.ts`
- **Dependencies**: T-040, T-041
- **Completion Criteria**:
  - Queue events in memory (IndexedDB for persistence across restarts)
  - Configurable batch size (default 50) and flush interval (default 30s)
  - Retry logic with exponential backoff (max 3 retries)
  - Offline queue persistence — flush when connectivity restored
  - Send to Hawk3ye `/api/v1/events/ingest/batch` with API key auth
  - Handle 429/5xx responses gracefully
- **Estimated Effort**: 3-4 hours

### T-046: CSP Reporting Endpoint Integration
- **Files**: `hawkeye/api/v1/csp.py` (new), `browser-agent/background/csp-handler.ts`
- **Dependencies**: T-042, T-045
- **Completion Criteria**:
  - Backend: New endpoint `POST /api/v1/csp/report` accepting CSP violation reports
  - Endpoint creates `RawEvent` with `category: "csp_violation"`, normalizes, runs detection
  - Frontend: Background script receives CSP reports from content script, forwards to endpoint
  - Extension manifest includes `csp_report` directive pointing to backend
  - Verified end-to-end: CSP violation on page → extension captures → backend ingests → alert if anomalous
- **Estimated Effort**: 2-3 hours

---

## P2 - Milestone 5: SDK Integrations (Planned)

### T-050: Flask Middleware SDK
### T-051: FastAPI Middleware SDK
### T-052: Express.js Middleware SDK
### T-053: Python SDK (Direct API Client)
### T-054: Framework-Agnostic Client Library

---

## P2 - Milestone 6: Attack Replay & Documentation (Planned)

### T-060: Attack Replay Engine
### T-061: Replay API Endpoints
### T-062: Replay UI in Dashboard
### T-063: Comprehensive API Documentation (OpenAPI)
### T-064: Deployment Guides (Docker, K8s)
### T-065: Architecture Documentation
### T-066: Integration Guides

---

## Completed Tasks Summary

| Task | Description | Completed |
|------|-------------|-----------|
| T-001 | BotDetector undefined variable | 2026-07-20 (commit 13ed3a2) |
| T-002 | BotDetector duplicate return | 2026-07-20 (commit 13ed3a2) |
| T-003 | DetectionContext time window | 2026-07-24 |
| T-004 | All tests pass | 2026-07-24 |
| T-010 | WebSocket endpoint + lifespan | 2026-07-24 |
| T-011 | Alert broadcast | 2026-07-24 |
| T-012 | Incident broadcast | 2026-07-24 |
| T-013 | WebSocket auth (query param) | 2026-07-24 |
| T-014 | Heartbeat + stats | 2026-07-24 |
| T-015 | ConnectionManager | 2026-07-24 |
| T-020 | Frontend Setup (React+TS+Vite) | 2026-07-25 |
| T-021 | Tailwind + shadcn/ui Components | 2026-07-25 |
| T-022 | Real-time Alert Feed (WebSocket) | 2026-07-27 |
| T-023 | Incident Timeline View | 2026-07-27 |
| T-024 | Alert/Incident Detail Views | 2026-07-27 |
| T-025 | Statistics Dashboard with Charts | 2026-07-27 |
| T-030 | Fix ingestion route prefix | 2026-07-24 |
| T-031 | Fix events route prefix | 2026-07-24 |
| T-032 | WebSocket header auth | 2026-07-24 |
| T-033 | WebSocket reconnection | 2026-07-24 |
| T-026 | Source/API Key Management UI | 2026-07-27 |
| T-027 | Dark/Light Theme | 2026-07-27 |
| T-028a | Events page real backend | 2026-07-28 (already done) |
| T-028b | Events page WebSocket live | 2026-07-28 (already done) |
| T-028c | EventsBySourceChart real data | 2026-07-28 (already done) |
| T-028d | MITRECoverageChart empty state | 2026-07-28 (handled) |
| T-028e | TopNav WebSocket status | 2026-07-28 (already done) |
| T-029 | Source event counts column | 2026-07-28 (already done) |
| T-030 | Sources pagination | 2026-07-29 (already done) |
| T-031 | Code-split chart components | 2026-08-02 (fixed implementation) |
| **DASH-POLISH-01/ISSUE-1** | WebSocket Consolidation | 2026-08-17 |
| **DASH-POLISH-01/ISSUE-2** | Refresh Buttons Fix | 2026-08-17 |
| **DASH-POLISH-01/ISSUE-3** | Dashboard Time-Range Controls | 2026-08-24 |
| **DASH-POLISH-01/ISSUE-4** | Global Search + Autocomplete | 2026-08-24 |
| **DASH-POLISH-01/ISSUE-5** | Notification Bell | 2026-08-24 |
| **DASH-POLISH-01/ISSUE-6** | Profile/User Menu | 2026-08-24 |
| **DASH-POLISH-01/ISSUE-7** | General Visual/UX Polish | 2026-08-24 |
| **DASH-USABLE-01** | Auth flow, crash fixes, real typecheck, dead-control cleanup, server-side search everywhere, deep links, sources auth lockdown | 2026-08-24 |
| **UI-REDESIGN-01** | Deep frontend redesign: landing/get-started rebuild, 3 themes, chart x-axis fix (frontend+backend), 404/metadata/a11y, mobile fixes | 2026-08-25 |
| **VERIFY-01** | Browser verification pass (Playwright + browser-qa + visual-review subagents) | 2026-08-25 |
| **QA-POLISH-03** | Search hardening + mobile panel, DELETE sources endpoint, event-counts perf, stat semantics, source names, docs/USER_MANUAL.md, LICENSE, DB cleanup | 2026-08-26 |
| **FIX-AUTH-01** | Fresh-install bootstrap (first API key), actionable login errors when backend down | 2026-08-26 |
| **DEPLOY-01** | Dialog width cap fix, event detail widened, alerts/incidents side lists, dashboard refresh, search reset on nav, Vercel/Render deploy prep, legacy-v1 tag | 2026-08-26 |
| **AUDIT-MIGRATE-01** | Migration-readiness audit (Vercel + Render + PG) | 2026-09-05 |
| **SEC-RELEASE-01** | Source ownership enforcement, expiry enforcement, ingestion error sanitization, deployment docs hardening | 2026-09-05 |
| **WS-LIVE-01** | Fixed silently-dead live event broadcasts (subscription mismatch + missing created_at), 4 regression tests, proven live on PG16 and dashboard UI | 2026-09-05 |

**Total Completed: 45 tasks**

---

## P2 - Discovered during UI-REDESIGN-01 (optional)

### DATA-HYGIENE-01: Clean polluted dev database ✅ DONE (2026-08-26)
- `scripts/cleanup_test_sources.py` added (name-pattern + zero-data guarded,
  `--dry-run` supported) and executed: 1,098 empty QA sources deleted;
  the dev DB now holds exactly the 5 seeded demo sources. `/sources/event-counts`
  also optimized (3 grouped queries, ~73 ms warm vs ~7 s before).

### STATS-SCOPE-01: Clarify dashboard stat scopes
- "Active Alerts 0" (per-source scoped stats endpoint) sits next to a
  "86 critical" badge (global count) on the same card. Decide whether stats
  endpoints should be global for the dashboard or the cards should be labeled
  per-source.

### SCALE-WS-01: Redis-backed ConnectionManager before horizontal scaling
- WebSocket sessions, broadcast fan-out, and reconnection history live in
  process memory (hawkeye/api/websocket.py). The backend must run as a single
  instance (render.yaml/Dockerfile pin --workers 1). Before scaling out,
  externalize ConnectionManager state to Redis pub/sub.

**Next Active: T-040 (Chrome MV3 Extension Scaffold)**