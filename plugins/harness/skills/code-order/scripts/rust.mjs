#!/usr/bin/env node
// Reorder top-level items in Rust files. Only moves whole items; never edits their text.
// Usage: node rust.mjs [--write] <file-or-dir>...   (default: check, exit 1 if any file would move)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKIP_DIRS = new Set(['target', '.git', 'node_modules']);
const STD_ROOTS = new Set(['std', 'core', 'alloc']);
const LOCAL_ROOTS = new Set(['crate', 'super', 'self']);

// ---------- lexer ----------
function lex(src) {
  const toks = [];
  const isId = (c) => /[\p{L}\p{N}_]/u.test(c);
  let i = 0;
  const push = (k, s, e) => toks.push({ k, s, e, v: src.slice(s, e) });
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '/' && n === '/') { const e = src.indexOf('\n', i); const end = e < 0 ? src.length : e; push('lc', i, end); i = end; continue; }
    if (c === '/' && n === '*') {
      let d = 1, j = i + 2;
      while (j < src.length && d) { if (src.startsWith('/*', j)) { d++; j += 2; } else if (src.startsWith('*/', j)) { d--; j += 2; } else j++; }
      if (d) throw new Error(`unterminated block comment at ${i}`);
      push('bc', i, j); i = j; continue;
    }
    // raw strings: r"..", r#".."#, br"..", cr".."
    const raw = /^(?:b|c)?r(#*)"/.exec(src.slice(i, i + 260));
    if (raw && !(i > 0 && isId(src[i - 1]))) {
      const close = '"' + raw[1];
      const e = src.indexOf(close, i + raw[0].length);
      if (e < 0) throw new Error(`unterminated raw string at ${i}`);
      push('str', i, e + close.length); i = e + close.length; continue;
    }
    if (c === '"' || ((c === 'b' || c === 'c') && n === '"' && !(i > 0 && isId(src[i - 1])))) {
      let j = c === '"' ? i + 1 : i + 2;
      while (j < src.length && src[j] !== '"') j += src[j] === '\\' ? 2 : 1;
      if (j >= src.length) throw new Error(`unterminated string at ${i}`);
      push('str', i, j + 1); i = j + 1; continue;
    }
    if (c === "'" || (c === 'b' && n === "'")) {
      const q = c === "'" ? i : i + 1;
      if (src[q + 1] === '\\') {
        let j = q + 2; while (j < src.length && src[j] !== "'") j++;
        push('chr', i, j + 1); i = j + 1; continue;
      }
      const cp = src.codePointAt(q + 1); const w = cp > 0xffff ? 2 : 1;
      if (src[q + 1 + w] === "'") { push('chr', i, q + 2 + w); i = q + 2 + w; continue; }
      if (c === "'") { let j = i + 1; while (j < src.length && isId(src[j])) j++; push('lt', i, j); i = j; continue; }
    }
    if (c === 'r' && n === '#' && isId(src[i + 2] || '')) { let j = i + 2; while (j < src.length && isId(src[j])) j++; push('id', i, j); i = j; continue; }
    if (isId(c)) { let j = i; while (j < src.length && isId(src[j])) j++; push(/[0-9]/.test(c) ? 'num' : 'id', i, j); i = j; continue; }
    push('p', i, i + 1); i++;
  }
  return toks;
}

// ---------- item split ----------
const isComment = (t) => t && (t.k === 'lc' || t.k === 'bc');
const isInnerDoc = (t) => isComment(t) && (t.v.startsWith('//!') || t.v.startsWith('/*!'));

function skipBalanced(toks, i) { // toks[i] is an opener; returns index after its closer
  const pairs = { '(': ')', '[': ']', '{': '}' };
  const stack = [];
  for (let j = i; j < toks.length; j++) {
    const v = toks[j].k === 'p' ? toks[j].v : null;
    if (v && pairs[v]) stack.push(pairs[v]);
    else if (v && (v === ')' || v === ']' || v === '}')) {
      if (stack.pop() !== v) throw new Error(`unbalanced '${v}' at ${toks[j].s}`);
      if (!stack.length) return j + 1;
    }
  }
  throw new Error(`unclosed '${toks[i].v}' at ${toks[i].s}`);
}

