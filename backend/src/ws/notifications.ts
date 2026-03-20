import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

interface ConnectedClient {
  ws: WebSocket;
  address: string;
}

const clients: ConnectedClient[] = [];

export function setupWebSocket(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    // Client sends address on connect
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'register') {
          clients.push({ ws, address: msg.address });
          console.log(`WebSocket client registered: ${msg.address}`);
        }
      } catch {}
    });

    ws.on('close', () => {
      const idx = clients.findIndex(c => c.ws === ws);
      if (idx !== -1) {
        console.log(`WebSocket client disconnected: ${clients[idx].address}`);
        clients.splice(idx, 1);
      }
    });

    ws.send(JSON.stringify({ type: 'connected', protocol: 'ABP' }));
  });

  console.log('WebSocket server ready on /ws');
}

export function broadcastToWorkers(address: string, payload: any): void {
  for (const client of clients) {
    if (client.address === address && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(payload));
    }
  }
}

export function broadcastAll(payload: any): void {
  for (const client of clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(payload));
    }
  }
}
