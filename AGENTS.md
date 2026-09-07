# Hawk3ye v2 — Developer Handbook

This is the definitive operating manual for all Codex sessions working on Hawk3ye. A brand new session with zero prior context should be able to read **only this file and SESSION.md** and immediately continue productive development.

---

## 1. Project Overview

**What Hawk3ye is:** A web application security monitoring platform (SIEM-lite) that ingests security events from web applications, normalizes them with MITRE ATT&CK tags, runs 7 detection engines, correlates alerts into incidents, and exposes everything via REST APIs + WebSocket.

**Final Vision:** A production-ready, self-hostable security monitoring stack with:
- Real-time alert/incident dashboard (WebSocket + React)
- Browser security agent (Chrome extension MV3) for client-side telemetry
- Framework SDKs (Flask, FastAPI, Express) for automatic instrumentation
- Attack replay engine for incident investigation
- Optional PyPI package (`pip install hawkeye`)

**Intended Users:** Security engineers, DevSecOps teams, and developers who need application-layer visibility without enterprise SIEM complexity.

**Overall Architecture:**
```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Web Apps   │────▶│  Hawk3ye API     │────▶│  PostgreSQL  │
│  (SDKs)     │     │  (FastAPI)       │     │  (SQLModel)  │
└─────────────┘     └────────┬─────────┘     └──────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
       ┌────────────┐ ┌─────────────┐ ┌────────────┐
       │ Ingestion  │ │ Detection   │ │ Correlation│
       │ Service    │ │ Engine (7x) │ │ Engine     │
       └────────────┘ └─────────────┘ └────────────┘
              │              │              │
              ▼              ▼              ▼
       ┌──────────────────────────────────────────┐
       │            REST + WebSocket API          │
       └──────────────────────────────────────────┘
              │              │              │
              ▼              ▼              ▼
       ┌────────────┐ ┌─────────────┐ ┌────────────┐
       │  Frontend  │ │  Browser    │ │   SDKs     │
       │  (React)   │ │  Agent      │ │ (Python/JS)│
       └────────────┘ └─────────────┘ └────────────┘
```

**"Production-Ready MVP" Definition (Milestone 1):**
- All 7 detectors functional and tested
- Alerts + Incidents REST APIs complete with filtering, stats, status updates
- API key authentication working
- SQLite (dev) / PostgreSQL (prod) via SQLModel
- 33/33 unit tests passing
- Zero known P0 bugs

---

## 2. Repository Layout