function endOf(toks, i, mode) { // mode 'semi': ends at ';' ; 'brace': ends at ';' or a closing '}' at depth 0
  for (let j = i; j < toks.length; j++) {
    const t = toks[j];
    if (t.k !== 'p') continue;
    if (t.v === ';') return j + 1;
    if (t.v === '(' || t.v === '[') { j = skipBalanced(toks, j) - 1; continue; }
    if (t.v === '{') { const e = skipBalanced(toks, j); if (mode === 'brace') return e; j = e - 1; continue; }
  }
  throw new Error(`item without end at ${toks[i].s}`);
}

function parseItem(toks, i) {
  let j = i;
  const attrs = [];
  for (;;) {
    if (isComment(toks[j])) { j++; continue; }
    if (toks[j]?.v === '#' && toks[j + 1]?.v === '[') { const e = skipBalanced(toks, j + 1); attrs.push(toks.slice(j, e).map((t) => t.v).join('')); j = e; continue; }
    break;
  }
  if (j >= toks.length) return null;
  const body = j;
  const id = (k) => toks[k]?.k === 'id' ? toks[k].v : null;
  const isPub = id(j) === 'pub';
  if (isPub) { j++; if (toks[j]?.v === '(') j = skipBalanced(toks, j); }
  const mods = new Set();
  while (['unsafe', 'async', 'default', 'auto'].includes(id(j)) || (id(j) === 'const' && (id(j + 1) === 'fn' || ['unsafe', 'async', 'extern'].includes(id(j + 1)))) || (id(j) === 'extern' && (toks[j + 1]?.k === 'str' || id(j + 1) === 'fn'))) {
    if (id(j) === 'extern' && toks[j + 1]?.k === 'str' && toks[j + 2]?.v === '{') break;
    mods.add(id(j)); j++; if (toks[j]?.k === 'str') j++;
  }
  const kw = id(j);
  const item = { start: i, attrs, kw, name: null, pub: isPub };
  const named = () => { item.name = id(j + 1); };
  switch (kw) {
    case 'use': item.kind = 'use'; item.end = endOf(toks, j, 'semi'); break;
    case 'extern':
      if (id(j + 1) === 'crate') { item.kind = 'extern'; item.end = endOf(toks, j, 'semi'); }
      else { item.kind = 'other'; item.end = endOf(toks, j, 'brace'); }
      break;
    case 'mod': named(); item.end = endOf(toks, j, 'brace'); item.kind = toks[item.end - 1].v === ';' ? 'mod' : 'inline-mod'; break;
    case 'const': case 'static': named(); item.kind = 'const'; item.end = endOf(toks, j, 'semi'); break;
    case 'type': named(); item.kind = 'type'; item.end = endOf(toks, j, 'semi'); break;
    case 'fn': named(); item.kind = 'fn'; item.end = endOf(toks, j, 'brace'); break;
    case 'struct': case 'enum': case 'union': case 'trait': named(); item.kind = 'def'; item.end = endOf(toks, j, 'brace'); break;
    case 'impl': item.kind = 'impl'; item.end = endOf(toks, j, 'brace'); Object.assign(item, implTarget(toks, j + 1)); break;
    case 'macro_rules': item.kind = 'macro'; item.name = id(j + 2); item.end = endOf(toks, j, toks[j + 3]?.v === '{' ? 'brace' : 'semi'); break;
    default: {
      let k = j; while (toks[k]?.k === 'id' || toks[k]?.v === ':') k++;
      if (k > j && toks[k]?.v === '!') { item.kind = 'const'; item.end = endOf(toks, k + 1, toks[k + 1]?.v === '{' ? 'brace' : 'semi'); break; }
      throw new Error(`unknown item at ${toks[body].s}: ${toks.slice(body, body + 4).map((t) => t.v).join(' ')}`);
    }
  }
  item.test = item.kind === 'inline-mod' && attrs.some((a) => /^#\[cfg\(test\)\]$/.test(a.replace(/\s/g, '')));
  item.ids = new Set(toks.slice(body, item.end).filter((t) => t.k === 'id').map((t) => t.v));
  if (item.kind === 'use') item.root = useRoot(toks, j + 1);
  return item;
}

function implTarget(toks, j) {
  if (toks[j]?.v === '<') { // skip generics, ignoring '>' of '->'
    let d = 0;
    for (; j < toks.length; j++) {
      if (toks[j].v === '<') d++;
      else if (toks[j].v === '>' && toks[j - 1]?.v !== '-') { d--; if (!d) { j++; break; } }
    }
  }
  const head = [];
  let d = 0;
  for (; j < toks.length && !(d === 0 && (toks[j].v === '{' || toks[j].v === 'where')); j++) {
    if (toks[j].v === '<') d++; else if (toks[j].v === '>' && toks[j - 1]?.v !== '-') d--;
    head.push({ ...toks[j], d });
  }
  const f = head.findIndex((t) => t.v === 'for' && t.d === 0);
  const lastName = (ts) => { const top = ts.filter((t) => t.k === 'id' && t.d === 0 && !['dyn', 'mut', 'impl'].includes(t.v)); return top.length ? top[top.length - 1].v : null; };
  return f < 0 ? { selfType: lastName(head), trait: null } : { trait: lastName(head.slice(0, f)), selfType: lastName(head.slice(f + 1)) };
}

function useRoot(toks, j) {
  if (toks[j]?.v === ':') return '::';
  return toks[j]?.k === 'id' ? toks[j].v : '{';
}

function split(src) {
  const toks = lex(src);
  let i = 0;
  // header: inner docs and inner attributes
  for (;;) {
    if (isInnerDoc(toks[i])) { i++; continue; }
    if (toks[i]?.v === '#' && toks[i + 1]?.v === '!' && toks[i + 2]?.v === '[') { i = skipBalanced(toks, i + 2); continue; }
    break;
  }
  const headerEnd = i ? toks[i - 1].e : 0;
  const items = [];
  while (i < toks.length) {
    const it = parseItem(toks, i);
    if (!it) break;
    let end = it.end;
    // a trailing `// note` on the item's last line belongs to the item
    if (toks[end]?.k === 'lc' && !src.slice(toks[end - 1].e, toks[end].s).includes('\n')) end++;
    const s = toks[it.start].s;
    const lineStart = src.lastIndexOf('\n', s - 1) + 1;
    it.text = src.slice(/^\s*$/.test(src.slice(lineStart, s)) ? lineStart : s, toks[end - 1].e).replace(/^\n+/, '');
    const prevEnd = items.length ? items[items.length - 1].srcEnd : headerEnd;
    it.blankBefore = /\n[ \t]*\n/.test(src.slice(prevEnd, s));
    it.srcEnd = toks[end - 1].e;
    it.index = items.length;
    items.push(it);
    i = end;
  }
  const footer = i < toks.length ? src.slice(toks[i].s).trimEnd() : '';
  return { header: src.slice(0, headerEnd).trimEnd(), items, footer };
}

// ---------- ordering ----------
function order({ items }) {
  const by = (k) => items.filter((it) => it.kind === k);
  const mods = new Set(by('mod').map((it) => it.name));
  const useGroup = (it) => it.pub ? 3 : STD_ROOTS.has(it.root) ? 0 : (LOCAL_ROOTS.has(it.root) || mods.has(it.root) || it.root === '{') ? 2 : 1;
  const uses = [0, 1, 2, 3].map((g) => by('use').filter((it) => useGroup(it) === g)).filter((g) => g.length);

  // groups: one per struct/enum/union/trait defined here, or per impl target type
  const defs = new Map(by('def').map((it) => [it.name, it]));
  const groups = new Map();
  const groupOf = (key, at) => { if (!groups.has(key)) groups.set(key, { at, defs: [], inherent: [], traitImpls: [], fns: [] }); const g = groups.get(key); g.at = Math.min(g.at, at); return g; };
  for (const it of by('def')) groupOf(it.name, it.index).defs.push(it);
  for (const it of by('impl')) {
    const key = defs.has(it.selfType) || !defs.has(it.trait) ? it.selfType : it.trait;
    const g = groupOf(key ?? `#${it.index}`, it.index);
    (it.trait ? g.traitImpls : g.inherent).push(it);
  }
  // free functions follow the first group (in file order) that uses them, transitively
  const fns = new Map(by('fn').map((it) => [it.name, it]));
  const taken = new Set();
  // a type defined here stays where it is defined; otherwise where its first impl is
  for (const g of groups.values()) if (g.defs.length) g.at = g.defs[0].index;
  const sorted = [...groups.values()].sort((a, b) => a.at - b.at);
  for (const g of sorted) {
    const queue = [...g.defs, ...g.inherent, ...g.traitImpls];
    for (let q = 0; q < queue.length; q++) {
      const users = [...queue[q].ids].map((n) => fns.get(n)).filter((f) => f && !taken.has(f) && f !== queue[q]);
      for (const f of users.sort((a, b) => a.index - b.index)) { taken.add(f); g.fns.push(f); queue.push(f); }
    }
  }
  const sections = [
    { items: by('extern') },
    { items: by('mod'), keepBlank: true },
    ...uses.map((g) => ({ items: g })),
    { items: by('macro'), keepBlank: true },
    { items: by('const'), keepBlank: true },
    { items: by('type'), keepBlank: true },
    ...sorted.map((g) => ({ items: [...g.defs, ...g.inherent, ...g.traitImpls, ...g.fns], blank: true })),
    { items: by('fn').filter((f) => !taken.has(f)), blank: true },
    { items: by('other'), blank: true },
    { items: by('inline-mod').filter((m) => !m.test), blank: true },
    { items: by('inline-mod').filter((m) => m.test), blank: true },
  ].filter((s) => s.items.length);
  return sections;
}

function render(parsed, sections) {
  const parts = [];
  if (parsed.header) parts.push(parsed.header);
  for (const s of sections) {
    parts.push(s.items.map((it, k) => (k === 0 ? '' : s.blank || (s.keepBlank && it.blankBefore) ? '\n' : '') + it.text).join('\n'));
  }
  if (parsed.footer) parts.push(parsed.footer);
  return parts.join('\n\n') + '\n';
}

function moved(parsed, sections) {
  const flat = sections.flatMap((s) => s.items);
  if (flat.some((it, k) => it.index !== k)) return true;
  // use groups: a blank line must separate groups and only groups
  const uses = sections.filter((s) => s.items[0].kind === 'use');
  return uses.some((s, g) => s.items.some((it, k) => (g > 0 || k > 0) && it.blankBefore !== (k === 0)));
}

const squash = (s) => s.replace(/\s+/g, '');
/** Returns the reordered source, or null when the items are already in order. */
export function reorder(text) {
  const crlf = text.includes('\r\n');
  const src = text.replace(/\r\n/g, '\n');
  const parsed = split(src);
  const sections = order(parsed);
  if (!moved(parsed, sections)) return null;
  const out = render(parsed, sections);
  // safety: same characters, only reordered
  if ([...squash(out)].sort().join('') !== [...squash(src)].sort().join('')) throw new Error('content changed while reordering (bug)');
  return crlf ? out.replace(/\n/g, '\r\n') : out;
}

function processFile(file, write) {
  const out = reorder(fs.readFileSync(file, 'utf8'));
  if (out !== null && write) fs.writeFileSync(file, out);
  return out !== null;
}

function walk(p, out) {
  const st = fs.statSync(p);
  if (st.isDirectory()) { for (const e of fs.readdirSync(p)) if (!SKIP_DIRS.has(e)) walk(path.join(p, e), out); }
  else if (p.endsWith('.rs')) out.push(p);
  return out;
}

function main(args) {
  const write = args.includes('--write');
  const files = args.filter((a) => !a.startsWith('--')).flatMap((a) => walk(a, []));
  if (!files.length) { console.error('usage: node rust.mjs [--write] <file-or-dir>...'); return 2; }
  let changed = 0, failed = 0;
  for (const f of files) {
    try { if (processFile(f, write)) { changed++; console.log(`${write ? 'reordered' : 'would reorder'}: ${f}`); } }
    catch (e) { failed++; console.error(`skipped: ${f}: ${e.message}`); }
  }
  console.log(`${files.length} files, ${changed} ${write ? 'reordered' : 'out of order'}, ${failed} skipped`);
  return failed ? 2 : changed && !write ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
