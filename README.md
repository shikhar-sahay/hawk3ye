# Hawk3ye

Web application security monitoring platform (SIEM-lite). Hawk3ye ingests security
events from web applications, normalizes them with MITRE ATT&CK tags, runs 7 detection
engines, correlates alerts into incidents, and exposes everything through REST APIs,
a WebSocket stream, and a real-time React dashboard.

## Current Status

| Milestone | Status | Achieved |
|-----------|--------|----------|
| 1 — Backend MVP (APIs, detectors, correlation, auth) | ✅ Complete | 2026-07-24 |
| 2 — Real-time Dashboard Backend (WebSocket) | ✅ Complete | 2026-07-24 |
| 3 — Frontend Dashboard (React + TypeScript + Vite) | ✅ Complete | 2026-08-02 |
| 3.5 — Dashboard Polish + Functionality | ✅ Complete | 2026-08-24 |
| 4 — Browser Security Agent (Chrome MV3) | 🟢 In progress (scaffold) | — |
| 5 — SDK Integrations (Flask / FastAPI / Express) | ⏳ Planned | — |
| 6 — Attack Replay & Docs, packaging, Docker/K8s | ⏳ Planned | — |

Verified baseline: backend tests 33/33 passing; frontend build, lint, and TypeScript
checks passing; all SPA routes and the `/api` + `/ws` dev proxy verified against a
running backend.

**User documentation:** see [docs/USER_MANUAL.md](docs/USER_MANUAL.md) for a
complete setup walkthrough, dashboard guide, search guide, and troubleshooting.

## Architecture

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

## What Hawk3ye Does

- Ingests raw security events from applications (single + batch endpoints).
- Normalizes events and enriches them with MITRE ATT&CK data.
- Runs 7 detection engines: brute force, credential stuffing, enumeration, bot
  activity, sensitive actions, session hijacking, API abuse.
- Correlates alerts into incidents with MITRE aggregation.
- Broadcasts alerts, incidents, and events over WebSocket.
- Provides REST APIs for sources, events, alerts, incidents, ingestion, and API keys.

## Repository Layout

```
Hawkeye/
├── hawkeye/                  # FastAPI backend package
│   ├── main.py               # App entry, lifespan, CORS, health
│   ├── config.py             # Pydantic Settings (env-configurable)
│   ├── database.py           # Async SQLModel engine/session
│   ├── core/                 # Auth + normalization (MITRE mapping)
│   ├── models/               # SQLModel tables + enums
│   ├── schemas/              # Request/response models
│   ├── api/
│   │   ├── deps.py           # Auth + session dependencies
│   │   ├── websocket.py      # /ws endpoint + ConnectionManager singleton
│   │   └── v1/               # REST: ingestion, events, sources, alerts, incidents
│   └── services/
│       ├── ingestion_service.py
│       ├── detection/        # DetectionEngine + 7 detectors
│       └── correlation/      # CorrelationEngine (time-window grouping)
├── frontend/                 # React + TypeScript + Vite dashboard
│   └── src/
│       ├── api/client.ts     # TanStack Query API client
│       ├── context/WebSocketContext.tsx  # Single shared WebSocket connection
│       ├── components/       # ui/, layout/, charts/, pages support components
│       ├── pages/            # Dashboard, Events, Alerts, Incidents, Sources, Settings
│       └── types/index.ts    # Types matching backend schemas
├── browser-agent/            # Chrome MV3 extension scaffold (flat layout)
├── scripts/                  # seed_demo_data.py, cleanup_test_sources.py
├── docs/USER_MANUAL.md       # End-user manual (setup, dashboard, search, troubleshooting)
├── tests/                    # Pytest suite (33 tests)
├── legacy-v1/                # Archived Flask v1 — reference only, do not modify
├── alembic/                  # Empty migration scaffold (Milestone 6)
├── AGENTS.md                 # Developer handbook (primary orientation document)
├── SESSION.md                # Current active engineering task
├── TODO.md                   # Engineering backlog
├── ROADMAP.md                # Milestone details and progress
└── CHANGELOG.md              # Completed work history
```

## Getting Started

### Backend

```bash
pip install -e ".[dev]"
uvicorn hawkeye.main:app --reload     # http://localhost:8000 (docs at /docs)
pytest tests/ -v                      # 33 tests
```

SQLite is used by default (`hawkeye.db`, gitignored); PostgreSQL via `DATABASE_URL`
for production. All settings are environment variables — see `hawkeye/config.py`
and `.env.example`. Useful scripts:

```bash
python scripts/seed_demo_data.py         # populate demo sources + 24h of events
python scripts/cleanup_test_sources.py   # remove empty QA/test sources (dry-run: --dry-run)
```

