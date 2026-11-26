// node --test fetch-article.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cleanUrl, koDate, rewrite } from './fetch-article.mjs';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fetch-article.mjs');
const para = (s) => `<p>${s.repeat(15)}</p>`;
const stibee = `https://event.stibee.com/v2/click/abc/${Buffer.from('https://brand.example.com/launch?utm_source=nl').toString('base64url')}`;

const ARTICLE = `<!doctype html><html><head>
<meta property="og:title" content="브랜드 리뉴얼 사례">
<script type="application/ld+json">{"@type":"Article","datePublished":"2026-11-19T08:15:00+09:00","author":{"name":"홍길동"}}</script>
</head><body>
<a href="#main">본문으로 바로가기</a>
<article><h3>추천 글</h3><a href="/other">다른 사례</a></article>
<article>
<h1>공유하기</h1><h1>브랜드 리뉴얼 사례</h1>
<p>조회 1,234</p>
${para('리뉴얼 뒤 매출이 늘었다. ')}
<p>자세한 내용은 <a href="https://partner.example.com/report?utm_source=x&amp;id=7">보고서</a>와 <a href="/guide">가이드</a> 참고.</p>
<iframe src="https://www.youtube.com/embed/abc123" title="리뉴얼 영상"></iframe>
<img src="/img/hero.jpg" alt="리뉴얼 전후" width="1200" height="630">
<h2>함께 보면 좋은 글</h2>
<ul><li><a href="/post/1">첫 번째 글</a></li><li><a href="/post/2">두 번째 글</a></li></ul>
<h2>정리</h2>${para('핵심은 일관성이다. ')}
<p>고객센터 1588-0000 (ARS 1번)</p>
</article>
<footer>사업자등록번호 123-45-67890</footer>
</body></html>`;

const NEWSLETTER = `<html><body><table><tr><td><table><tr><td>
<p>이번 주 소식 ${'뉴스레터 본문입니다. '.repeat(20)}</p>
<p><a href="${stibee}">신제품 보기</a></p>
<p>광고 문의: ad@example.com</p>
<p><a href="https://stibee.com/unsubscribe/123">수신거부</a> · <a href="https://www.facebook.com/sharer/sharer.php?u=x">공유하기</a></p>
</td></tr></table></td></tr></table></body></html>`;

const BLOG_MOBILE = `<html><body><div class="se-main-container">${para('네이버 블로그 본문입니다. ')}${para('두 번째 문단입니다. ')}</div>
<p>2026. 11. 3. 14:20</p></body></html>`;
const IMAGES_ONLY = `<html><body><main><h1>상품 상세</h1><img src="/d1.jpg" alt="상세1"><img data-src="/d2.jpg" src="data:image/gif;base64,R0" alt="상세2"></main></body></html>`;

