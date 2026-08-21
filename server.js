const path = require('path');
const http = require('http');
const express = require('express');
const { createLiveWebSocketServer } = require('./websocket/live-server');
const { leagues } = require('./data/leagues');
const { clubs, clubsById, slug } = require('./data/clubs');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/leagues', (_req, res) => res.json(leagues));

app.get('/api/clubs', (req, res) => {
  const leagueId = req.query.league;
  const result = leagueId ? clubs.filter(club => club.leagueId === leagueId) : clubs;
  res.json(result);
});

app.get('/api/clubs/:clubId', (req, res) => {
  const club = clubsById[req.params.clubId];
  if (!club) return res.status(404).json({ error: 'Club not found' });
  res.json(club);
});

// Lightweight generated badge endpoint. It keeps the API self-contained while
// the project is using virtual/simulation club branding. Licensed artwork can
// replace these badges later without changing the API contract.
app.get('/api/clubs/:clubName/logo', (req, res) => {
  const club = clubs.find(item => slug(item.name) === req.params.clubName);
  const label = club ? club.shortName : 'FC';
  const hue = Math.abs([...label].reduce((sum, char) => sum + char.charCodeAt(0), 0)) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="hsl(${hue},75%,42%)"/><stop offset="1" stop-color="hsl(${(hue + 45) % 360},75%,30%)"/></linearGradient></defs><circle cx="64" cy="64" r="60" fill="url(#g)" stroke="white" stroke-width="5"/><text x="64" y="76" text-anchor="middle" font-family="Arial,sans-serif" font-size="32" font-weight="700" fill="white">${label}</text></svg>`;
  res.type('image/svg+xml').send(svg);
});

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'virtual-football-live' }));

const server = http.createServer(app);

// Keep the live WebSocket service separate from the HTTP/API layer.
createLiveWebSocketServer(server, { path: '/ws/live' });

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Virtual football server listening on port ${PORT}`);
});