### Frontend

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173, proxies /api and /ws to :8000
npm run build    # tsc --noEmit && vite build
npm run lint
```

The frontend expects the backend on port 8000. Sign in on the `/login` page with
any valid source API key (stored in `localStorage` under `hawkeye_api_key`).
Use `python ../scripts/seed_demo_data.py` to populate demo data; the demo key
lives only in that script.

## API Summary

All endpoints require the `X-API-Key` header except `/health`, `/`, and the first-run bootstrap (`POST /sources` and the first `POST /sources/{id}/api-keys` are open only while zero sources / zero API keys exist).

| Endpoint | Methods | Purpose |
|----------|---------|---------|
| `/api/v1/events` | POST | Ingest single event |
| `/api/v1/events/batch` | POST | Ingest batch of events |
| `/api/v1/events/query` | GET | Query normalized events (filterable, searchable) |
| `/api/v1/sources` | GET, POST | List/create sources (searchable) |
| `/api/v1/sources/{id}` | GET, PATCH, DELETE | Source CRUD |
| `/api/v1/sources/{id}/api-keys` | GET, POST | List/create API keys |
| `/api/v1/alerts` | GET | List alerts (filterable, searchable) |
| `/api/v1/alerts/stats` | GET | Aggregate alert statistics |
| `/api/v1/alerts/time-series?hours=N` | GET | Time-bucketed alert counts |
| `/api/v1/alerts/mitre-coverage` | GET | MITRE tactic/technique coverage |
| `/api/v1/alerts/{id}` | GET, PATCH | Alert detail / status update |
| `/api/v1/incidents` | GET | List incidents (filterable, searchable) |
| `/api/v1/incidents/stats` | GET | Aggregate incident statistics |
| `/api/v1/incidents/{id}` | GET, PATCH | Incident detail / status update |
| `/ws` | WebSocket | Live alerts/incidents/events |

WebSocket auth priority: `Authorization: Bearer <key>` header → `X-API-Key` header →
`?api_key=<key>` query param. Session-based reconnection supported via
`{"type": "reconnect", "data": {"session_id": "...", "last_event_id": N}}`.

## Frontend Notes

- **Single shared WebSocket:** one `WebSocketProvider` lives in `AppLayout`;
  TopNav, Events, Alerts, and Incidents consume it via `WebSocketContext`.
  Do not create additional WebSocket connections in pages or components.
- **Refresh buttons** use TanStack Query's `isFetching` (not `isLoading`) so they
  correctly show spinner/disabled state during refetches.
- **Global search** in TopNav queries events/alerts/incidents/sources in parallel
  using backend `search` query params (250 ms debounce, stale-response guard),
  with match highlighting, loading/error/empty states, keyboard navigation,
  and a dedicated mobile search panel below the `sm` breakpoint.
- **Notification bell** shows high-severity (critical/high) alerts and incidents
  received over the shared WebSocket.
- **Responsive layout:** the header spans the full main area and tracks the
  sidebar state; tables scroll inside their own card containers so the page
  itself never overflows horizontally; dialogs are viewport-constrained and
  scroll internally.

## Deployment

The v2 application deploys as a **split frontend/backend**:

- **Frontend (React SPA)** → **Vercel** (`frontend/vercel.json`; set the
  project's Root Directory to `frontend`). Configure `VITE_API_BASE_URL` and
  `VITE_WS_URL` to point at the backend origin.
- **Backend (FastAPI + WebSocket)** → a persistent single-instance runtime,
  e.g. **Render** (`render.yaml` blueprint) or any container host
  (`Dockerfile`). It cannot run on Vercel serverless: `/ws` is a long-lived
  WebSocket and connection/session state is in-process (single worker
  required).
- **Database** → PostgreSQL in production via `DATABASE_URL`
  (`postgresql+asyncpg://...`); SQLite remains the zero-config dev default.

The legacy Flask v1 app (`legacy-v1/`, formerly deployed as
`hawkeye-i1bt.onrender.com`) is archived: see `legacy-v1/README.md` and the
`legacy-v1-flask` git tag. Full audit, environment variables, and the
step-by-step migration/cutover procedure: **[docs/deployment.md](docs/deployment.md)**.

## Development Workflow

1. Read `AGENTS.md` (handbook) and `SESSION.md` (current task).
2. Work one task at a time from `TODO.md`.
3. Verify: `pytest tests/ -v`, frontend `npm run build` + `npm run lint`.
4. Update docs (`SESSION.md` → `TODO.md` → `CHANGELOG.md` → `ROADMAP.md`) when work lands.
5. Commit changes in small, logical groups.

## License

MIT — see [LICENSE](LICENSE).
