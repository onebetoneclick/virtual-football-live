const { WebSocketServer } = require('ws');

/**
 * Dedicated live WebSocket service.
 *
 * The HTTP/API server should not contain match-broadcast logic.
 * This module owns WebSocket connections and live-match state delivery.
 */
function createLiveWebSocketServer(server, options = {}) {
  const path = options.path || '/ws/live';
  const wss = new WebSocketServer({ server, path });

  const state = {
    status: 'not_started',
    period: 'first_half',
    clock: 0,
    duration: 180,
    score: { home: 0, away: 0 },
    ball: { x: 50, y: 50 },
    commentary: []
  };

  function broadcast(message) {
    const payload = JSON.stringify(message);
    for (const client of wss.clients) {
      if (client.readyState === 1) client.send(payload);
    }
  }

  function publishState() {
    broadcast({ type: 'live_state', data: state });
  }

  wss.on('connection', (socket) => {
    socket.send(JSON.stringify({
      type: 'connected',
      service: 'live-match-websocket',
      data: state
    }));

    socket.on('message', (raw) => {
      try {
        const message = JSON.parse(raw.toString());

        // Only the server/match engine should publish official match state.
        // Client messages are limited to requesting the current state for now.
        if (message.type === 'get_state') {
          socket.send(JSON.stringify({ type: 'live_state', data: state }));
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
    state,
    broadcast,
    publishState
  };
}

module.exports = { createLiveWebSocketServer };