```
Hawkeye/
├── hawkeye/              # Main backend package (FastAPI app)
│   ├── main.py           # App entry point, lifespan, CORS, health
│   ├── config.py         # Pydantic Settings (all env-configurable)
│   ├── database.py       # Async SQLModel engine, session management
│   ├── core/
│   │   ├── auth.py       # API key hashing, verification, generation
│   │   └── normalization.py  # Event normalization + MITRE mapping
│   ├── models/
│   │   ├── events.py     # SQLModel tables: Source, RawEvent, NormalizedEvent, Alert, Incident, IncidentAlert, ApiKey
│   │   └── enums.py      # Severity, DetectionType, AlertStatus, IncidentStatus
│   ├── schemas/          # Pydantic request/response models
│   ├── api/
│   │   ├── deps.py       # FastAPI dependencies (auth, session)
│   │   └── v1/           # REST endpoints (ingestion, events, sources, alerts, incidents)
│   │       ├── ingestion.py
│   │       ├── events.py
│   │       ├── sources.py
│   │       ├── alerts.py
│   │       ├── incidents.py
│   │       └── websocket.py
│   └── services/
│       ├── ingestion_service.py
│       ├── detection/
│       │   ├── engine.py       # DetectionEngine orchestrates 7 detectors
│       │   ├── base.py         # BaseDetector, DetectionContext, Alert factory
│       │   ├── brute_force.py
│       │   ├── credential_stuffing.py
│       │   ├── enumeration.py
│       │   ├── bot.py
│       │   ├── sensitive_actions.py
│       │   ├── session_hijacking.py
│       │   └── api_abuse.py
│       └── correlation/
│           └── engine.py       # CorrelationEngine (time-window based)
├── frontend/             # React + TypeScript + Vite (Milestones 3 & 3.5 — COMPLETE)
│   ├── src/
│   │   ├── api/client.ts       # TanStack Query API client
│   │   ├── components/
│   │   │   ├── ui/             # shadcn/ui primitives (24 components)
│   │   │   ├── layout/         # AppLayout, Sidebar, TopNav (search, notifications, user menu)
│   │   │   ├── providers/      # ThemeProvider
│   │   │   ├── alerts/         # AlertFeed
│   │   │   ├── charts/         # 6 chart components (lazy-loaded)
│   │   │   ├── dashboard/      # Dashboard components
│   │   │   └── incidents/      # IncidentTimeline
│   │   ├── context/WebSocketContext.tsx  # SINGLE shared WebSocket provider (only WS implementation)
│   │   ├── hooks/              # use-toast only (useWebSocket hook was REMOVED)
│   │   ├── pages/              # Dashboard, Events, Alerts, Incidents, Sources, Settings
│   │   ├── types/index.ts      # TypeScript types matching backend schemas
│   │   ├── lib/utils.ts        # cn() helper
│   │   ├── App.tsx             # Router + routes
│   │   └── main.tsx            # Entry point
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   └── vite.config.ts          # Dev proxy: /api + /ws → localhost:8000 (changeOrigin on /ws)
├── browser-agent/          # Chrome MV3 extension (Milestone 4 — scaffold IN PROGRESS)
│   ├── manifest.json       # MV3 manifest
│   ├── background/service-worker.ts
│   ├── content/dom-monitor.ts, bot-detector.ts
│   ├── shared/api-client.ts, types.ts
│   ├── icons/
│   └── vite.config.ts      # Builds to dist/ for Chrome "Load unpacked"
│   # NOTE: flat layout (background/, content/, shared/) — old src/ layout is legacy
├── tests/                # Unit tests (pytest + pytest-asyncio)
│   ├── test_detection.py
│   ├── test_ingestion.py
│   └── test_websocket.py
├── docs/USER_MANUAL.md    # End-user manual (setup, dashboard, search, troubleshooting)
├── legacy-v1/             # ARCHIVED — Old Flask implementation, reference only
├── alembic/              # Database migrations (Milestone 6 — NOT STARTED)
├── render.yaml           # Render blueprint for the v2 backend
├── Dockerfile            # Backend container image (single worker)
├── pyproject.toml        # Build config, dependencies, ruff/mypy/pytest settings
├── AGENTS.md             # THIS FILE — Developer handbook
├── SESSION.md            # Current session state (single active task)
├── TODO.md               # Engineering backlog (P0–P3 with IDs, deps, criteria)
├── CHANGELOG.md          # Completed work only, reverse chronological
└── ROADMAP.md            # Six milestones, progress %, dependencies
```

**Important:** `legacy-v1/` is archived reference code only. Do not modify or depend on it.

---

## 3. Current Architecture (Implemented)

- **Framework:** FastAPI (async, Python 3.11+)
- **Database:** SQLModel + SQLAlchemy 2.0 async — SQLite for dev, PostgreSQL for prod
- **Auth:** API keys with bcrypt hashing, X-API-Key header
- **Ingestion:** Single + batch endpoints → normalization → persistence → detection
- **Detection Engine:** `DetectionEngine.process_event()` runs 7 detectors sequentially:
  1. BruteForceDetector
  2. CredentialStuffingDetector
  3. EnumerationDetector
  4. BotDetector
  5. SensitiveActionDetector
  6. SessionHijackingDetector
  7. APIAbuseDetector
- **Correlation Engine:** Time-window based alert grouping → Incident creation + MITRE aggregation
- **REST APIs:** `/api/v1/events`, `/api/v1/sources`, `/api/v1/alerts`, `/api/v1/incidents`
- **WebSocket API:** `/ws` with multi-method auth, subscriptions, heartbeat, reconnection
- **Frontend:** React + TypeScript + Vite (Milestones 3 & 3.5 — complete)
- **Browser Agent:** Chrome MV3 extension scaffold (flat layout), Milestone 4 in progress

