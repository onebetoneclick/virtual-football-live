const { WebSocketServer } = require('ws');
const { SeasonEngine } = require('../competition/season-engine');

function createLiveWebSocketServer(server, options = {}) {
  const path = options.path || '/ws/live';
  const wss = new WebSocketServer({ server, path });
  const season = new SeasonEngine({ leagueId: options.leagueId || 'england', week: 1 });
  let broadcastTimer = null;

  function broadcast(message) {
    const payload = JSON.stringify(message);
    for (const client of wss.clients) {
      if (client.readyState === 1) client.send(payload);
    }
  }

  function startBroadcastLoop() {
    if (broadcastTimer) return;
    broadcastTimer = setInterval(() => {
      const selected = season.selectedState(0);
      broadcast({ type: 'week_state', data: season.weekState() });
      if (selected) broadcast({ type: 'live_state', data: selected });

      if (season.status === 'week_complete') {
        clearInterval(broadcastTimer);
        broadcastTimer = null;
        broadcast({ type: 'week_complete', data: season.weekState() });
      }
    }, 1000);
  }

  function sendInitial(socket) {
    socket.send(JSON.stringify({
      type: 'connected',
      service: 'live-match-websocket',
      data: season.selectedState(0) || {
        status: 'not_started', period: 'first_half', clock: 0,
        displayClock: '00:00', score: { home: 0, away: 0 }
      }
    }));
    socket.send(JSON.stringify({ type: 'week_state', data: season.weekState() }));
  }

  wss.on('connection', socket => {
    sendInitial(socket);

    socket.on('message', raw => {
      try {
        const message = JSON.parse(raw.toString());

        if (message.type === 'get_state') {
          const selected = season.selectedState(Number(message.matchIndex || 0));
          if (selected) socket.send(JSON.stringify({ type: 'live_state', data: selected }));
          socket.send(JSON.stringify({ type: 'week_state', data: season.weekState() }));
        }

        if (message.type === 'start_match' || message.type === 'start_week') {
          season.startWeek(Number(message.week || season.week));
          startBroadcastLoop();
          const selected = season.selectedState(0);
          if (selected) socket.send(JSON.stringify({ type: 'live_state', data: selected }));
          socket.send(JSON.stringify({ type: 'week_state', data: season.weekState() }));
        }

        if (message.type === 'select_match') {
          const selected = season.selectedState(Number(message.index || 0));
          if (selected) socket.send(JSON.stringify({ type: 'live_state', data: selected }));
        }

        if (message.type === 'next_week') {
          const next = season.week + 1;
          if (next <= season.fixtures.length && season.status === 'week_complete') {
            season.startWeek(next);
            startBroadcastLoop();
          }
        }
      } catch {
        socket.send(JSON.stringify({ type: 'error', message: 'Invalid JSON message' }));
      }
    });
  });

  return { wss, season };
}

module.exports = { createLiveWebSocketServer };
