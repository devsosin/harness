#!/usr/bin/env node
// Fetch one article / newsletter / blog post / product page into ONE Markdown file:
// YAML front matter, body, and 연관 글 · 링크 · 영상·임베드 · 이미지 sections.
//
// Usage: node fetch-article.mjs <url|file> <out.md> [--base <url>] [--images list] [--drop <regex>]
//                               [--date YYYY-MM-DD] [--browser]
// Exit: 0 written, 2 usage, 3 no text, 5 blocked (login / bot block / rate limit).
// Node 18+, no required dependencies. Reuses the fetch-docs converter (same plugin).

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { extract, load, mainHtml, meta, jsonLd, pageTitle, Blocked, WIDGET } from '../../fetch-docs/scripts/fetch-docs.mjs';

const attr = (tag, name) => tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'))?.slice(2).find((v) => v !== undefined);
const abs = (u, base) => { try { return new URL(u.replace(/&amp;/g, '&'), base || undefined).href; } catch { return u; } };

// Naver blog bodies live in an iframe; the mobile page has them inline.
export function rewrite(src) {
  const m = src.match(/^https?:\/\/blog\.naver\.com\/(?:PostView\.naver\?.*?blogId=([\w-]+).*?logNo=(\d+)|([\w-]+)\/(\d+))/i);
  return m ? `https://m.blog.naver.com/${m[1] ?? m[3]}/${m[2] ?? m[4]}` : src;
}

