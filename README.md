# Virtual Football Live

A real-time virtual football platform built with Node.js, Express, and WebSockets.

## Project goal

The project will provide two main experiences:

1. **Match discovery page** — leagues, clubs, available virtual matches, statistics, and match information.
2. **Live match page** — a live virtual football pitch, match clock, score, ball tracking, match tracker, and live commentary.

## Architecture

```text
Browser
   │
   ├── HTTP → Express API
   │            └── League / club data
   │
   └── WebSocket → /ws/live
                    └── Live match state
                         ├── clock
                         ├── score
                         ├── ball position
                         ├── match period
                         └── commentary
```

## WebSocket separation

The live WebSocket service is intentionally kept in its own module:

`websocket/live-server.js`

`server.js` is responsible for the HTTP/API server and connects the dedicated WebSocket service. Keeping these responsibilities separate makes the project easier to maintain and reduces the chance of mixing API logic with live-match logic.

## Match format

The virtual match is designed around a **3-minute match**:

- First half: 1 minute 30 seconds
- Half-time: short transition
- Second half: 1 minute 30 seconds
- Full time: 3 minutes

The server is authoritative for the live state so connected viewers receive the same match state.

## Current endpoints

- `GET /api/health` — server health check
- `GET /api/leagues` — available league and club data
- `WS /ws/live` — live match WebSocket

## Development

```bash
npm install
npm start
```

The server uses Render's `PORT` environment variable when deployed, with port `10000` as the local fallback.

## Important

Keep API keys and other secrets in environment variables. Never commit real credentials to GitHub.
