#!/usr/bin/env node
// Sweep docs/decisions/: settle open decisions from d-main/d-sub, apply user decisions, rebuild the README table.
// Usage: node decisions.mjs <decisions-dir> [--dry-run] [--date YYYY-MM-DD]
// Node 18+, no dependencies.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const STATES = ['open', 'complete', 'halt', 'later'];
const START = '<!-- decisions:start -->';
const END = '<!-- decisions:end -->';

const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null);
const field = (s, name) => s?.match(new RegExp(`^${name}:[ \\t]*(.*)$`, 'm'))?.[1].trim() || null;
const choice = (s) => field(s, '선택')?.match(/^([A-Z])\b/)?.[1] ?? null;
// d-main/d-sub end with "결정 근거:", so the rationale is everything after it.
const reason = (s) => s?.split(/^결정 근거:/m)[1]?.trim().replace(/\s*\n\s*/g, ' ') || '';

function list(root) {
  const out = [];
  for (const state of STATES) {
    const sd = path.join(root, state);
    if (!fs.existsSync(sd)) continue;
    for (const label of fs.readdirSync(sd)) {
      const ld = path.join(sd, label);
      if (!fs.statSync(ld).isDirectory()) continue;
      for (const name of fs.readdirSync(ld)) {
        const dir = path.join(ld, name);
        if (fs.statSync(dir).isDirectory()) out.push({ state, label, name, dir });
      }
    }
  }
  return out;
}

export function plan(root, date) {
  const actions = [];
  for (const d of list(root)) {
    const result = read(path.join(d.dir, 'result.md'));
    // User decision wins wherever the folder is.
    if (d.state !== 'complete' && field(result, '결정자') === '사용자') {
      if (choice(result)) actions.push({ ...d, to: 'complete', why: `user chose ${choice(result)}` });
      else actions.push({ ...d, to: null, why: 'result.md says 결정자: 사용자 but has no 선택' });
      continue;
    }
    if (d.state !== 'open') continue;
    const brief = read(path.join(d.dir, 'brief.md'));
    const main = read(path.join(d.dir, 'd-main.md'));
    const sub = read(path.join(d.dir, 'd-sub.md'));
    const missing = [!brief && 'brief.md', !choice(main) && 'd-main.md 선택', !choice(sub) && 'd-sub.md 선택'].filter(Boolean);
    if (missing.length) { actions.push({ ...d, to: null, why: `missing: ${missing.join(', ')}` }); continue; }
    const [a, b] = [choice(main), choice(sub)];
    const needsUser = /^필요/.test(field(brief, '사용자 확인') ?? '');
    if (a === b && !needsUser) {
      actions.push({ ...d, to: 'complete', why: `agree on ${a}`,
        write: `선택: ${a}\n\n결정 근거:\n- main: ${reason(main)}\n- sub: ${reason(sub)}\n\n날짜: ${date}\n결정자: 에이전트 합의\n` });
    } else {
      const head = a === b ? `두 의견 모두 ${a}. 사용자 확인 항목이라 에이전트가 정하지 않는다.` : '두 의견이 다르다.';
      actions.push({ ...d, to: 'halt', why: a === b ? `agree on ${a}, needs user` : `disagree ${a}/${b}`,
        write: `상태: 보류 — 사용자 결정 대기 (${date})\n\n${head}\n\n- main: ${a} — ${reason(main)}\n- sub: ${b} — ${reason(sub)}\n\n질문: ${field(brief, '질문') ?? '(brief.md 참고)'}\n막힌 카드: ${field(brief, '막힌 카드') ?? '없음'}\n\n정하면 아래 두 줄을 채운다(선택: A|B|C, 결정자: 사용자). 다음 점검 때 complete/ 로 옮겨진다.\n\n선택: \n결정자: \n` });
    }
  }
  return actions;
}

export function table(root) {
  const rows = list(root).sort((x, y) => x.name.localeCompare(y.name)).map((d) => {
    const brief = read(path.join(d.dir, 'brief.md')) ?? '';
    const result = read(path.join(d.dir, 'result.md'));
    const id = d.name.match(/^[A-Za-z]+-\d+/)?.[0] ?? d.name;
    const title = brief.match(/^#\s+(.+)$/m)?.[1].replace(id, '').trim() || d.name;
    const res = d.state === 'complete' ? (choice(result) ?? '—') : '—';
    const rel = path.posix.join(d.state, d.label, d.name);
    return `| ${id} | ${title} | ${d.label} | ${d.state} | ${res} | ${field(brief, '막힌 카드') ?? '—'} | [${rel}](${rel}/) |`;
  });
  return ['| ID | 제목 | 라벨 | 상태 | 결과 | 막힌 카드 | 경로 |', '|---|---|---|---|---|---|---|', ...rows].join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const di = args.indexOf('--date');
  const date = di >= 0 ? args[di + 1] : new Date().toISOString().slice(0, 10);
  const root = args.find((a, k) => !a.startsWith('--') && (di < 0 || k !== di + 1));
  const dry = args.includes('--dry-run');
  if (!root || !fs.existsSync(root)) { console.error('usage: node decisions.mjs <decisions-dir> [--dry-run] [--date YYYY-MM-DD]'); process.exit(2); }

  for (const a of plan(root, date)) {
    const from = path.posix.join(a.state, a.label, a.name);
    if (!a.to) { console.log(`keep  ${from} — ${a.why}`); continue; }
    const to = path.join(root, a.to, a.label, a.name);
    console.log(`${dry ? 'would ' : ''}move  ${from} → ${a.to}/ — ${a.why}`);
    if (dry) continue;
    if (fs.existsSync(to)) { console.error(`  skip: ${to} exists`); continue; }
    if (a.write) fs.writeFileSync(path.join(a.dir, 'result.md'), a.write);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.renameSync(a.dir, to);
  }

  const readme = path.join(root, 'README.md');
  const s = read(readme);
  if (!s || !s.includes(START) || !s.includes(END)) { console.log(`README: no ${START} … ${END} block in ${readme}, table not written`); return; }
  const next = s.replace(new RegExp(`${START}[\\s\\S]*?${END}`), `${START}\n${table(root)}\n${END}`);
  if (next === s) console.log('README: table unchanged');
  else if (dry) console.log('README: table would change');
  else { fs.writeFileSync(readme, next); console.log('README: table rebuilt'); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
