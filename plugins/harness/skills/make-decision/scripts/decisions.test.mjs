// node --test decisions.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'decisions.mjs');

function decisions() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'decisions-'));
  const w = (p, s) => { fs.mkdirSync(path.dirname(path.join(root, p)), { recursive: true }); fs.writeFileSync(path.join(root, p), s); };
  const brief = (id, extra = '') => `# ${id} 질문 제목\n\n질문: 무엇을 쓸까?\n막힌 카드: backend-03\n${extra}\n## 선택지\n\n- A: a\n- B: b\n`;
  const opinion = (c, r) => `선택: ${c}\n\n결정 근거: ${r}\n`;
  // agree → complete
  w('open/auth/D-001-session/brief.md', brief('D-001'));
  w('open/auth/D-001-session/d-main.md', opinion('A', 'main reason'));
  w('open/auth/D-001-session/d-sub.md', opinion('A', 'sub reason\nsecond line'));
  // disagree → halt
  w('open/ux/D-002-nav/brief.md', brief('D-002'));
  w('open/ux/D-002-nav/d-main.md', opinion('A', 'x'));
  w('open/ux/D-002-nav/d-sub.md', opinion('B', 'y'));
  // agree but user check required → halt
  w('open/payment/D-003-refund/brief.md', brief('D-003', '사용자 확인: 필요 (환불 정책)\n'));
  w('open/payment/D-003-refund/d-main.md', opinion('B', 'x'));
  w('open/payment/D-003-refund/d-sub.md', opinion('B', 'y'));
  // missing sub → stays open
  w('open/infra/D-004-cdn/brief.md', brief('D-004'));
  w('open/infra/D-004-cdn/d-main.md', opinion('A', 'x'));
  // user decided a halted one → complete
  w('halt/ux/D-005-theme/brief.md', brief('D-005'));
  w('halt/ux/D-005-theme/result.md', '상태: 보류\n\n선택: C\n결정자: 사용자\n');
  // user decided but no choice → stays
  w('later/ux/D-006-font/brief.md', brief('D-006'));
  w('later/ux/D-006-font/result.md', '선택: \n결정자: 사용자\n');
  w('README.md', '# 결정\n\n<!-- decisions:start -->\nold\n<!-- decisions:end -->\n\n## 진행 방식\n');
  return root;
}

const run = (root, ...a) => execFileSync('node', [SCRIPT, root, '--date', '2026-11-23', ...a], { encoding: 'utf8' });
const has = (root, p) => fs.existsSync(path.join(root, p));

test('--dry-run plans moves without touching files', () => {
  const root = decisions();
  const before = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  const out = run(root, '--dry-run');
  assert.match(out, /would move {2}open\/auth\/D-001-session → complete\/ — agree on A/);
  assert.match(out, /would move {2}open\/ux\/D-002-nav → halt\/ — disagree A\/B/);
  assert.match(out, /would move {2}open\/payment\/D-003-refund → halt\/ — agree on B, needs user/);
  assert.match(out, /keep {2}open\/infra\/D-004-cdn — missing: d-sub\.md 선택/);
  assert.match(out, /would move {2}halt\/ux\/D-005-theme → complete\/ — user chose C/);
  assert.match(out, /keep {2}later\/ux\/D-006-font — .*no 선택/);
  assert.ok(has(root, 'open/auth/D-001-session'));
  assert.ok(!has(root, 'open/auth/D-001-session/result.md'));
  assert.equal(fs.readFileSync(path.join(root, 'README.md'), 'utf8'), before);
});

test('sweep moves folders, writes result.md and rebuilds the README table', () => {
  const root = decisions();
  run(root);
  assert.ok(has(root, 'complete/auth/D-001-session') && !has(root, 'open/auth/D-001-session'));
  const r1 = fs.readFileSync(path.join(root, 'complete/auth/D-001-session/result.md'), 'utf8');
  assert.match(r1, /^선택: A$/m);
  assert.match(r1, /- main: main reason\n- sub: sub reason second line/);
  assert.match(r1, /날짜: 2026-11-23\n결정자: 에이전트 합의/);

  const r2 = fs.readFileSync(path.join(root, 'halt/ux/D-002-nav/result.md'), 'utf8');
  assert.match(r2, /- main: A — x\n- sub: B — y/);
  assert.match(r2, /막힌 카드: backend-03/);
  assert.match(fs.readFileSync(path.join(root, 'halt/payment/D-003-refund/result.md'), 'utf8'), /두 의견 모두 B\. 사용자 확인 항목/);
  assert.ok(has(root, 'open/infra/D-004-cdn'));
  assert.ok(has(root, 'complete/ux/D-005-theme'));
  assert.ok(has(root, 'later/ux/D-006-font'));

  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  assert.doesNotMatch(readme, /\nold\n/);
  assert.match(readme, /\| D-001 \| 질문 제목 \| auth \| complete \| A \| backend-03 \| \[complete\/auth\/D-001-session\]/);
  assert.match(readme, /\| D-002 \| 질문 제목 \| ux \| halt \| — \|/);
  assert.match(readme, /\| D-005 \| 질문 제목 \| ux \| complete \| C \|/);
  assert.match(readme, /## 진행 방식/);

  // halted D-002: user fills the two lines → next sweep completes it
  const f = path.join(root, 'halt/ux/D-002-nav/result.md');
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/선택: \n결정자: \n/, '선택: B\n결정자: 사용자\n'));
  run(root);
  assert.ok(has(root, 'complete/ux/D-002-nav'));
  const again = run(root);
  assert.match(again, /README: table unchanged/);
  assert.doesNotMatch(again, /D-003/); // halted, waiting: no noise
});