---

## 4. Long-Term Roadmap (6 Milestones)

| # | Milestone | Target | Status |
|---|-----------|--------|--------|
| 1 | **Backend MVP** | 2026-07-27 | ✅ 100% — Achieved 2026-07-24 |
| 2 | **Real-time Dashboard Backend** | After M1 | ✅ 100% — Achieved 2026-07-24 |
| 3 | **Frontend Dashboard** | After M2 | ✅ 100% — Achieved 2026-08-02 |
| 3.5 | **Dashboard Polish + Functionality** | After M3 | ✅ 100% — Achieved 2026-08-24 (DASH-POLISH-01, Issues 1–7) |
| 4 | **Browser Security Agent** | After M3.5 | 🟢 IN PROGRESS (scaffold started) |
| 5 | **SDK Integrations** | After M4 | ⏳ 0% |
| 6 | **Attack Replay & Docs** | After M5 | ⏳ 0% |

Full details in `ROADMAP.md`. Do not duplicate here.

---

## 5. Current Development Status

- **Active Milestone:** 4 — Browser Security Agent (scaffold in progress)
- **What's Done (Backend - Milestones 1 & 2):** All APIs, all 7 detectors, correlation engine, auth, database, **33/33 unit tests passing**
- **What's Done (Frontend - Milestones 3 & 3.5):**
  - React+TS+Vite setup, Tailwind+shadcn/ui (24 components), ThemeProvider, React Router, TanStack Query, API client with full types
  - Dashboard page with StatsDashboard + 6 charts (all connected to real backend, code-split with lazy loading)
  - Interactive 24h/7d/30d time-range controls on Alerts Over Time chart
  - Events page (filterable table, search, pagination, CSV export, **real backend + WebSocket live updates**)
  - Alerts page (real-time alert feed + WebSocket)
  - Incidents page (incident timeline + WebSocket)
  - AlertDetail, IncidentDetail modals with status actions
  - Sources page (SourceManager: full CRUD + API key lifecycle + pagination)
  - Settings page (4 tabs: General, API, WebSocket, About)
  - AppLayout with Sidebar+TopNav (theme toggle, connection status, user menu)
  - TopNav global search: debounced autocomplete across events/alerts/incidents/sources (server-side search params, match highlighting, loading/error/empty states) with keyboard navigation; mobile search panel below the sm breakpoint
  - TopNav notification bell: real-time high-severity alerts/incidents from shared WebSocket
  - Functional user menu: Profile → Settings, Security Settings → API tab, Sign Out clears API key
  - Routing for all 6 pages
  - ConnectionStatusCard (reusable: inline for TopNav, full card for Events page)
- **WebSocket Architecture:** SINGLE shared connection — `WebSocketProvider` (in `AppLayout`) → `WebSocketContext` → all consumers (TopNav, Events, Alerts, Incidents). The old `useWebSocket.ts` hook was removed; `frontend/src/context/WebSocketContext.tsx` is the only WS implementation.
- **What's Blocked:** Nothing critical. Optional next: T-034 backend lint cleanup
- **Source of Truth for Active Task:** `SESSION.md` — always contains exactly one current engineering task with status, files, verification commands, and handoff notes

---

## 6. Engineering Principles (MANDATORY)

1. **Repository is the source of truth** — Never rely on chat history. Always `Read` before `Edit`.
2. **Read order for every new session:**
   - `AGENTS.md` (this handbook)
   - `SESSION.md` (current task)
   - `TODO.md` (backlog context)
   - `CHANGELOG.md` (only if needed)
   - `ROADMAP.md` (only for milestone context)
3. **Never redesign architecture** — Unless explicitly requested by the user.
4. **Exactly ONE active engineering task per session** — Complete it fully before starting another.
5. **Verify every implementation** — Run tests, lint, confirm expected behavior.
6. **Keep responses brief** — Concise, action-oriented. No essays.

---

