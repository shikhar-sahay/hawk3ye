# Hawk3ye v2 Roadmap

## Overall Project Goal
Build a production-ready Web Application Security Monitoring Platform (SIEM-lite) with real-time dashboard, WebSocket updates, browser security agent, and SDK integrations.

---

## Major Milestones

### Milestone 1: Backend MVP
**Target: 2026-07-27**  
**Status: ✅ 100% COMPLETE — Achieved 2026-07-24**

- Event ingestion API (REST)
- Event normalization engine with MITRE ATT&CK tagging
- Detection engine with 7 detectors
- Correlation engine for incident creation
- Alerts API (list, stats, get, update)
- Incidents API (list, stats, get, alerts, update status)
- API key authentication & source management
- SQLite/PostgreSQL database with SQLModel
- All tests passing

---

### Milestone 2: Real-time Dashboard Backend
**Target: TBD (after Milestone 1)**  
**Status: ✅ 100% COMPLETE — Achieved 2026-07-24**

- WebSocket server implementation
- Real-time alert/incident broadcast
- Connection management & auth
- WebSocket client reconnection logic
- Health & connection status endpoints

---

### Milestone 3: Frontend Dashboard
**Target: TBD (after Milestone 2)**  
**Status: ✅ 100% COMPLETE — Achieved 2026-08-02**

| Component | Status | Location |
|-----------|--------|----------|
| React + TypeScript + Vite setup | ✅ COMPLETE | `frontend/` |
| Tailwind CSS + shadcn/ui (24 primitives) | ✅ COMPLETE | `frontend/src/components/ui/` |
| ThemeProvider (dark/light/system) | ✅ COMPLETE | `frontend/src/components/providers/ThemeProvider.tsx` |
| React Router v6 with nested routes | ✅ COMPLETE | `frontend/src/App.tsx` |
| TanStack Query (React Query) setup | ✅ COMPLETE | `frontend/src/main.tsx` |
| API client with full TypeScript types | ✅ COMPLETE | `frontend/src/api/client.ts` |
| AppLayout with collapsible Sidebar | ✅ COMPLETE | `frontend/src/components/layout/` |
| TopNav with ThemeToggle + Search + Connection Status | ✅ COMPLETE | `frontend/src/components/layout/TopNav.tsx` |
| **Dashboard Page** (KPIs + 6 charts, code-split) | ✅ COMPLETE | `frontend/src/pages/Dashboard.tsx`, `StatsDashboard.tsx`, `charts/` |
| **Events Page** (real backend + WebSocket live + CSV export) | ✅ COMPLETE | `frontend/src/pages/Events.tsx` |
| **Alerts Page** (real-time feed + WebSocket) | ✅ COMPLETE | `frontend/src/pages/Alerts.tsx`, `AlertFeed.tsx` |
| **Incidents Page** (timeline + WebSocket) | ✅ COMPLETE | `frontend/src/pages/Incidents.tsx`, `IncidentTimeline.tsx` |
| **AlertDetail Modal** (5 tabs: Overview, Evidence, MITRE, Actions) | ✅ COMPLETE | `frontend/src/components/AlertDetail.tsx` |
| **IncidentDetail Modal** (5 tabs: Overview, Timeline, Alerts, MITRE, Actions) | ✅ COMPLETE | `frontend/src/components/IncidentDetail.tsx` |
| **Sources Page** (SourceManager: CRUD + API key lifecycle + pagination) | ✅ COMPLETE | `frontend/src/pages/Sources.tsx`, `SourceManager.tsx` |
| **Settings Page** (4 tabs: General, API, WebSocket, About) | ✅ COMPLETE | `frontend/src/pages/Settings.tsx` |
| WebSocket Context (shared connection, auto-reconnect, session resume) | ✅ COMPLETE | `frontend/src/context/WebSocketContext.tsx` |
| ConnectionStatusCard (reusable: inline + full card) | ✅ COMPLETE | `frontend/src/components/ConnectionStatusCard.tsx` |

---

#### Chart Components Implemented
| Chart | Type | Description | Backend Endpoint |
|-------|------|-------------|------------------|
| `AlertsOverTimeChart` | Area chart | Time-series alerts (24h/7d/30d) | `/alerts/over-time` |
| `SeverityDistributionChart` | Donut chart | Critical/High/Medium/Low distribution | `/alerts/stats` |
| `DetectionTypeChart` | Bar chart | 7 detection types | `/alerts/stats` |
| `MITRECoverageChart` | Horizontal bar | 14 MITRE ATT&CK tactics/techniques | `/alerts/mitre-coverage` |
| `EventsBySourceChart` | Stacked bar | Events/Alerts/Incidents by source | `/sources/event-counts` |
| `RecentActivityPanel` | Summary cards | Key metrics overview | `/alerts/stats`, `/incidents/stats` |