const TRACK_PARAM = /^(utm_\w+|fbclid|gclid|dclid|msclkid|igshid|mc_cid|mc_eid|_hs\w+|stb_\w+|ref_src)$/i;
const REDIRECT_PARAM = ['url', 'u', 'target', 'redirect', 'redirect_url', 'redirectUrl', 'link', 'to', 'dest'];
// Newsletter click trackers → final address; tracking params removed. null = drop the link (unsubscribe, share).
export function cleanUrl(u) {
  let url;
  try { url = new URL(u); } catch { return u; }
  if (/unsubscribe|수신\s*거부|optout|opt-out|\/(sharer|intent\/tweet|share)\b/i.test(decodeURIComponent(url.href))) return null;
  if (/stibee\.com$/i.test(url.hostname) && /\/click\//.test(url.pathname)) {
    for (const seg of url.pathname.split('/').reverse()) {
      const dec = Buffer.from(seg.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
      const hit = dec.match(/https?:\/\/[^\s"'<>]+/);
      if (hit) return cleanUrl(hit[0]);
    }
  }
  for (const k of REDIRECT_PARAM) { const v = url.searchParams.get(k); if (v && /^https?:\/\//.test(v)) return cleanUrl(v); }
  for (const k of [...url.searchParams.keys()]) if (TRACK_PARAM.test(k)) url.searchParams.delete(k);
  return url.href;
}

const BOILER = /바로\s*가기|본문으로|사업자\s*(등록|정보)|통신판매업|고객\s*센터|대표\s*(이사|자)\s*:|개인정보\s*(처리|취급)\s*방침|이용\s*약관|ARS|all rights reserved|copyright|^©/i;
const META_LINE = /^(조회\s*수?|조회|좋아요|공감|댓글|스크랩|공유)\s*[\d,]+$|^[\d,]+\s*(views?|likes?)$/i;
const RELATED = /함께\s*보면|관련\s*(글|기사|콘텐츠)|연관\s*(글|기사)|추천\s*(글|기사|콘텐츠)|인기\s*(글|기사)|다른\s*글|related|recommended/i;

// Korean dates: "2026.11.19 08:15", "2026년 11월 19일", "7달전" (relative to the fetch date).
export function koDate(text, fetched) {
  const a = text.match(/(20\d\d)\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})일?(?:\.?\s+(\d{1,2}):(\d{2}))?/);
  if (a) return `${a[1]}-${a[2].padStart(2, '0')}-${a[3].padStart(2, '0')}${a[4] ? ` ${a[4].padStart(2, '0')}:${a[5]}` : ''}`;
  const r = text.match(/(\d+)\s*(분|시간|일|주|달|개월|년)\s*전/);
  if (!r) return null;
  const d = new Date(`${fetched}T00:00:00Z`);
  const n = Number(r[1]);
  ({ 분: () => {}, 시간: () => {}, 일: () => d.setUTCDate(d.getUTCDate() - n), 주: () => d.setUTCDate(d.getUTCDate() - 7 * n),
    달: () => d.setUTCMonth(d.getUTCMonth() - n), 개월: () => d.setUTCMonth(d.getUTCMonth() - n), 년: () => d.setUTCFullYear(d.getUTCFullYear() - n) })[r[2]]();
  return `${d.toISOString().slice(0, 10)} (approx.)`;
}

export function article(raw, { base, fetched, drop, images: listImages }) {
  const { md, method } = extract(raw, base);
  const main = mainHtml(raw);
  // og:title often ends in " | Site" — drop the site name.
  const site = meta(raw, 'og:site_name');
  const title = pageTitle(raw, md).replace(/\s*[|·\-–—]\s*[^|·\-–—]+$/, (m) => (site && m.includes(site)) || /^\s*\|/.test(m) ? '' : m);
  const ld = jsonLd(raw).find((o) => o.datePublished || o.author) ?? {};
  const author = [ld.author].flat().map((a) => (typeof a === 'string' ? a : a?.name)).filter(Boolean).join(', ') || meta(raw, 'author') || null;

  const embeds = [...main.matchAll(/<(iframe|video|source|embed)\b[^>]*>/gi)]
    .map(([tag]) => ({ src: attr(tag, 'src') ?? attr(tag, 'data-src'), title: attr(tag, 'title') ?? '' }))
    .filter((e) => e.src && !/^(about:|data:)/.test(e.src)).map((e) => ({ ...e, src: abs(e.src, base) }));
  const imgs = [...main.matchAll(/<img\b[^>]*>/gi)].map(([tag]) => ({
    src: attr(tag, 'data-src') ?? attr(tag, 'data-lazy-src') ?? attr(tag, 'src'), alt: attr(tag, 'alt') ?? '', w: attr(tag, 'width'), h: attr(tag, 'height'),
  })).filter((i) => i.src && !i.src.startsWith('data:')).map((i) => ({ ...i, src: abs(i.src, base) }));

  // Split off related-post blocks: a heading that matches RELATED, up to the next heading of the same or higher level.
  const body = [], related = [];
  let inRelated = 0;
  for (const line of md.split('\n')) {
    const h = line.match(/^(#{1,6}) (.+)/);
    if (h && inRelated && h[1].length <= inRelated) inRelated = 0;
    if (h && RELATED.test(h[2])) { inRelated = h[1].length; continue; }
    (inRelated ? related : body).push(line);
  }

  const links = new Map();
  const dropRe = drop && new RegExp(drop, 'i');
  let published = ld.datePublished ?? meta(raw, 'article:published_time');
  const cleanLines = (lines, collect) => lines.map((line) => line.replace(/\[([^\]]*)\]\(([^)]+)\)/g, (_, text, u) => {
    const c = cleanUrl(u);
    if (c && collect && !links.has(c) && c !== base) links.set(c, text);
    return c ? text : '';
  })).filter((line) => {
    const t = line.trim();
    if (!t) return true;
    if (t.length < 120 && (BOILER.test(t) || META_LINE.test(t) || (dropRe && dropRe.test(t)))) return false;
    // a short line that is just a date / byline-date goes to front matter
    const d = t.length < 40 && !/^#/.test(t) && koDate(t, fetched);
    if (d) { published ??= d; return false; }
    return true;
  });
  let text = cleanLines(body, true).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  // the title goes in the heading below; drop the body's own copy and headings with nothing under them
  const lines = text.split('\n').filter((l) => !/^#{1,6} /.test(l) || !(l.replace(/^#+ /, '').trim() === title || WIDGET.test(l.replace(/^#+ /, '').trim())));
  text = lines.filter((l, i) => {
    const h = l.match(/^(#{1,6}) /);
    if (!h) return true;
    const next = lines.slice(i + 1).find((x) => x.trim());
    return next !== undefined && !(next.match(/^(#{1,6}) /)?.[1].length <= h[1].length);
  }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  const relatedText = cleanLines(related, false).map((l) => l.replace(/^- /, '').trim()).filter((l) => /[\p{L}\p{N}]/u.test(l)).map((l) => `- ${l}`);

  const host = base ? new URL(base).hostname : '';
  const warnings = [];
  if (text.replace(/\s/g, '').length < 200 && imgs.length) warnings.push(`body is mostly images (${imgs.length}); use --images list and read the images`);
  if (method.startsWith('og:description')) warnings.push('only a summary was found (og:description)');

  const fm = { title, source: base ?? null, fetched, published: published ?? null, author, extraction: method };
  const out = ['---', ...Object.entries(fm).map(([k, v]) => `${k}: ${v === null ? 'null' : JSON.stringify(String(v))}`), '---', '', `# ${title}`, '', text, ''];
  if (relatedText.length) out.push('## 연관 글', '', ...relatedText, '');
  if (links.size) {
    const all = [...links].map(([u, t]) => ({ u, t: t || u, ext: !host || new URL(u).hostname !== host }));
    out.push('## 링크', '');
    for (const [label, ext] of [['외부', true], ['내부', false]]) {
      const l = all.filter((x) => x.ext === ext);
      if (l.length) out.push(`### ${label}`, '', ...l.map((x) => `- [${x.t}](${x.u})`), '');
    }
  }
  if (embeds.length) out.push('## 영상·임베드', '', ...embeds.map((e) => `- ${e.title ? `${e.title} — ` : ''}${e.src}`), '');
  if (listImages && imgs.length) out.push('## 이미지', '', ...imgs.map((i) => `- ${i.src}${i.alt ? ` — ${i.alt}` : ''}${i.w && i.h ? ` (${i.w}×${i.h})` : ''}`), '');
  return { text: out.join('\n').replace(/\n{3,}/g, '\n\n'), warnings, enough: text.replace(/\s/g, '').length >= 200 || imgs.length > 0 || method.startsWith('og:') };
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const valued = new Set(['--base', '--images', '--drop', '--date']);
  const [src, out] = args.filter((a, i) => !a.startsWith('--') && !valued.has(args[i - 1]));
  if (!src || !out) { console.error('usage: node fetch-article.mjs <url|file> <out.md> [--base url] [--images list] [--drop regex] [--date YYYY-MM-DD] [--browser]'); process.exit(2); }
  const url = /^https?:\/\//.test(src) ? rewrite(src) : src;
  const base = opt('--base') ?? (url === src ? (/^https?:\/\//.test(src) ? src : undefined) : src);
  const fetched = opt('--date') ?? new Date().toISOString().slice(0, 10);

  const raw = await load(url, args.includes('--browser'));
  const res = article(raw, { base, fetched, drop: opt('--drop'), images: opt('--images') === 'list' });
  if (!res.enough) {
    if (/cafe\.naver\.com/i.test(src)) throw new Blocked(`${src}: blocked (Naver Cafe posts sit in a login-gated iframe). Open it in a browser, save the HTML, and pass the file: <file> --base ${src}`);
    console.error(`${src}: almost no text — likely rendered by JavaScript. Re-run with --browser, or save the rendered HTML and pass the file with --base <url>.`);
    process.exit(3);
  }
  for (const w of res.warnings) console.error(`warning: ${w}`);
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, res.text);
  console.log(`${out} (${(Buffer.byteLength(res.text) / 1024).toFixed(1)} KB${url !== src ? `, fetched ${url}` : ''})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((e) => { console.error(e.message); process.exit(e instanceof Blocked ? 5 : 1); });