## 7. Session Workflow

### Session Start
```
1. Read AGENTS.md
2. Read SESSION.md (current task, status, blockers, verification commands)
3. Read TODO.md (confirm task exists, check dependencies)
4. Begin work on the single active task in SESSION.md
```

### During Implementation
- Modify only files relevant to the active task
- Run verification commands after each logical step
- Update `SESSION.md` with progress: status, verification results, next action

### Session Completion Checklist (MANDATORY — exact order)

☐ **1. Verify the implementation** — Run all relevant tests; confirm they pass  
☐ **2. Update SESSION.md** — Current status, verification results, next action, handoff notes  
☐ **3. Update TODO.md** — Mark completed tasks; adjust dependencies if needed  
☐ **4. Update CHANGELOG.md** — Add completed work under current version  
☐ **5. Update ROADMAP.md** — Only if milestone progress % or status changed  
☐ **6. Only then stop**

---

## 8. Documentation Rules

| File | Responsibility | Update Frequency |
|------|----------------|------------------|
| **AGENTS.md** | Developer handbook — architecture, workflow, principles, roadmap summary | Only when workflow/architecture changes |
| **SESSION.md** | Single source of truth for current session — active task, status, blockers, verification, handoff | Every session |
| **TODO.md** | Engineering backlog — every task has ID, priority, dependencies, completion criteria | When tasks added/completed/blocked |
| **CHANGELOG.md** | Completed work only, reverse chronological, versioned | When features/fixes land |
| **ROADMAP.md** | Six milestones, progress %, dependencies | Only when milestone status changes |

**Each file has exactly one clear purpose. Do not duplicate content across files.**

---

## 9. Development Priorities

**Current Priority (Milestone 4):**
Browser Security Agent — complete the Chrome MV3 extension scaffold (T-040): content script for DOM monitoring, CSP violation detection, DOM integrity monitoring, bot/automation detection, event batching. The scaffold uses a flat layout (`background/`, `content/`, `shared/`); the old `src/` layout is legacy and should be removed once migration is confirmed.

**After Browser Agent (Milestone 5):**
SDK Integrations — Flask, FastAPI, Express middleware + framework-agnostic clients.

**Finally (Milestone 6):**
- Attack Replay engine
- Production packaging (`pip install hawkeye`)
- Docker/K8s deployment configs (Dockerfile + render.yaml blueprint exist; Vercel hosts the frontend - see docs/deployment.md)
- Alembic migrations
- Comprehensive documentation

---

## 10. Future Vision

Hawk3ye becomes a **production-ready web application security monitoring platform** providing:

- **Real-time security monitoring** — Ingest, normalize, detect, correlate, alert
- **Browser telemetry** — Chrome extension captures CSP violations, DOM integrity, automation signals
- **Detection & correlation** — 7 built-in detectors + extensible framework
- **Incident management** — Grouped alerts, MITRE tags, severity escalation, status workflow
- **Live dashboard** — WebSocket-driven React UI with charts, timelines, drill-down
- **SDK integrations** — Drop-in middleware for Flask, FastAPI, Express + framework-agnostic clients
- **Optional self-hosted deployment** — Docker Compose for dev, K8s manifests for prod
- **Future PyPI package** — `pip install hawkeye` for instant integration

---

## Quick Reference Commands

```bash
# Run all tests
pytest tests/ -v

# Run specific test file
pytest tests/test_detection.py -v

# Lint
ruff check .

# Start dev server (after Milestone 1)
uvicorn hawkeye.main:app --reload

# Install in editable mode
pip install -e .

# Frontend commands (in frontend/ directory)
npm install
npm run dev      # Dev server
npm run build    # TypeScript compile + Vite build
npm run lint     # ESLint check
```

---

## Key Files for Active Development

| Task | Primary Files |
|------|---------------|
| T-040 (Browser agent scaffold) | `browser-agent/` (flat layout: `background/`, `content/`, `shared/`) |
| T-034 (Backend lint) | `hawkeye/api/v1/*.py`, `hawkeye/services/detection/*.py` (C901, E741, E501, ANN201, SIM102) |

