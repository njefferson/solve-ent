/**
 * serve.mjs — a static server over `public/`, for the harnesses only.
 *
 * NOT part of the app and never deployed: the app is static files and needs no
 * server at all. This exists because `file://` cannot load an ES module by an
 * absolute path, so the browser harness would open the page, silently fail to
 * boot the application, and measure an empty shell. That is not a hypothetical
 * — the first smoke test reported four surfaces and no errors on a page whose
 * script had never run.
 */

import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
};

/** Serve `root` on an ephemeral port. Resolves with the origin and a stop function. */
export function serve(root) {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    // normalize() collapses `..`, so a request cannot climb out of the root.
    let path = join(root, normalize(decodeURIComponent(url.pathname)));
    if (!path.startsWith(root)) {
      response.writeHead(403).end('no');
      return;
    }
    // A directory serves its index.html, which is how /whats-new resolves —
    // the same rule the static host applies, so the harness walks the same
    // paths a reader does rather than a set of filenames only it knows.
    if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html');
    if (!existsSync(path)) {
      response.writeHead(404).end('not here');
      return;
    }
    response.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    response.end(readFileSync(path));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      resolve({
        origin: `http://127.0.0.1:${port}`,
        stop: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}
