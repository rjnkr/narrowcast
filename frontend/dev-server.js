const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();
const BACKEND = process.env.BACKEND_URL || 'http://localhost:3001';
const PORT = parseInt(process.env.PORT || '4200', 10);

// Proxy backend routes — use pathFilter so Express doesn't strip the prefix
app.use(createProxyMiddleware({
  target: BACKEND,
  changeOrigin: true,
  pathFilter: ['/api/', '/slides/', '/static/', '/proxy/'],
  on: {
    error: (err, _req, res) => {
      res.status(502).send(`Backend unreachable: ${err.message}`);
    },
  },
}));

// Serve static files from public/
app.use(express.static(path.join(__dirname, 'public')));

// Fallback to index.html
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Frontend dev server  →  http://localhost:${PORT}`);
  console.log(`Backend proxy        →  ${BACKEND}`);
});
