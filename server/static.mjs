import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Serves the built app (../dist) so one process provides UI + API on http://localhost:8787. */
const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};

export async function serveStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  let rel;
  try { rel = decodeURIComponent(pathname); } catch { return false; }
  const file = path.resolve(DIST, '.' + (rel.endsWith('/') ? rel + 'index.html' : rel));
  if (file !== DIST && !file.startsWith(DIST + path.sep)) return false; // path traversal guard
  let target = file;
  let info = await stat(target).catch(() => null);
  if (!info?.isFile()) {
    // unknown paths without extension → app shell; missing assets → 404
    if (path.extname(rel)) return false;
    target = path.join(DIST, 'index.html');
    info = await stat(target).catch(() => null);
    if (!info) return false;
  }
  const hashed = /\/assets\//.test(target);
  res.writeHead(200, {
    'Content-Type': TYPES[path.extname(target)] ?? 'application/octet-stream',
    'Content-Length': info.size,
    'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });
  if (req.method === 'HEAD') res.end();
  else createReadStream(target).pipe(res);
  return true;
}