let server, url;
before(async () => {
  server = http.createServer((req, res) => {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    if (req.url === '/article') return res.end(ARTICLE);
    if (req.url === '/newsletter') return res.end(NEWSLETTER);
    if (req.url === '/images') return res.end(IMAGES_ONLY);
    res.statusCode = 404; res.end('');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  url = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const run = (...a) => new Promise((resolve) => {
  const p = spawn('node', [SCRIPT, ...a]);
  let stdout = '', stderr = '';
  p.stdout.on('data', (d) => (stdout += d));
  p.stderr.on('data', (d) => (stderr += d));
  p.on('close', (status) => resolve({ status, stdout, stderr }));
});
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fetch-article-'));

test('article → one file: front matter, clean body, related, links, embeds, images', async () => {
  const out = path.join(tmp(), 'a.md');
  const r = await run(`${url}/article`, out, '--date', '2026-11-26', '--images', 'list');
  assert.equal(r.status, 0, r.stderr);
  const md = fs.readFileSync(out, 'utf8');
  assert.match(md, /^---\ntitle: "브랜드 리뉴얼 사례"\nsource: "http:\/\/127\.0\.0\.1:\d+\/article"\nfetched: "2026-11-26"\npublished: "2026-11-19T08:15:00\+09:00"\nauthor: "홍길동"\nextraction: "html"\n---\n\n# 브랜드 리뉴얼 사례\n/);
  assert.match(md, /리뉴얼 뒤 매출이 늘었다/);
  assert.match(md, /핵심은 일관성이다/);
  assert.match(md, /자세한 내용은 보고서와 가이드 참고\./); // links become text in the body
  for (const junk of [/공유하기/, /조회 1,234/, /바로가기/, /고객센터/, /사업자등록번호/, /utm_source/, /다른 사례/]) assert.doesNotMatch(md, junk);
  assert.match(md, /## 연관 글\n\n- 첫 번째 글\n- 두 번째 글/);
  assert.match(md, /### 외부\n\n- \[보고서\]\(https:\/\/partner\.example\.com\/report\?id=7\)/);
  assert.match(md, /### 내부\n\n- \[가이드\]\(http:\/\/127\.0\.0\.1:\d+\/guide\)/);
  assert.match(md, /## 영상·임베드\n\n- 리뉴얼 영상 — https:\/\/www\.youtube\.com\/embed\/abc123/);
  assert.match(md, /## 이미지\n\n- http:\/\/127\.0\.0\.1:\d+\/img\/hero\.jpg — 리뉴얼 전후 \(1200×630\)/);
  assert.ok(!md.includes('## 정리') || md.indexOf('## 정리') < md.indexOf('## 연관 글'), 'body section after related block stays in the body');
});

test('newsletter: layout tables unwrap, tracker resolves, unsubscribe/share links and --drop lines removed', async () => {
  const out = path.join(tmp(), 'n.md');
  const r = await run(`${url}/newsletter`, out, '--drop', '^광고 문의');
  assert.equal(r.status, 0, r.stderr);
  const md = fs.readFileSync(out, 'utf8');
  assert.doesNotMatch(md, /\| --- \|/);
  assert.match(md, /- \[신제품 보기\]\(https:\/\/brand\.example\.com\/launch\)/);
  assert.doesNotMatch(md, /stibee|unsubscribe|sharer|광고 문의/);
});

test('images-only page warns and lists lazy images', async () => {
  const out = path.join(tmp(), 'i.md');
  const r = await run(`${url}/images`, out, '--images', 'list');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /body is mostly images \(2\)/);
  const md = fs.readFileSync(out, 'utf8');
  assert.match(md, /\/d2\.jpg — 상세2/); // lazy data-src wins over the placeholder
});

test('saved Naver blog HTML: Korean date line → published', async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'blog.html'), BLOG_MOBILE);
  const r = await run(path.join(dir, 'blog.html'), path.join(dir, 'b.md'), '--base', 'https://blog.naver.com/brand/2233');
  assert.equal(r.status, 0, r.stderr);
  const md = fs.readFileSync(path.join(dir, 'b.md'), 'utf8');
  assert.match(md, /published: "2026-11-03 14:20"/);
  assert.match(md, /source: "https:\/\/blog\.naver\.com\/brand\/2233"/);
});

test('helpers: Naver rewrite, URL cleaning, Korean dates', () => {
  assert.equal(rewrite('https://blog.naver.com/brand/223344'), 'https://m.blog.naver.com/brand/223344');
  assert.equal(rewrite('https://blog.naver.com/PostView.naver?blogId=brand&logNo=223344&from=x'), 'https://m.blog.naver.com/brand/223344');
  assert.equal(rewrite('https://example.com/a'), 'https://example.com/a');
  assert.equal(cleanUrl(stibee), 'https://brand.example.com/launch');
  assert.equal(cleanUrl('https://r.example.com/go?url=https%3A%2F%2Fdest.example.com%2Fx%3Fgclid%3D1'), 'https://dest.example.com/x');
  assert.equal(cleanUrl('https://twitter.com/intent/tweet?text=x'), null);
  assert.equal(koDate('2026년 11월 3일', '2026-11-26'), '2026-11-03');
  assert.equal(koDate('7달전', '2026-11-26'), '2026-04-26 (approx.)');
  assert.equal(koDate('3일 전', '2026-11-26'), '2026-11-23 (approx.)');
  assert.equal(koDate('안녕하세요', '2026-11-26'), null);
});
