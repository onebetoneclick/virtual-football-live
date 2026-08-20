const path = require('path');
const http = require('http');
const express = require('express');
const { createLiveWebSocketServer } = require('./websocket/live-server');
const { leagues } = require('./data/leagues');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/leagues', (_req, res) => res.json(leagues));
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'virtual-football-live' }));

const server = http.createServer(app);

// Keep the live WebSocket service separate from the HTTP/API layer.
createLiveWebSocketServer(server, { path: '/ws/live' });

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Virtual football server listening on port ${PORT}`);
});
