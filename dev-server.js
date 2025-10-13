import http from 'http';
import fs from 'fs';
import path from 'path';

const frontendDir = path.resolve('./notifier-pages-frontend/public');
const backend = await import('./notifier-worker-backend/dist/index.js');
const handler = backend.default;

function serveStatic(req, res) {
  let filePath = path.join(frontendDir, req.url === '/' ? 'index.html' : req.url);
  if (filePath.endsWith('/')) filePath += 'index.html';
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
  };
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': map[ext] || 'text/plain' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/api/')) {
      // collect body
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks).toString();
      const url = 'https://dev.local' + req.url; // 임의 URL
      const headers = {};
      for (const [k, v] of Object.entries(req.headers)) if (v) headers[k] = v;
      const request = new Request(url, { method: req.method, headers, body: body || undefined });
      const response = await handler.fetch(request, {}, {});
      const text = await response.text();
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(text);

      // persistence는 이제 백엔드가 담당합니다.
    } else {
      serveStatic(req, res);
    }
  } catch (e) {
    res.writeHead(500);
    res.end(String(e));
  }
});

const port = 8080;
server.listen(port, () => console.log('Dev server listening on http://localhost:' + port));
