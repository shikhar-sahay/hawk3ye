# Hawk3ye

Hawk3ye is a web application security monitoring platform (SIEM-lite). Your
applications send it JSON security events; it normalizes them with MITRE
ATT&CK tags, runs 7 detection engines, correlates related alerts into
incidents, and shows everything on a real-time React dashboard fed by
WebSocket.

## Live deployment

The deployed app is split across three services:

- Frontend (React + Vite SPA): `https://hawk3ye.vercel.app`
- Backend (FastAPI): `https://hawkeye-api-f01y.onrender.com`
- Database: Neon PostgreSQL (SQLite is only the local dev default)

Open the frontend URL and sign in on the `/login` page with a source API key
(see Authentication below). If the backend has been idle, you will see a
"Hawk3ye is waking up" screen while Render cold-starts it.
The dashboard loads on its own once the backend answers health checks, and
the WebSocket connects automatically. Nothing needs a manual refresh.

## How it works

Every event travels the same pipeline:

1. **Ingest.** Your app POSTs a JSON event to `/api/v1/events` (single) or
   `/api/v1/events/batch` (up to 1,000 per call), authenticated with a source
   API key.
2. **Normalize.** The event is stored and mapped to a common schema, enriched
   with MITRE ATT&CK tactic and technique tags based on its category.
3. **Detect.** 7 detection engines score the event against recent history
   (brute force, credential stuffing, enumeration, bot activity, sensitive
   actions, session hijacking, API abuse). A triggered rule raises an alert
   with severity (`critical` / `high` / `medium` / `low`), confidence,
   evidence, and MITRE tags.
4. **Correlate.** Related alerts inside the 24-hour correlation window are
   grouped into an incident with aggregated MITRE tactics and affected
   users/IPs.
5. **Broadcast.** Each new event, alert, and incident is pushed over
   WebSocket, so the dashboard updates live without polling.

The typical user flow:

```text
Open Hawk3ye
  -> sign in with a source API key (/login)
  -> open the dashboard (/dashboard)
  -> register the monitored app as a source (/sources)
  -> send security events to the ingestion API
  -> watch events arrive live (/events)
  -> detection raises alerts (/alerts)
  -> related alerts form an incident (/incidents)
  -> investigate from the alert/incident detail views
```

## Authentication

There are no user accounts. Each monitored application is registered as a
**source**, and each source has its own **API keys**. A key is both the
ingestion credential (sent as the `X-API-Key` header) and the dashboard
login. The login page checks the key against the API; the key is then kept in
browser localStorage (`hawkeye_api_key`) until you sign out. A key only ever
sees its own source's events, alerts, and incidents, including over
WebSocket.

On a fresh instance with an empty database, registration is open so you can
bootstrap the first credential (see Local development below). Once the first
source and key exist, creating further sources and keys requires an already
valid key.

## Trying it against the deployed backend

You need a source API key from whoever operates the instance. With the key in
hand:

1. Open `https://hawk3ye.vercel.app/login` and paste the key to sign in.
2. Send a test event to the backend:

