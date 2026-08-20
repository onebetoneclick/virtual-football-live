const path = require('path');
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const { leagues } = require('./data/leagues');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/leagues', (_req, res) => {
  res.json(leagues);
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'virtual-football-live' });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcast(message) {
  const payload = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(payload);
  }
}

wss.on('connection', (socket) => {
  socket.send(JSON.stringify({
    type: 'connected',
    message: 'Connected to the virtual football live server'
  }));

  socket.on('message', (raw) => {
    try {
      const message = JSON.parse(raw.toString());
      // The first version only relays safe live-match UI events.
      // Match simulation will be added in the next stage.
      if (message.type === 'match_event') {
        broadcast({ type: 'match_event', data: message.data || {} });
      }
    } catch {
      socket.send(JSON.stringify({ type: 'error', message: 'Invalid JSON message' }));
    }
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Virtual football server listening on port ${PORT}`);
});
