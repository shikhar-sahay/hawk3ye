# Hawk3ye v2 - Session Documentation

## Session Metadata
- **Date**: 2026-09-05
- **Session ID**: 2026-09-05-01 (Security + production readiness + migration prep)
- **Branch**: master (all work committed and pushed)

---

## Current Active Engineering Task

### Task ID: SEC-RELEASE-01 — Security hardening and production release verification
### Status: **COMPLETE - plus P0 WS live-delivery fix found during PG verification**

**Additional work this session (see CHANGELOG [Unreleased]):**
- While verifying WebSockets against real PostgreSQL 16, discovered live
  event broadcasts NEVER worked: singular/plural subscription mismatch plus
  `AttributeError: created_at` swallowed by bare `except: pass`.
- Fixed (`subscription_type` param, `created_at` from `timestamp`, loud
  logging), 4 regression tests, 47/47 suite green.
- Proven live on PG16 and through the dashboard UI (Events page updates with
  zero refresh and zero console errors); alert+incident live fan-out proven
  with a 6-failure brute-force burst.

**What was done:**
1. Phase 0: clean baseline confirmed (HEAD == origin/master, tag intact).
2. Phase 1: full code-level security audit - route-by-route auth, IDOR,
   schemas, WS, CORS, secrets, frontend, deps, error handling.
3. Phase 3: fixed P0 source-management IDOR (`require_source_ownership` +
   first-key onboarding carve-out; 4 regression tests), P1 expiry
   enforcement on REST + WS (3 tests), P1 ingestion 500 sanitization.
4. Docs: deployment.md hardened (Starter plan, schema strategy, bootstrap
   lockdown check, ownership model, WS transport decisions, extended
   checklist); USER_MANUAL seed warning strengthened.
5. Phase 7: 43/43 tests, tsc/lint/build clean, preview + SPA fallback,
   login/dashboard/search live, ownership 404 degrades gracefully in UI.

**Verification:** see task list and final report. Backend :8000 (fresh code)
and frontend :5173 running. Full suite must run with no stray
python/uvicorn processes (kill leftovers first - SQLite contention hangs).

### Next Action
Production deployment is verified live (frontend on Vercel, backend on
Render, Neon PostgreSQL) and `master` matches the deployment line. Next:
Milestone 4, T-040 browser agent scaffold.

---

## Notes for next agent
- Demo key `hawk_F5I...` lives ONLY in `scripts/seed_demo_data.py` - it is
  publicly known; NEVER seed production (now guarded by ENVIRONMENT check).
- `legacy-v1-flask` tag intact; `legacy-v1/` untouched; old Render service
  untouched.
- Frontend split-deployment env: `VITE_API_BASE_URL`, `VITE_WS_URL` (empty =
  same-origin). No secrets under `VITE_*`.
- Ownership model: a key manages only its own source (+ first key of a
  keyless source). Dashboard shows error toasts for other sources.
- SCALE-WS-01 (TODO.md): single instance/worker by design until Redis lands.