```bash
curl -X POST https://hawkeye-api-f01y.onrender.com/api/v1/events \
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

3. Open the **Live Events** page: the event appears immediately.
4. To trigger a detection, repeat the same failed login a few times (the
   brute-force rule fires on repeated failures inside its window). A
   `brute_force` alert with severity, confidence, evidence, and MITRE tags
   (`TA0006` Credential Access, `T1110` Brute Force) streams into the
   **Alerts** page live. When related alerts accumulate, they are grouped
   into an incident on the **Incidents** page.

## Dashboard pages

- **Dashboard** (`/dashboard`): KPI cards (events, active alerts/incidents,
  sources, detection rate) plus charts for alerts over time (24h/7d/30d),
  severity distribution, detection types, MITRE coverage, and events by
  source. Auto-refreshes and updates live.
- **Live Events** (`/events`): the normalized event stream with server-side
  search, filters (category, severity, type, user, IP, route, method), CSV
  export, pagination, and per-row detail. New events arrive over WebSocket.
- **Alerts** (`/alerts`): live alert feed plus a filterable table (severity,
  status, detection type). Clicking an alert opens detail tabs (Overview,
  Evidence, MITRE, Actions) where you set status (`new`, `processing`,
  `correlated`, `dismissed`).
- **Incidents** (`/incidents`): correlated incidents as a timeline plus a
  table, with detail views showing affected users/IPs, aggregated MITRE
  data, member alerts, and status workflow (`open` to `closed`).
- **Sources** (`/sources`): register applications, edit or delete them, and
  manage their API keys (create, copy once, revoke). Deleting a source
  removes all of its data.
- **Settings** (`/settings`): theme (Light / Deep Blue / Pitch Black),
  notifications, auto-refresh interval, API connection details, WebSocket
  status and reconnect controls, about info.

The top bar adds global search across events, alerts, incidents, and sources
(with keyboard navigation and deep links into each detail view), a live
connection-status pill, a notification bell for critical/high alerts and
incidents, and the session menu (Profile, Security Settings, Sign Out).

## Detection engines

| Engine | Catches |
|--------|---------|
| Brute force | Repeated failed logins against one user |
| Credential stuffing | Many usernames tried from one IP (breach replay) |
| Enumeration | 404 scans and user-enumeration patterns |
| Bot detection | Automation user agents, missing browser headers |
| Sensitive actions | Privileged actions such as role changes and exports |
| Session hijacking | One session used from distant locations |
| API abuse | Request-rate anomalies and endpoint scanning |

Each detector has its own threshold and time window, configurable through
environment variables (see `.env.example` and `hawkeye/config.py`). Every
alert keeps the evidence the detector used, so you can judge for yourself
whether it is a true positive.

## API summary

All endpoints take the `X-API-Key` header, except `/health`, `/`, and the
first-run bootstrap described above.

| Endpoint | Purpose |
|----------|---------|
| `POST /api/v1/events` | Ingest a single event |
| `POST /api/v1/events/batch` | Ingest up to 1,000 events |
| `GET /api/v1/events/query` | Query events (filters, search) |
| `GET /api/v1/sources` | List sources |
| `POST /api/v1/sources` | Register a source |
| `GET/PATCH/DELETE /api/v1/sources/{id}` | Source detail, update, delete |
| `GET/POST /api/v1/sources/{id}/api-keys` | List or create API keys |
| `GET /api/v1/alerts`, `GET /api/v1/alerts/{id}` | List and inspect alerts |
| `GET /api/v1/alerts/stats`, `/time-series`, `/mitre-coverage` | Alert analytics |
| `GET /api/v1/incidents`, `GET /api/v1/incidents/{id}` | List and inspect incidents |
| `GET /api/v1/incidents/stats` | Incident analytics |
| `/ws` | WebSocket: live events, alerts, incidents |

WebSocket auth, in priority order: `Authorization: Bearer <key>` header,
`X-API-Key` header, `?api_key=<key>` query param (browsers use the query
param and connect over WSS). Session-based reconnection replays missed
messages. Full field-level reference: [docs/USER_MANUAL.md](docs/USER_MANUAL.md#7-rest-api-reference).

## Local development

Requirements: Python 3.11+, Node.js 18+ and npm.

```bash
pip install -e ".[dev]"
uvicorn hawkeye.main:app --reload     # API on http://localhost:8000 (/docs for the OpenAPI UI)
pytest tests/ -v

cd frontend
npm install
npm run dev      # dashboard on http://localhost:5173, proxies /api and /ws to :8000
npm run build    # TypeScript check + production build
npm run lint
```

SQLite (`hawkeye.db`) works with zero configuration; point `DATABASE_URL` at
PostgreSQL for a production-like setup (see `.env.example` and
`hawkeye/config.py`). On a fresh database, bootstrap the first credential
with no key (both calls are open only until the first source / first key
exists):

```bash
curl -X POST http://localhost:8000/api/v1/sources \
  -H "Content-Type: application/json" \
  -d '{"name": "My Web App", "description": "Local dev"}'

curl -X POST http://localhost:8000/api/v1/sources/1/api-keys \
  -H "Content-Type: application/json" -d '{"name": "dev-key"}'
```

The plain key is shown once. Paste it at `/login` and send events as shown
above against `http://localhost:8000`. To fill an empty dashboard quickly:

```bash
python scripts/seed_demo_data.py         # demo sources + 24h of events (dev only)
python scripts/cleanup_test_sources.py   # remove empty QA sources (--dry-run supported)
```

Never run the seed script against production: it installs a publicly known
demo key and junk data (it refuses with `ENVIRONMENT=production` unless
forced). Run only one backend instance locally: two processes on the same
SQLite file cause lock contention.

## Architecture

```text
Web apps (or curl/scripts)
  -> FastAPI backend: ingestion -> normalization (+MITRE) -> detection (7x) -> correlation
  -> PostgreSQL (SQLModel, asyncpg in production)
  -> REST (/api/v1) + WebSocket (/ws) -> React dashboard (Vercel)
```

The backend must run as a single worker: WebSocket connections, sessions,
and broadcast fan-out live in process memory, so horizontal scaling needs a
Redis-backed connection manager first (a known future step, not built yet).
It also cannot run on serverless: `/ws` is a long-lived connection.

Full infrastructure detail, environment variables, and the verification
checklist: [docs/deployment.md](docs/deployment.md). End-user walkthrough,
dashboard guide, search, and troubleshooting:
[docs/USER_MANUAL.md](docs/USER_MANUAL.md).

The old Flask v1 prototype (`legacy-v1/`) is archived for reference only;
see `legacy-v1/README.md` and the `legacy-v1-flask` tag.

## Limitations

- The Render backend sleeps after idle and cold-starts on the next request;
  the frontend covers this with its waking screen and connects automatically
  once the backend is healthy.
- One backend worker only: do not scale horizontally until WebSocket state
  moves out of process.
- API keys are per-source by design: there is no cross-source view and no
  user/role management.
- The Chrome extension (browser agent) and framework SDKs are planned work,
  not available yet. Application events are sent through the REST API.

## License

MIT License, see [LICENSE](LICENSE).
