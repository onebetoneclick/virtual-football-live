const path = require('path');
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const { leagues } = require('./data/leagues');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/leagues', (_req, res) => res.json(leagues));
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'virtual-football-live' }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const MATCH_LENGTH_SECONDS = 180;
const HALF_TIME_SECONDS = 10;

const match = {
  id: 'demo-001',
  status: 'first-half',
  clock: 0,
  home: { id: 'arsenal', name: 'Arsenal', score: 0 },
  away: { id: 'chelsea', name: 'Chelsea', score: 0 },
  ball: { x: 50, y: 50 },
  lastEvent: null,
  commentary: []
};

function getPeriod(clock) {
  if (clock < 90) return 'first-half';
  if (clock < 100) return 'half-time';
  if (clock < 180) return 'second-half';
  return 'full-time';
}

function publicState() {
  return {
    type: 'match_state',
    data: {
      ...match,
      period: getPeriod(match.clock),
      clock: Math.min(match.clock, MATCH_LENGTH_SECONDS)
    }
  };
}

function broadcast(message) {
  const payload = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(payload);
  }
}

function addCommentary(text, minute) {
  match.lastEvent = text;
  match.commentary.unshift({ minute, text, timestamp: Date.now() });
  match.commentary = match.commentary.slice(0, 20);
}

function simulateBall() {
  match.ball.x = Math.max(4, Math.min(96, match.ball.x + (Math.random() - 0.5) * 9));
  match.ball.y = Math.max(6, Math.min(94, match.ball.y + (Math.random() - 0.5) * 9));
}

function simulateEvent() {
  const minute = Math.floor(match.clock / 2);
  const roll = Math.random();

  if (roll < 0.012 && match.clock < 175) {
    const homeScores = Math.random() > 0.5;
    const team = homeScores ? match.home : match.away;
    team.score += 1;
    addCommentary(`GOAL! ${team.name} scores`, minute);
  } else if (roll < 0.045) {
    addCommentary(`${match.ball.x > 50 ? match.away.name : match.home.name} attack`, minute);
  } else if (roll < 0.07) {
    addCommentary('Shot on target', minute);
  }
}

wss.on('connection', (socket) => {
  socket.send(JSON.stringify({
    type: 'connected',
    message: 'Connected to the virtual football live server'
  }));
  socket.send(JSON.stringify(publicState()));

  socket.on('message', (raw) => {
    try {
      const message = JSON.parse(raw.toString());
      if (message.type === 'request_state') socket.send(JSON.stringify(publicState()));
    } catch {
      socket.send(JSON.stringify({ type: 'error', message: 'Invalid JSON message' }));
    }
  });
});

setInterval(() => {
  if (match.clock >= MATCH_LENGTH_SECONDS) {
    if (match.status !== 'full-time') {
      match.status = 'full-time';
      addCommentary('FULL TIME', 90);
      broadcast(publicState());
    }
    return;
  }

  match.clock += 1;
  match.status = getPeriod(match.clock);

  if (match.clock === 90) addCommentary('HALF TIME', 45);
  if (match.clock === 100) addCommentary('SECOND HALF KICK-OFF', 45);

  if (match.status !== 'half-time') {
    simulateBall();
    simulateEvent();
  }

  broadcast(publicState());
}, 1000);

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Virtual football server listening on port ${PORT}`);
});
