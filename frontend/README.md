# Hawk3ye Frontend

React + TypeScript + Vite dashboard for Hawk3ye. See the root README for
what the app does and where it is deployed.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173, proxies /api and /ws to :8000
npm run build    # TypeScript check + production build
npm run lint
```

## Configure

- `VITE_API_BASE_URL`: backend REST origin (default same-origin).
- `VITE_WS_URL`: backend WebSocket origin (default same-origin).
- Set both to the backend origin when deploying apart from it (see
  `.env.production.example` and `docs/deployment.md`). Never put secrets
  under `VITE_*`; the dashboard signs in with a source API key at `/login`.

## Notes

- One shared WebSocket connection (`WebSocketContext`, mounted in
  `AppLayout`); pages consume it and never open their own sockets.
- The sign-in key is stored in browser localStorage under
  `hawkeye_api_key`.
