// node --test workspace-map.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'workspace-map.mjs');

function workspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wsmap-'));
  const w = (p, s) => { fs.mkdirSync(path.dirname(path.join(root, p)), { recursive: true }); fs.writeFileSync(path.join(root, p), s); };
  // backend repo with a token in its remote URL
  w('backend/.git/HEAD', 'ref: refs/heads/feat/be-001-x\n');
  w('backend/.git/config', '[remote "origin"]\n\turl = https://user:secret-token@github.com/acme/api.git\n');
  w('backend/Cargo.toml', '[package]\nname = "api"\n\n[dependencies]\naxum = "0.8"\nsqlx = { version = "0.9" }\n');
  w('backend/docker-compose.dev.yml', 'services: {}\n');
  w('backend/.env', 'SECRET=do-not-read\n');
  // frontend repo
  w('frontend/.git/HEAD', 'ref: refs/heads/main\n');
  w('frontend/.git/config', '[remote "origin"]\n\turl = git@github.com:acme/web.git\n');
  w('frontend/package.json', JSON.stringify({ name: 'web', packageManager: 'pnpm@10.0.0', dependencies: { react: '^19.0.0', vite: '^8.0.0' }, scripts: { dev: 'vite', test: 'vitest' } }));
  w('frontend/node_modules/x/package.json', '{}');
  // docs
  w('docs/product/FeatureSpec.md', '---\nversion: 1\n---\n# 기능 명세\n');
  for (let i = 1; i <= 10; i++) w(`docs/migrations/2611${String(i).padStart(2, '0')}_x.sql`, '');
  w('docs/migrate.sh', 'set -eu\r\necho hi\r\n');
  w('CLAUDE.md', 'See `docs/product/FeatureSpec.md`, `backend/Cargo.toml`, `docker-compose.dev.yml`, `docs/gone.md`, `/migrations/new`, `postgres:16`, `<repo>/x.md`.\n');
  return root;
}

test('map lists repos, stacks, docs, and warnings without secrets', () => {
  const root = workspace();
  const out = execFileSync('node', [SCRIPT, root], { encoding: 'utf8' });
  assert.match(out, /Root is \*\*not\*\* a git repository/);
  assert.match(out, /`backend\/` \| acme\/api @ feat\/be-001-x/);
  assert.match(out, /Rust `api`: axum, sqlx/);
  assert.match(out, /`frontend\/` \| acme\/web @ main/);
  assert.match(out, /JS `web` \(pnpm\): react@19\.0\.0, vite@8\.0\.0/);
  assert.match(out, /docker-compose\.dev\.yml/);
  assert.match(out, /\.env \(local, not read\)/);
  assert.match(out, /FeatureSpec\.md {2}— 기능 명세/);
  assert.match(out, /\*\.sql × 10 \(261101_x\.sql … 261110_x\.sql\)/);
  assert.match(out, /CRLF.*`docs\/migrate\.sh`/);
  assert.doesNotMatch(out, /secret-token|do-not-read|node_modules/);
});

test('--check reports only paths missing from the workspace', () => {
  const root = workspace();
  const r = spawnSync('node', [SCRIPT, root, '--check', 'CLAUDE.md'], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /- docs\/gone\.md/);
  // found directly, found under a repo folder, or not a workspace path
  for (const p of ['docs/product/FeatureSpec.md', 'backend/Cargo.toml', 'docker-compose.dev.yml', '/migrations/new', 'postgres:16', '<repo>/x.md']) {
    assert.ok(!r.stdout.includes(`- ${p}\n`), `${p} should not be reported`);
  }
});

test('--json is valid JSON', () => {
  const root = workspace();
  const data = JSON.parse(execFileSync('node', [SCRIPT, root, '--json'], { encoding: 'utf8' }));
  assert.equal(data.units.find((u) => u.path === 'backend').git.remote, 'acme/api');
});
