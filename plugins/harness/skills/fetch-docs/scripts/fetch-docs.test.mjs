// node --test fetch-docs.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fetch-docs.mjs');

const filler = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(6);
const RENDERED = `<!doctype html><html><head><style>.x{}</style><script>track()</script></head><body>
<nav><a href="/home">Home</a></nav>
<main>
<h1>Acme API</h1><p>${filler}</p>
<h2>Orders</h2>
<p>See <a href="/docs/auth">auth guide</a> and <a href="#top">top</a>.</p>
<h3>GET /v1/orders</h3>
<table><tr><th>Name</th><th>Type</th><th>Required</th></tr><tr><td><code>limit</code></td><td>integer</td><td>no</td></tr><tr><td>status</td><td>string | null</td><td>yes</td></tr></table>
<pre><code>{ "id": "ord_1" }</code></pre>
<p>Errors: <code>404</code> not found. ${filler}</p>
<h2>Webhooks</h2><p>${filler.repeat(20)}</p>
</main><footer>© Acme</footer></body></html>`;
const SHELL = '<!doctype html><html><body><div id="root"></div><script src="/app.js"></script></body></html>';

let server, url;
before(async () => {
  server = http.createServer((req, res) => {
    res.setHeader('content-type', 'text/html');
    res.end(req.url === '/spa' ? SHELL : RENDERED);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  url = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

// async spawn: execFileSync would block the in-process server
const run = (...a) => new Promise((resolve) => {
  const p = spawn('node', [SCRIPT, ...a]);
  let stdout = '', stderr = '';
  p.stdout.on('data', (d) => (stdout += d));
  p.stderr.on('data', (d) => (stderr += d));
  p.on('close', (status) => resolve({ status, stdout, stderr }));
});
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fetch-docs-'));
const read = (d, f) => fs.readFileSync(path.join(d, f), 'utf8');

test('static page → sections with structure, absolute links, README index', async () => {
  const out = path.join(tmp(), 'acme');
  const r = await run(`${url}/docs/api`, out, '--date', '2026-11-23');
  assert.equal(r.status, 0, r.stderr);
  const files = fs.readdirSync(out).sort();
  assert.deepEqual(files, ['00-intro.md', '01-orders.md', '02-webhooks.md', 'README.md']);
  const orders = read(out, '01-orders.md');
  assert.match(orders, /^## Orders/);
  assert.match(orders, /\[auth guide\]\(http:\/\/127\.0\.0\.1:\d+\/docs\/auth\)/);
  assert.match(orders, / top\./); // in-page anchor kept as text
  assert.match(orders, /### GET \/v1\/orders/);
  assert.match(orders, /\| Name \| Type \| Required \|\n\| --- \| --- \| --- \|\n\| `limit` \| integer \| no \|\n\| status \| string \\\| null \| yes \|/);
  assert.match(orders, /```\n\{ "id": "ord_1" \}\n```/);
  const all = files.map((f) => read(out, f)).join('');
  assert.doesNotMatch(all, /track\(\)|\.x\{\}|© Acme|\[Home\]/);
  const readme = read(out, 'README.md');
  assert.match(readme, /^# Acme API/);
  assert.match(readme, new RegExp(`출처: ${url}/docs/api`));
  assert.match(readme, /가져온 날짜: 2026-11-23/);
  assert.match(readme, /다시 가져오기: `node scripts\/fetch-docs\.mjs http:\S+ \S+acme`/);
  assert.match(readme, /\[Orders\]\(01-orders\.md\) — [\d.]+ KB/);
});

test('JS-rendered shell → exit 3; saved rendered HTML file with --base works', async () => {
  const r = await run(`${url}/spa`, path.join(tmp(), 'x'));
  assert.equal(r.status, 3);
  assert.match(r.stderr, /rendered by JavaScript/);

  const dir = tmp();
  const file = path.join(dir, 'rendered.html');
  fs.writeFileSync(file, RENDERED);
  const out = path.join(dir, 'out');
  const ok = await run(file, out, '--base', 'https://docs.acme.test/api');
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(read(out, '01-orders.md'), /\(https:\/\/docs\.acme\.test\/docs\/auth\)/);
  assert.match(read(out, 'README.md'), /출처: https:\/\/docs\.acme\.test\/api/);
});

test('over --max-kb → exit 4 with section sizes; --only keeps implemented sections', async () => {
  const out = path.join(tmp(), 'acme');
  const big = await run(`${url}/docs/api`, out, '--max-kb', '3');
  assert.equal(big.status, 4);
  assert.match(big.stderr, /KB > --max-kb 3/);
  assert.match(big.stderr, /KB {2}Webhooks/);
  assert.ok(!fs.existsSync(out));

  const r = await run(`${url}/docs/api`, out, '--max-kb', '3', '--only', 'orders');
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(fs.readdirSync(out).sort(), ['00-intro.md', '01-orders.md', 'README.md']);
  assert.match(read(out, 'README.md'), /범위: --only 'orders'/);
  assert.match(read(out, 'README.md'), /--only 'orders' --max-kb 3`/);
});
