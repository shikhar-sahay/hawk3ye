# Hawk3ye User Manual

A practical guide to running and using the Hawk3ye web application security
monitoring platform. This manual describes the software as it is implemented
in this repository today.

---

## Table of Contents

1. [What Hawk3ye Does](#1-what-hawk3ye-does)
2. [Installation and Setup](#2-installation-and-setup)
3. [First Run: Verify, Configure, Ingest, Detect](#3-first-run-verify-configure-ingest-detect)
4. [Dashboard Guide](#4-dashboard-guide)
5. [Detection Lifecycle](#5-detection-lifecycle)
6. [Search Guide](#6-search-guide)
7. [REST API Reference](#7-rest-api-reference)
8. [WebSocket Live Updates](#8-websocket-live-updates)
9. [Configuration](#9-configuration)
10. [Troubleshooting](#10-troubleshooting)
11. [Security Considerations](#11-security-considerations)

---

## 1. What Hawk3ye Does

Hawk3ye is a self-hosted, application-layer SIEM-lite. It watches the security
events your web applications emit and turns them into actionable incidents.

**What it monitors:**

- Authentication activity (failed logins, logins, password resets)
- Account and session activity (role changes, data exports, session reuse)
- API traffic patterns (request rates, endpoint scanning, status codes)
- Client signals (user agents, automation indicators)

**What it consumes:** JSON security events sent to its ingestion API by your
applications, scripts, or (planned) the Hawk3ye browser agent and framework
SDKs.

**What it does with them:**

1. **Ingests** events through `POST /api/v1/events` (single) or
   `POST /api/v1/events/batch` (up to 1,000 per call).
2. **Normalizes** each raw event into a common schema and enriches it with
   MITRE ATT&CK tactic/technique tags based on the event category.
3. **Detects** threats with 7 detection engines:

   | Detector | Detection type | What it catches |
   |----------|----------------|-----------------|
   | BruteForceDetector | `brute_force` | Repeated failed logins for one user |
   | CredentialStuffingDetector | `credential_stuffing` | Many usernames, few IPs (breach replay) |
   | EnumerationDetector | `enumeration` | 404 scans / user enumeration patterns |
   | BotDetector | `bot_detection` | Automation user agents, missing browser headers |
   | SensitiveActionDetector | `sensitive_action` | Privileged actions (role changes, exports) |
   | SessionHijackingDetector | `session_hijacking` | One session used from distant locations |
   | APIAbuseDetector | `api_abuse` | Rate anomalies and API scanning |

4. **Raises alerts** with severity (`critical` / `high` / `medium` / `low`),
   confidence, evidence, and MITRE tags.
5. **Correlates** related alerts within a 24-hour window into **incidents**
   (status: `open` → `investigating` → `contained` → `resolved` → `closed`),
   aggregating MITRE tactics across the grouped alerts.
6. **Broadcasts** every alert, incident, and event over WebSocket so the
   dashboard updates live.

**How users interact:** through the React dashboard (Dashboard, Live Events,
Alerts, Incidents, Sources, Settings) or directly through the REST API.

---

## 2. Installation and Setup

### 2.1 Prerequisites

- Python 3.11+
- Node.js 18+ and npm
- Git

### 2.2 Clone and install the backend

```bash
git clone https://github.com/shikhar-sahay/hawkeye.git
cd hawkeye
pip install -e ".[dev]"
```

### 2.3 Configure the environment (optional)

Defaults work out of the box (SQLite at `./hawkeye.db`). To customize, copy
the example and edit:

```bash
cp .env.example .env
```

Key settings (all optional): `DATABASE_URL` (PostgreSQL for production),
`CORS_ORIGINS`, detection thresholds (e.g. `BRUTE_FORCE_MAX_ATTEMPTS`),
`CORRELATION_TIME_WINDOW_HOURS`. See `hawkeye/config.py` for the full list.

### 2.4 Start the backend

```bash
uvicorn hawkeye.main:app --reload
```

- API: http://localhost:8000
- Health check: http://localhost:8000/health
- Interactive API docs: http://localhost:8000/docs

### 2.5 Start the frontend

```bash
cd frontend
npm install
npm run dev
```

- Dashboard: http://localhost:5173 (the dev server proxies `/api` and `/ws`
  to the backend on port 8000)

### 2.6 (Optional) Seed demo data

```bash
python scripts/seed_demo_data.py
```

This creates five demo sources (Windows Endpoint, Linux Server, Web
Application, API Gateway, Firewall) with 24 hours of realistic events that
trigger all seven detectors. It also fixes the demo source's API key to
`hawk_F5IHr9TsIUujgs_9E_BWsLxmQIA5pYz8aFYcggzHqH0` so the dashboard can log
in with it. Do **not** use this key anywhere real, and never run the seed
script against a production database (it refuses to run with
`ENVIRONMENT=production` unless forced).

### 2.7 Run the tests

```bash
pytest tests/ -v          # backend, 33 tests
cd frontend
npm run lint              # ESLint
npm run build             # TypeScript check + production build
```

---

## 3. First Run: Verify, Configure, Ingest, Detect

This walkthrough takes you from an empty database to your first alert.

**Step 1 — Verify the application.** Open http://localhost:5173. You should
see the landing page; click **Get Started**, or go straight to
http://localhost:5173/login.

**Step 2 — Sign in.** The dashboard authenticates with a **source API key**.
On a fresh database no sources exist yet, so bootstrap is open: register the
first source AND its first API key without credentials (both are open only
until one exists / one key exists):

```bash
curl -X POST http://localhost:8000/api/v1/sources \
  -H "Content-Type: application/json" \
  -d '{"name": "My Web App", "description": "Production app"}'

curl -X POST http://localhost:8000/api/v1/sources/1/api-keys \
  -H "Content-Type: application/json" \
  -d '{"name": "ingest-key"}'
```

The plain key is shown **once** in the `api_key` field of the response.
Paste it into the login page and sign in. (After the first key exists,
creating further sources/keys requires an authenticated request.)

**Step 3 — Send the first event.** From a terminal, using your source's key:

```bash
curl -X POST http://localhost:8000/api/v1/events \
  -H "X-API-Key: <your-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "login_failed",
    "user_id": "alice",
    "ip": "203.0.113.50",
    "route": "/login",
    "method": "POST",
    "status_code": 401,
    "metadata": {"reason": "bad password"}
  }'
```

**Step 4 — Confirm ingestion.** The event appears immediately on the **Live
Events** page (or query the API):

```bash
curl -H "X-API-Key: <your-key>" \
  "http://localhost:8000/api/v1/events/query?limit=5"
```

**Step 5 — Confirm detection.** One failed login will not trigger an alert
(the brute force detector needs several failures in its window). Send the
same event a few more times with different IPs, then check the **Alerts**
page: a `brute_force` alert should appear with severity, confidence,
evidence, and MITRE tags (`TA0006` Credential Access, `T1110` Brute Force).

**Step 6 — Find the resulting incident.** When two or more related alerts
occur within the 24-hour correlation window, the correlation engine groups
them into an incident, visible on the **Incidents** page with aggregated
MITRE tactics and affected users/IPs.

---

## 4. Dashboard Guide

Sign in at `/login` with any valid source API key. The key is stored in your
browser's localStorage under `hawkeye_api_key`; 401/403 responses from the
API return you to the login page automatically.

### Navigation

- **Sidebar** (desktop): Dashboard, Live Events, Alerts, Incidents, Sources,
  Settings. Collapse it with the button at the bottom; the collapsed state is
  remembered.
- **Mobile** (<1024px): the sidebar becomes a drawer opened from the ☰ menu.
- **Top bar:** global search, connection status, theme switcher,
  notification bell, session menu (Profile, Security Settings, Sign Out).

### Dashboard (home)

Overview cards: Total Events, Active Alerts (new + processing + correlated),
Active Incidents, Registered Sources, Detection Rate, Avg Confidence, and
Dismissed Alerts. Charts: **Alerts Over Time** (24h / 7d / 30d toggle),
**Severity Distribution**, **Alerts by Detection Type**, **MITRE ATT&CK
Coverage**, **Events by Source**, and a **Recent Activity** summary. Data
auto-refreshes (interval configurable in Settings) and updates live over
WebSocket.

### Live Events

The normalized event stream. Search box (server-side), a Filters drawer
(category, severity, event type, user, IP, route, method), CSV export of the
currently loaded page, and pagination. Click any row for full event details:
timestamps, actor, target, user agent, MITRE tags, and raw metadata.

### Alerts

Two panes: a **Live Alert Feed** (real-time via WebSocket, newest first) and
an **Alert List** table with severity/type/status columns and pagination.
Filter by severity, status (`new` / `processing` / `correlated` /
`dismissed`), and detection type. Click an alert to open the detail dialog
with tabs:

- **Overview** — description, severity, confidence, MITRE tags, source
- **Evidence** — the raw detection evidence JSON
- **MITRE ATT&CK** — tactics and techniques
- **Actions** — update status: Process, Mark Correlated, Dismiss, Reopen

### Incidents

A timeline of correlated incidents plus a table. Filter by status, severity,
and affected IP. Click an incident for its detail dialog: description,
affected users/IPs, MITRE aggregation, related alerts, and status actions
(Open → Investigating → Contained → Resolved → Closed).

### Sources

Registered applications and their API keys. Create, edit (name, description,
active toggle), and delete sources (deletion permanently removes the source
and all of its events, alerts, incidents, and keys). Expand a source to
manage API keys: create (plain key shown once), copy, and revoke. Search and
pagination are server-side.

### Settings

Four tabs:

- **General** — theme (Light / Deep Blue / Pitch Black), notifications
  toggle, auto-refresh interval, sidebar state, Clear Local Data.
- **API** — current API connection details.
- **WebSocket** — live connection status, URL, reconnect/disconnect
  controls.
- **About** — version and build information.

Save changes with **Save All Settings**.

### Themes and notifications

Three themes ship by default: Light, Deep Blue (dark), and Pitch Black
(OLED). Switch from the top bar or Settings → General; the choice persists
and is applied before first paint (no flash). The notification bell collects
critical/high alerts and incidents received while the dashboard is open;
click an entry to jump to its detail view.

### Connection status

The pill in the top bar shows the WebSocket state (Connected, Connecting,
Reconnecting, Disconnected, Error) with a reconnect button when down. The
Live Events page has a fuller status card with session id and last event id.

---

## 5. Detection Lifecycle

```
Application
    │  POST /api/v1/events  (X-API-Key)
    ▼
IngestionService ──▶ RawEvent (persisted)
    │
    ▼
NormalizationEngine ──▶ NormalizedEvent (common schema + MITRE tags)
    │
    ▼
DetectionEngine (7 detectors, 60-minute analysis window)
    │  threshold crossed?
    ▼
Alert (severity, confidence, evidence, MITRE) ──▶ WebSocket broadcast
    │
    ▼
CorrelationEngine (24-hour window, ≥2 alerts)
    │
    ▼
Incident (aggregated MITRE, affected users/IPs) ──▶ WebSocket broadcast
    │
    ▼
Dashboard (REST + live WebSocket updates)
```

Notes:

- The detection window (60 minutes by default) is separate from the
  correlation window (24 hours by default); both are configurable.
- Alerts start as `new`; the correlation engine marks grouped alerts
  `correlated`. You can move them to `processing` or `dismissed` from the
  Alerts page.
- Every alert carries the evidence the detector used (counts, IPs, scores)
  so you can judge false positives yourself.

---

## 6. Search Guide

The **global search bar** sits in the dashboard top bar (on phones, use the
magnifier icon in the top bar to open the search panel).

**What is searched** (all server-side, in parallel):

| Scope | Matches on |
|-------|-----------|
| Alerts | title, description, detector name, detection type |
| Incidents | title, description, affected IPs, affected users |
| Events | category, event type, user, IP, route, method, user agent |
| Sources | name, description |

**Behavior:**

- Suggestions appear after you type at least 2 characters (debounced
  250 ms; the backend is not hit on every keystroke).
- Matching text is highlighted in the results.
- Up to 12 combined results are shown, labeled by type with severity colors.
- **Loading** spinner while in flight; an explicit **error** message if the
  API is unreachable; a **no results** state otherwise.
- **Keyboard:** ↑/↓ move the selection, **Enter** opens the highlighted
  result (or submits the query to the Live Events page if none is selected),
  **Escape** closes the dropdown.
- Clicking a result deep-links to it: alerts open the alert detail dialog on
  `/alerts?alert=ID`, incidents on `/incidents?incident=ID`, events on
  `/events?event=ID`, and sources highlight the row on `/sources?source=ID`.

**Useful query examples:**

| You type | You get |
|----------|---------|
| `brute` | Brute force alerts and related incidents |
| `login` | Login-related events and alerts |
| `critical` / `high` | Severity-matching alerts and incidents |
| `401` | Events with 401 in searchable fields, matching alerts |
| `203.0.113.10` | Events, alerts, and incidents involving that IP |
| `Web Application` | The source, plus anything referencing it |
| `e2e2_user_1` | Alerts/incidents affecting that user |

Every list page (Events, Alerts, Incidents, Sources) also has its own
server-side search box scoped to that page.

---

## 7. REST API Reference

Base URL: `/api/v1`. All endpoints require the `X-API-Key` header except
`GET /health`, `GET /`, and `POST /sources` while the database has zero
sources (bootstrap).

| Endpoint | Methods | Purpose |
|----------|---------|---------|
| `/api/v1/events` | POST | Ingest a single event |
| `/api/v1/events/batch` | POST | Ingest up to 1,000 events |
| `/api/v1/events/query` | GET | Query events (filters + `search`) |
| `/api/v1/events/{id}` | GET | Event detail |
| `/api/v1/events/{id}/alerts` | GET | Alerts raised from an event |
| `/api/v1/sources` | GET, POST | List (`search`, `is_active`) / create |
| `/api/v1/sources/event-counts` | GET | Per-source event/alert/incident counts |
| `/api/v1/sources/{id}` | GET, PATCH, DELETE | Detail / update / delete (cascades) |
| `/api/v1/sources/{id}/api-keys` | GET, POST | List / create keys |
| `/api/v1/sources/{id}/api-keys/{key_id}` | PATCH, DELETE | Update / revoke key |
| `/api/v1/alerts` | GET | List (`severity`, `status`, `detection_type`, `search`) |
| `/api/v1/alerts/{id}` | GET, PATCH | Detail / status update |
| `/api/v1/alerts/stats` | GET | Aggregate statistics |
| `/api/v1/alerts/time-series?hours=N` | GET | Time-bucketed counts |
| `/api/v1/alerts/mitre-coverage` | GET | MITRE tactic/technique counts |
| `/api/v1/incidents` | GET | List (`status`, `severity`, `search`) |
| `/api/v1/incidents/{id}` | GET | Detail |
| `/api/v1/incidents/{id}/alerts` | GET | Alerts in an incident |
| `/api/v1/incidents/{id}/status` | PATCH | Status update |
| `/api/v1/incidents/stats` | GET | Aggregate statistics |

List endpoints return `{ items, total, limit, offset }` envelopes and accept
`limit` (max 100 for most) and `offset`. Interactive docs: `/docs` on the
backend.

---

## 8. WebSocket Live Updates

Endpoint: `ws://localhost:8000/ws` (the frontend uses `/ws` via its dev
proxy).

**Authentication** (priority order): `Authorization: Bearer <key>` header →
`X-API-Key` header → `?api_key=<key>` query parameter.

**Client messages:** `ping`, `pong`,
`{"type": "subscribe", "data": {"types": ["alerts", "incidents", "events"]}}`,
`unsubscribe`, and
`{"type": "reconnect", "data": {"session_id": "...", "last_event_id": N}}`.

**Server messages:** `connected` (with session id and subscriptions),
`alert`, `incident`, `event`, `ping`/`pong`, `error`.

Behavior: 30-second heartbeat, per-source isolation (you only receive your
source's data), session-based reconnection (1-hour TTL, missed messages
replayed by event id, up to 1,000 kept). The frontend handles all of this
automatically, including exponential-backoff reconnects.

---

## 9. Configuration

All settings are environment variables (see `.env.example` and
`hawkeye/config.py`):

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `sqlite+aiosqlite:///./hawkeye.db` | SQLite dev / PostgreSQL prod |
| `DATABASE_ECHO` | `false` | SQL logging |
| `CORS_ORIGINS` | `["http://localhost:5173", ...]` | Allowed browser origins |
| `BRUTE_FORCE_MAX_ATTEMPTS` | `5` | Failed logins before an alert |
| `BRUTE_FORCE_WINDOW_MINUTES` | `15` | Brute force window |
| `CRED_STUFFING_MAX_USERNAMES` | `10` | Usernames before an alert |
| `ENUMERATION_404_THRESHOLD` | `20` | 404s before an enumeration alert |
| `SESSION_HIJACK_MAX_DISTANCE_KM` | `500` | Impossible-travel distance |
| `API_ABUSE_RPM_THRESHOLD` | `300` | Requests/min before an alert |
| `BOT_DETECTION_CONFIDENCE_THRESHOLD` | `0.7` | Bot score threshold |
| `DETECTION_TIME_WINDOW_MINUTES` | `60` | Detection analysis window |
| `CORRELATION_TIME_WINDOW_HOURS` | `24` | Incident correlation window |
| `CORRELATION_MIN_ALERTS` | `2` | Alerts needed for an incident |

Frontend behavior (theme, notifications, auto-refresh, sidebar state) is
stored in browser localStorage and configured in Settings.

---

## 10. Troubleshooting

**Backend won't start / `health` returns nothing.** Check port 8000 is free
(`netstat -ano | findstr :8000` on Windows). Only run **one** instance:
two uvicorn processes on the same port cause SQLite lock contention and
hanging requests.

**Login says the key is invalid.** The key must belong to an active source.
Verify with `curl -H "X-API-Key: <key>" http://localhost:8000/api/v1/sources?limit=1`.
Keys are hashed at rest; if lost, create a new one from the Sources page.

**WebSocket shows Disconnected or Error.** Confirm the backend is running
and the API key is valid (auth failures stop reconnection deliberately).
Click the reconnect button in the status pill or check Settings → WebSocket.

**No events appearing.** Confirm you POSTed to `/api/v1/events` (not
`/events/query`) with the `X-API-Key` header of an active source, and that
the Live Events page filters are not hiding your data.

**No detections appearing.** Detectors need thresholds to be crossed within
their windows (e.g., 5 failed logins in 15 minutes for brute force). Send
enough events, then check the Alerts page. Use
`python scripts/seed_demo_data.py` to generate data that triggers all 7
detectors.

**Dashboard empty or slow.** If stats never load, check the browser console
and the backend log for errors. The `/sources/event-counts` endpoint is
O(sources); if old test runs polluted your database, clean them with
`python scripts/cleanup_test_sources.py` (dry-run first).

**Frontend can't reach the API.** The dev server proxies `/api` and `/ws`
to port 8000; make sure the backend is up. For direct cross-origin access,
add your origin to `CORS_ORIGINS`.

**Database reset.** Stop the backend, delete `hawkeye.db`, restart (tables
are created automatically), then re-seed if desired.

---

## 11. Security Considerations

- API keys are stored as bcrypt hashes; the plaintext is shown exactly once
  at creation. Revoke and rotate keys from the Sources page.
- All data access is scoped per source; a key only sees its own events,
  alerts, and incidents (including over WebSocket).
- `POST /sources` and the first `POST /sources/{id}/api-keys` are open only
  while zero sources / zero API keys exist (first-run bootstrap); afterwards
  both require authentication.
- Run behind HTTPS in production, use PostgreSQL, set strong
  `API_KEY_SECRET`/`JWT_SECRET` values, and restrict `CORS_ORIGINS` to your
  dashboard origin.
- The dashboard stores the API key in localStorage; treat browser sessions
  accordingly and sign out on shared machines.

---

*Hawk3ye is MIT-licensed. For developer orientation see `AGENTS.md`, the
engineering backlog in `TODO.md`, and the milestone plan in `ROADMAP.md`.*