Read `SESSION.md` for current task details. Read `TODO.md` for full backlog.

---

## WebSocket Protocol Reference (Backend → Frontend)

**Endpoint:** `ws://host/ws`
**Auth (priority order):**
1. `Authorization: Bearer <api_key>` header
2. `X-API-Key: <api_key>` header
3. `?api_key=<api_key>` query param (backward compat)

**Client → Server Messages:**
```json
{"type": "pong"}
{"type": "subscribe", "data": {"types": ["alerts", "incidents", "events"]}}
{"type": "unsubscribe", "data": {"types": ["alerts"]}}
{"type": "ping"}
{"type": "reconnect", "data": {"session_id": "...", "last_event_id": 123}}
```

**Server → Client Messages:**
```json
{"type": "connected", "timestamp": "...", "data": {"connection_id": "...", "source_id": 1, "source_name": "...", "subscriptions": ["alerts"], "session_id": "..."}}
{"type": "alert", "timestamp": "...", "event_id": 1, "data": {...}}
{"type": "incident", "timestamp": "...", "event_id": 2, "data": {...}}
{"type": "event", "timestamp": "...", "event_id": 3, "data": {...}}
{"type": "ping", "timestamp": "..."}
{"type": "pong", "timestamp": "..."}
{"type": "error", "timestamp": "...", "data": {"code": "...", "message": "..."}}
```

**ConnectionManager Singleton:** `hawkeye.api.websocket.connection_manager`
**Broadcast Methods:** `broadcast_alert()`, `broadcast_incident()`, `broadcast_custom()`

---

## API Conventions

- **Prefix:** All REST endpoints under `/api/v1`
- **Auth:** `X-API-Key` header (required for all endpoints except `/health`, `/`, and first-source bootstrap — see Authentication below)
- **Pagination:** `limit` (default 50, max 100), `offset` (default 0)
- **Filtering:** Query parameters (e.g., `?severity=high&status=new`); alerts/incidents/sources/events also accept `search`
- **Response Envelope:** Lists return `{ items: [], total: N, limit: L, offset: O }`
- **Error Format:** `{ "detail": "error message" }` with appropriate HTTP status
- **WebSocket:** Separate router at `/ws`, no `/api/v1` prefix

**Authentication (frontend):**
- The dashboard signs in with a source API key on the `/login` page; the key is
  validated against `GET /api/v1/sources?limit=1` and stored in localStorage
  (`hawkeye_api_key`). No secret is ever baked into the frontend bundle.
- 401/403 responses trigger a global unauthorized event that routes back to login.
- Backend: ALL `/sources/*` endpoints require auth EXCEPT `POST /sources`, which is
  open only while the deployment has zero registered sources (bootstrap).
- Ingestion endpoints: POST /api/v1/events (single) and POST /api/v1/events/batch.
- First API key: POST /sources/{id}/api-keys is also open while the deployment
  has zero API keys (fresh-install bootstrap; mints the first credential).
- Ingestion endpoints: `POST /api/v1/events` (single) and `POST /api/v1/events/batch`.

**Additional Backend Endpoints (for Dashboard):**
- `GET /api/v1/sources/event-counts` — Event/alert/incident counts per source
- `GET /api/v1/alerts/stats` — Aggregate alert statistics
- `GET /api/v1/alerts/time-series?hours=N` — Time-series alert data (NOTE: it is `/time-series`, NOT `/over-time`)
- `GET /api/v1/alerts/mitre-coverage` — MITRE ATT&CK tactic/technique counts
- `GET /api/v1/incidents/stats` — Aggregate incident statistics

**Status vocabularies (backend is source of truth — do NOT invent UI-only values):**
- Alert status: `new | processing | correlated | dismissed` (PATCH `/api/v1/alerts/{id}`, NO `/status` suffix)
- Incident status: `open | investigating | contained | resolved | closed` (PATCH `/api/v1/incidents/{id}/status`)
- Alert severity: `critical | high | medium | low`