---

#### T-031: Code-split Chart Components — **COMPLETE**
- All 6 chart components wrapped with `React.lazy()` + `Suspense` with skeleton fallbacks
- Vite manual chunks: vendor-react, vendor-query, vendor-charts (recharts), vendor-ui, 6 individual chart chunks
- **Build Results:**
  - Before: ~1.04 MB JS (gzipped: 287 KB), single chunk warning
  - After: ~601 KB JS (gzipped: 171 KB) for main chunk, 6 lazy-loaded chart chunks (2-28 KB each), recharts in vendor-charts chunk (350 KB)
  - **42% reduction in main bundle size**

---

### Milestone 3.6: Public Site Redesign & Theme System — **COMPLETE (2026-08-25)**
- Full landing redesign around the WATCH → INGEST → DETECT → CORRELATE →
  RESPOND identity (animated observation-field hero, pipeline rail,
  event→alert→incident story, detection matrix with real triggers + ATT&CK
  mappings, labeled dashboard preview, FAQ, branded CTA/footer)
- Get Started rebuilt as a 5-step onboarding timeline with copyable commands
- Three-theme system: Light / Deep Blue / Pitch Black (anti-FOUC boot)
- Branded 404, per-route titles/meta, robots.txt, sitemap, OG image
- Alerts Over Time x-axis made range-aware (backend bucketing + frontend
  tick formatting); a11y pass (skip links, landmarks, drawer focus management,
  contrast fixes); zero horizontal overflow 320–1440px

---

### Production Deployment (Vercel + Render + Neon): DEPLOYED (2026-09-07)
- Frontend on Vercel (React/Vite SPA): `https://hawk3ye.vercel.app`
- Backend on Render (FastAPI, single worker): `https://hawkeye-api-f01y.onrender.com`
- Production database: Neon PostgreSQL (asyncpg driver)
- Verified live: Vercel → Render routing, production authentication/API keys,
  PostgreSQL persistence, REST event ingestion, WebSocket connection + live
  event/alert/incident fanout (no page refresh), detection → alerts →
  correlated incidents, Render cold-start/waking UX
- Production fixes included: PostgreSQL/asyncpg compatibility (Neon pooled-URL
  sslmode/channel_binding handling, JSON filter CASTs, asyncpg dependency),
  WebSocket live-delivery fix (subscription routing + `created_at` mapping)

---

### Milestone 4: Browser Security Agent
**Target: TBD (after Milestone 3)**  
**Status: 🟢 IN PROGRESS — 0% (T-040: Chrome MV3 Extension Scaffold starting)**

- Browser extension (Manifest V3)
- Content script for DOM monitoring
- CSP violation detection & reporting
- DOM integrity monitoring
- Bot/automation detection
- Event batching & batch send to Hawk3ye API
- CSP reporting endpoint integration

---

### Milestone 5: SDK Integrations
**Target: TBD (after Milestone 4)**  
**Status: ⏳ PLANNED — 0%**

- Python/Flask SDK (middleware)
- FastAPI middleware
- Express.js/Node.js middleware
- Python SDK for direct API usage
- Framework-agnostic client library

---

### Milestone 6: Attack Replay & Documentation
**Target: TBD (after Milestone 5)**  
**Status: ⏳ PLANNED — 0%**

- Attack replay engine
- Replay API endpoints
- Replay UI in dashboard
- Comprehensive API documentation (OpenAPI)
- Deployment guides (Docker, Kubernetes)
- Architecture documentation
- Integration guides

---

## Current Status

**Active Milestone: Milestone 4 - Browser Security Agent**
**Progress: 0% (Starting T-040: Chrome MV3 Extension Scaffold)**
**Production: DEPLOYED (2026-09-07) - Vercel frontend + Render backend + Neon PostgreSQL (see Production Deployment above)**

Milestone 3 (Frontend Dashboard) is 100% complete — all 6 pages implemented, connected to real backend, real-time WebSocket, code-split charts.

---

## Milestone Dependencies

