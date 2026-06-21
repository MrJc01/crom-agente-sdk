const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
app.use(express.json());

// REST API Mock
app.get('/v1/status', (req, res) => {
  res.json({ status: 'ok', version: '1.2.0-mock' });
});

app.get('/v1/tools', (req, res) => {
  res.json([
    { id: "mock_tool", description: "Uma ferramenta de teste", requiresApproval: false }
  ]);
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'status', data: 'idle' }));
  
  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message);
      if (msg.type === 'subscribe') {
        ws.send(JSON.stringify({ type: 'status', data: 'subscribed' }));
      } else if (msg.type === 'task') {
        ws.send(JSON.stringify({ type: 'status', data: 'running' }));
        setTimeout(() => {
          ws.send(JSON.stringify({ type: 'message', role: 'assistant', content: 'Mock response to: ' + msg.payload }));
          ws.send(JSON.stringify({ type: 'status', data: 'finished' }));
        }, 500);
      }
    } catch (e) {
      // Ignorar parse error
    }
  });
});

const PORT = 17171;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`CromIA MockServer rodando na porta ${PORT}`);
});