**TypeScript checking (IMPORTANT):** run typechecks from `frontend/` with
`tsc --noEmit -p tsconfig.app.json` or just `npm run build` (which runs it).
A bare `tsc --noEmit` compiles nothing because of project config history —
do not trust it as verification.

---

## Testing Workflow

```bash
# All tests
pytest tests/ -v

# Specific module
pytest tests/test_detection.py -v
pytest tests/test_websocket.py -v

# With coverage
pytest tests/ --cov=hawkeye --cov-report=term-missing

# Run single test
pytest tests/test_detection.py::TestBruteForceDetector::test_brute_force_threshold -v
```

**Test Structure:**
- `test_detection.py` — DetectionEngine, all 7 detectors, DetectionContext
- `test_ingestion.py` — IngestionService, NormalizationEngine, schemas
- `test_websocket.py` — ConnectionManager, WebSocket endpoint, stats, auth, reconnection

**IMPORTANT (Windows/SQLite):** run only ONE uvicorn instance. Two servers on
port 8000 hold the SQLite file concurrently and pytest hangs indefinitely
(kill stray python/uvicorn processes if the suite silently never finishes).

---

### Browser / UI Verification

When a task changes the frontend UI or user-facing behavior, verify the running application with the OpenCode browser subagents when appropriate.

- `browser-qa` — functional browser testing: navigation, interactions, forms, console errors, responsive behavior, and broken flows.
- `visual-review` — visual inspection: screenshots, spacing, alignment, typography, hierarchy, responsive layout, and visual consistency.
- Both agents are read-only and must not modify source files.
- Use the project's running frontend dev server as the browser target.
- Do not assume a UI change is correct from source code alone when rendered-browser verification is practical.
- For significant frontend changes, run both `browser-qa` and `visual-review`.
- Report browser verification results alongside the normal test/build results.
- Fix identified issues in the main development session, then re-run the relevant browser checks.

---	

#### Hawk3ye Browser Target

- Frontend directory: `frontend/`
- Dev server command: `npm run dev`
- Default Vite URL: `http://localhost:5173`
- When browser verification is requested, first confirm the frontend dev server is running.
- If Vite reports a different port, use the URL it reports instead of assuming `5173`.
- The main development agent may start the frontend dev server when browser verification is required and it is not already running; browser subagents themselves must not start or stop it.
- Browser agents must not start or stop the dev server unless explicitly instructed.

---

## Documentation Workflow

1. **Implementation complete** → Run tests → Verify pass
2. **Update SESSION.md** with results, next action, handoff
3. **Update TODO.md** — mark task complete, adjust deps
4. **Update CHANGELOG.md** — add entry under current version
5. **Update ROADMAP.md** — only if milestone % changed
6. **Commit changes** with descriptive message

---

## Important Design Decisions

1. **SQLModel over raw SQLAlchemy** — Type-safe models, less boilerplate
2. **FastAPI lifespan for WebSocket manager** — Auto start/stop with app
3. **DetectionContext with time window** — 60-min default for detection, separate from 24hr correlation window
4. **ConnectionManager as singleton** — Import from `hawkeye.api.websocket.connection_manager`
5. **Session-based WebSocket reconnection** — 1hr TTL, 1000 msg history, event_id ordering
6. **Per-source isolation** — Connections only see their source's alerts/incidents
7. **shadcn/ui for frontend** — Accessible, customizable, Tailwind-native components
8. **TanStack Query for server state** — Caching, deduping, background refetch; use `isFetching` (not `isLoading`) for refresh-button spinner/disabled states
9. **Single shared WebSocket connection** — One `WebSocketProvider` in `AppLayout`; never create additional WebSocket connections in pages/components
10. **Search params on backend** — alerts/incidents/sources list endpoints accept a `search` query param for TopNav global search

---

## Session Handoff Process

When ending a session, ensure `SESSION.md` contains:
- Current date, commit hash
- Active task ID and status
- Files modified
- Verification commands run and results
- Next action (specific, actionable)
- Handoff notes explaining what was done and context for continuation

A new session should be able to read `AGENTS.md` + `SESSION.md` and immediately know what to do next.