```
Milestone 1 (Backend MVP) → Milestone 2 (WebSocket Backend)
    ↓                              ↓
Milestone 2 (WebSocket Backend) → Milestone 3 (Frontend Dashboard)
    ↓                              ↓
Milestone 3 (Frontend) → Milestone 4 (Browser Agent)
    ↓                              ↓
Milestone 4 (Browser Agent) → Milestone 5 (SDKs)
    ↓                              ↓
Milestone 5 (SDKs) → Milestone 6 (Attack Replay & Docs)
```

---

## Frontend Implementation Status (Milestone 3 Detail)

### ✅ COMPLETED
| Component | Status | Location |
|-----------|--------|----------|
| React 18 + TypeScript + Vite setup | ✅ | `frontend/` |
| Tailwind CSS configuration | ✅ | `frontend/tailwind.config.js` |
| shadcn/ui component library (24 primitives) | ✅ | `frontend/src/components/ui/` |
| ThemeProvider (dark/light, localStorage) | ✅ | `frontend/src/components/providers/ThemeProvider.tsx` |
| React Router v6 with nested routes | ✅ | `frontend/src/App.tsx` |
| TanStack Query (React Query) setup | ✅ | `frontend/src/main.tsx` |
| API client with full TypeScript types | ✅ | `frontend/src/api/client.ts` |
| AppLayout with collapsible Sidebar | ✅ | `frontend/src/components/layout/AppLayout.tsx`, `Sidebar.tsx` |
| TopNav with ThemeToggle + Search + ConnectionStatusInline | ✅ | `frontend/src/components/layout/TopNav.tsx`, `ThemeToggle.tsx` |
| DashboardPage (stats cards, 6 charts, code-split) | ✅ | `frontend/src/pages/Dashboard.tsx` |
| EventsPage (filterable table, search, pagination, WebSocket live, CSV export) | ✅ | `frontend/src/pages/Events.tsx` |
| AlertsPage (real-time feed, WebSocket + REST) | ✅ | `frontend/src/pages/Alerts.tsx` |
| IncidentsPage (timeline, WebSocket + REST) | ✅ | `frontend/src/pages/Incidents.tsx` |
| AlertDetail component (modal, 5 tabs, status actions) | ✅ | `frontend/src/components/AlertDetail.tsx` |
| IncidentDetail component (modal, 5 tabs, status actions) | ✅ | `frontend/src/components/IncidentDetail.tsx` |
| Statistics Dashboard with Charts | ✅ | `frontend/src/components/StatsDashboard.tsx`, `charts/` |
| 6 Chart Components (Recharts) — lazy-loaded | ✅ | `frontend/src/components/charts/` |
| Source/API Key Management UI | ✅ | `frontend/src/components/SourceManager.tsx`, `Sources.tsx` |
| Settings Page (4 tabs) | ✅ | `frontend/src/pages/Settings.tsx` |
| WebSocket hook (auto-reconnect, session resume, subscriptions) | ✅ | `frontend/src/hooks/useWebSocket.ts` |
| ConnectionStatusCard (reusable inline + card) | ✅ | `frontend/src/components/ConnectionStatusCard.tsx` |

---

### 🟢 IN PROGRESS / NEXT
| Task | Status | Details |
|------|--------|---------|
| **DASH-POLISH-01: Dashboard Polish (ISSUE-1)** | ✅ COMPLETE | WebSocket consolidation — single shared connection via WebSocketContext |
| **DASH-POLISH-01: Dashboard Polish (ISSUE-2)** | ✅ COMPLETE | Refresh buttons fixed — TanStack Query v5 `isFetching` for refetch state on Alerts, Incidents, Events, Sources pages |
| **T-034: Backend lint cleanup** | ⏳ OPTIONAL | 57 ruff issues (C901, E501, E741, ANN201, SIM102, I001, ERA001, F401, F811) — style only, no functional impact |
| **DASH-POLISH-01: Dashboard Polish (ISSUE-3)** | 🟢 NEXT | Dashboard time-range controls (24h/7d/30d) for charts |
| **T-040: Chrome MV3 Extension Scaffold** | ⏳ PLANNED | Create browser-agent/ directory with manifest.json, background service worker, content scripts, shared types, build config |

---

---

## Verification Commands

### Backend Verification (Milestones 1-2)
```bash
# Run all tests
pytest tests/ -v

# Lint check
ruff check hawkeye/

# Start dev server
uvicorn hawkeye.main:app --reload
```

### Frontend Verification (Milestone 3)
```bash
# In frontend/ directory
npm install
npm run dev      # Dev server (port 5173)
npm run build    # TypeScript compile + Vite build
npm run lint     # ESLint check
```