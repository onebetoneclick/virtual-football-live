const { WebSocketServer } = require('ws');
const MatchEngine = require('../match/match-engine');

/**
 * Dedicated live WebSocket service.
 * Handles connections and broadcasts match-engine updates.
 */
function createLiveWebSocketServer(server, options = {}) {
  const path = options.path || '/ws/live';
  const wss = new WebSocketServer({ server, path });

  const matchEngine = new MatchEngine();

  function broadcast(message) {
    const payload = JSON.stringify(message);

    for (const client of wss.clients) {
      if (client.readyState === 1) {
        client.send(payload);
      }
    }
  }

  let broadcastTimer = null;

  function startBroadcastLoop() {
    if (broadcastTimer) return;

    broadcastTimer = setInterval(() => {
      broadcast({
        type: 'live_state',
        data: matchEngine.getState()
      });

      if (matchEngine.getState().status === 'finished') {
        clearInterval(broadcastTimer);
        broadcastTimer = null;
      }
    }, 1000);
  }

  wss.on('connection', (socket) => {
    socket.send(JSON.stringify({
      type: 'connected',
      service: 'live-match-websocket',
      data: matchEngine.getState()
    }));

    socket.on('message', (raw) => {
      try {
        const message = JSON.parse(raw.toString());

        if (message.type === 'get_state') {
          socket.send(JSON.stringify({
            type: 'live_state',
            data: matchEngine.getState()
          }));
        }

        if (message.type === 'start_match') {
          matchEngine.start();
          startBroadcastLoop();

          socket.send(JSON.stringify({
            type: 'live_state',
            data: matchEngine.getState()
          }));
        }
      } catch {
        socket.send(JSON.stringify({
          type: 'error',
          message: 'Invalid JSON message'
        }));
      }
    });
  });

  return {
    wss,
    matchEngine
  };
}

module.exports = { createLiveWebSocketServer };
