import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '..', 'dist');
const host = '127.0.0.1';
const startPort = Number(process.env.PORT || 5173);
const noOpen = process.argv.includes('--no-open');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.csv': 'text/csv; charset=utf-8',
};

function createServer() {
  return http.createServer((req, res) => {
    const reqUrl = new URL(req.url || '/', `http://${host}`);
    const pathname = decodeURIComponent(reqUrl.pathname);

    if (pathname === '/api/extract') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ configured: false, mode: 'local' }));
      return;
    }

    const safeRel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    let filePath = path.resolve(distDir, safeRel);

    if (!filePath.startsWith(distDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(distDir, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Internal server error');
        return;
      }
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
      });
      res.end(data);
    });
  });
}

function listenOnAvailablePort(port, maxTries = 20) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', (err) => {
      if (err && err.code === 'EADDRINUSE' && maxTries > 0) {
        resolve(listenOnAvailablePort(port + 1, maxTries - 1));
      } else {
        reject(err);
      }
    });
    server.listen(port, host, () => resolve({ server, port }));
  });
}

if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  console.error('未找到 dist/index.html，请先构建项目。');
  process.exit(1);
}

const { port } = await listenOnAvailablePort(startPort);
const url = `http://${host}:${port}/`;

console.log('');
console.log('======================================================');
console.log('  《询盘差一问》已启动成功！（纯本地免登录，无需联网）');
console.log(`  访问地址: ${url}`);
console.log('  提示: 关闭此窗口即停止服务；请勿在体验时关闭。');
console.log('======================================================');
console.log('');

if (!noOpen) {
  const openCmd =
    process.platform === 'win32'
      ? `start "" "${url}"`
      : process.platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(openCmd);
}
