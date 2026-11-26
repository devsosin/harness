// node --test fetch-docs.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { toMarkdown, extract, pageTitle, blockReason } from './fetch-docs.mjs';

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
    const browserUA = /Mozilla/.test(req.headers['user-agent'] ?? '') && /ko/.test(req.headers['accept-language'] ?? '');
    if (req.url === '/ua-filter') { res.statusCode = browserUA ? 200 : 403; return res.end(browserUA ? RENDERED : 'Forbidden'); }
    if (req.url === '/challenge') { res.statusCode = 403; return res.end('<title>Just a moment...</title><div id="cf-chl-widget"></div>'); }
    if (req.url === '/private') { res.statusCode = 401; return res.end('login'); }
    res.end(req.url === '/spa' ? SHELL : RENDERED);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  url = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

// async spawn: execFileSync would block the in-process server
const runIn = (cwd, ...a) => new Promise((resolve) => {
  const p = spawn('node', [SCRIPT, ...a], { cwd });
  let stdout = '', stderr = '';
  p.stdout.on('data', (d) => (stdout += d));
  p.stderr.on('data', (d) => (stderr += d));
  p.on('close', (status) => resolve({ status, stdout, stderr }));
});
const run = (...a) => runIn(process.cwd(), ...a);
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
  assert.match(readme, /다시 가져오기: `node \S*fetch-docs\/scripts\/fetch-docs\.mjs http:\S+ \S+acme`/); // no repo copy: the script that ran
  assert.match(readme, /추출 방식: html/);
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

const filler2 = '본문 문장입니다. '.repeat(60);

test('body: longest <article> wins over a leading card; <aside> kept only when it is the body', () => {
  const card = '<article><h3>추천 글</h3><a href="/x">다른 글</a></article>';
  const md = toMarkdown(`<body>${card}<article><h1>진짜 제목</h1><p>${filler2}</p></article></body>`, 'https://e.test');
  assert.match(md, /# 진짜 제목/);
  assert.doesNotMatch(md, /추천 글/);
  assert.match(toMarkdown(`<main><aside><p>${filler2}</p></aside></main>`), /본문 문장입니다/);
  assert.doesNotMatch(toMarkdown(`<main><p>${filler2}</p><aside>사이드바 광고</aside></main>`), /사이드바/);
});

test('tables: nested one-column layout tables unwrap, data tables stay tables', () => {
  const html = `<main><table><tr><td><table><tr><td><p>안녕하세요 뉴스레터</p></td></tr></table>
    <table><tr><th>항목</th><th>값</th></tr><tr><td>가격</td><td>1,000원</td></tr></table></td></tr></table><table></table></main>`;
  const md = toMarkdown(html);
  assert.match(md, /^안녕하세요 뉴스레터$/m);
  assert.doesNotMatch(md, /\| 안녕하세요/);
  assert.match(md, /\| 항목 \| 값 \|\n\| --- \| --- \|\n\| 가격 \| 1,000원 \|/);
});

test('title: og:title, then the first non-widget <h1>, then JSON-LD headline', () => {
  const body = `<h1>공유하기</h1><h1>기사 제목</h1><p>${filler2}</p>`;
  assert.equal(pageTitle(`<head><meta content="OG 제목" property="og:title"></head><body>${body}</body>`, ''), 'OG 제목');
  assert.equal(pageTitle(`<body>${body}</body>`, ''), '기사 제목');
  assert.equal(pageTitle('<script type="application/ld+json">{"@graph":[{"headline":"LD 제목"}]}</script>', ''), 'LD 제목');
});

test('empty JS shell falls back to JSON-LD articleBody, then __NEXT_DATA__', () => {
  const ld = `<html><head><script type="application/ld+json">[{"@type":"NewsArticle","headline":"요즘 기사","articleBody":"${'전문 문장. '.repeat(50)}"}]</script></head><body><div id="root"></div></body></html>`;
  const a = extract(ld, 'https://e.test');
  assert.equal(a.method, 'json-ld');
  assert.match(a.md, /^# 요즘 기사\n\n전문 문장\./);
  const next = `<body><div id="__next"></div><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { post: { id: 1, html: `<p>${filler2}</p>` } } } })}</script></body>`;
  const b = extract(next);
  assert.equal(b.method, 'next-data');
  assert.match(b.md, /본문 문장입니다/);
});

test('blocks: browser headers pass simple UA filters; challenge and login pages exit 5 with a save-HTML hint', async () => {
  const ok = await run(`${url}/ua-filter`, path.join(tmp(), 'ua'));
  assert.equal(ok.status, 0, ok.stderr);
  for (const [p, why] of [['/challenge', /bot challenge/], ['/private', /login required/]]) {
    const r = await run(`${url}${p}`, path.join(tmp(), 'x'));
    assert.equal(r.status, 5, r.stderr);
    assert.match(r.stderr, why);
    assert.match(r.stderr, /save it as HTML, and pass the file/);
  }
  assert.equal(blockReason(429, '', 'https://e.test/a'), 'rate limited — wait before retrying');
  assert.equal(blockReason(200, '<html>'.padEnd(30000, 'x'), 'https://nid.naver.com/nidlogin.login'), 'login required');
  assert.equal(blockReason(200, '<p>normal</p>', 'https://e.test/a'), null);
});

test('warns when the kept body is a small part of the page; re-run uses the repo copy when present', async () => {
  const dir = tmp();
  const file = path.join(dir, 'page.html');
  fs.writeFileSync(file, `<body><div>${'사이트 소개 '.repeat(800)}</div><main><p>${filler2}</p></main></body>`);
  const r = await run(file, path.join(dir, 'out'), '--base', 'https://e.test/a');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /warning: kept \d+ of \d+ chars/);

  fs.mkdirSync(path.join(dir, 'scripts'));
  fs.copyFileSync(SCRIPT, path.join(dir, 'scripts', 'fetch-docs.mjs'));
  const r2 = await runIn(dir, file, 'out2', '--base', 'https://e.test/a');
  assert.equal(r2.status, 0, r2.stderr);
  assert.match(read(path.join(dir, 'out2'), 'README.md'), /다시 가져오기: `node scripts\/fetch-docs\.mjs /);
});
