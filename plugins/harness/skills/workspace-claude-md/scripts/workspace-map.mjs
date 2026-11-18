#!/usr/bin/env node
// Map a multi-repo workspace as Markdown: git repos, detected stacks, dev/test files, docs trees.
// Read-only. Node 18+, no dependencies.
//
//   node workspace-map.mjs [root]                     # map (default root: cwd)
//   node workspace-map.mjs [root] --depth 4           # docs tree depth (default 3)
//   node workspace-map.mjs [root] --json              # same data as JSON
//   node workspace-map.mjs [root] --check CLAUDE.md   # list backticked paths in the file that do not exist
import fs from 'node:fs';
import path from 'node:path';

const SKIP = new Set([
  '.git', 'node_modules', 'target', 'dist', 'build', 'out', '.next', '.nuxt', '.svelte-kit', '.turbo',
  '.cache', '.venv', 'venv', '__pycache__', '.mypy_cache', '.pytest_cache', '.ruff_cache', '.sqlx',
  '.worktrees', 'worktrees', 'coverage', 'test-results', 'playwright-report', '.idea', '.vscode', '.gradle',
]);
const DOC_DIRS = new Set(['docs', 'analysis', 'doc', 'design', 'specs']);
const COLLAPSE_AT = 8; // same-extension files in one folder beyond this are collapsed

// ---------- args ----------
const argv = process.argv.slice(2);
const opt = { depth: 3, json: false, check: null, root: '.' };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--depth') opt.depth = Number(argv[++i]);
  else if (a === '--json') opt.json = true;
  else if (a === '--check') opt.check = argv[++i];
  else if (a === '-h' || a === '--help') { console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 9).join('\n')); process.exit(0); }
  else opt.root = a;
}
const ROOT = path.resolve(opt.root);

// ---------- helpers ----------
const exists = (p) => { try { fs.accessSync(p); return true; } catch { return false; } };
const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } };
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/') || '.';
const ls = (dir) => { try { return fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; } };
const dirs = (dir) => ls(dir).filter((d) => d.isDirectory() && !SKIP.has(d.name)).map((d) => d.name).sort();

// Strip credentials from remote URLs (https://user:token@host/...).
const cleanUrl = (u) => u.replace(/\/\/[^/@]+@/, '//');

function gitInfo(dir) {
  const dotgit = path.join(dir, '.git');
  if (!exists(dotgit)) return null;
  let gitDir = dotgit;
  let worktree = false;
  if (fs.statSync(dotgit).isFile()) {
    const m = /gitdir:\s*(.+)/.exec(read(dotgit) || '');
    if (!m) return { remote: null, branch: null, worktree: true };
    gitDir = path.resolve(dir, m[1].trim());
    worktree = true;
  }
  const head = (read(path.join(gitDir, 'HEAD')) || '').trim();
  const branch = head.startsWith('ref: refs/heads/') ? head.slice(16) : head.slice(0, 7) || null;
  // a linked worktree keeps config in the common dir
  const common = (read(path.join(gitDir, 'commondir')) || '').trim();
  const cfg = read(path.join(common ? path.resolve(gitDir, common) : gitDir, 'config')) || '';
  const m = /\[remote "origin"\][^[]*?url\s*=\s*(\S+)/.exec(cfg);
  let remote = m ? cleanUrl(m[1]) : null;
  const gh = remote && /github\.com[:/]([^/]+\/[^/.]+?)(?:\.git)?$/.exec(remote);
  if (gh) remote = gh[1];
  return { remote, branch, worktree };
}

function tomlDeps(text) {
  const deps = new Set();
  let inDeps = false;
  for (const line of text.split(/\r?\n/)) {
    const sec = /^\s*\[([^\]]+)\]/.exec(line);
    if (sec) { inDeps = /(^|\.)(dependencies|dev-dependencies|workspace\.dependencies)$/.test(sec[1]); continue; }
    const kv = inDeps && /^\s*([A-Za-z0-9_-]+)\s*=/.exec(line);
    if (kv) deps.add(kv[1]);
  }
  return deps;
}

const INTERESTING_JS = [
  'next', 'react', 'vue', 'svelte', '@sveltejs/kit', 'vite', '@tanstack/react-router', '@tanstack/react-query',
  'zustand', 'tailwindcss', 'react-aria-components', 'react-hook-form', 'zod', 'msw', 'vitest',
  '@playwright/test', 'vite-plugin-pwa', 'typescript', 'expo', 'react-native', 'electron',
];
const INTERESTING_RS = ['axum', 'actix-web', 'sqlx', 'diesel', 'sea-orm', 'tokio', 'reqwest', 'serde', 'utoipa', 'jsonwebtoken', 'argon2'];

function stackOf(dir) {
  const s = [];
  const cargo = read(path.join(dir, 'Cargo.toml'));
  if (cargo) {
    const name = /\[package\][^[]*?name\s*=\s*"([^"]+)"/.exec(cargo)?.[1];
    const members = /\[workspace\][^[]*?members\s*=\s*\[([^\]]*)\]/.exec(cargo)?.[1];
    const deps = tomlDeps(cargo);
    const hits = INTERESTING_RS.filter((d) => deps.has(d));
    const toolchain = read(path.join(dir, 'rust-toolchain.toml'))?.match(/channel\s*=\s*"([^"]+)"/)?.[1];
    s.push(`Rust${name ? ` \`${name}\`` : ''}${members ? ` workspace(${members.replace(/["\s]/g, '')})` : ''}${hits.length ? `: ${hits.join(', ')}` : ''}${toolchain ? ` (toolchain ${toolchain})` : ''}`);
  }
  const pkgText = read(path.join(dir, 'package.json'));
  if (pkgText) {
    try {
      const pkg = JSON.parse(pkgText);
      const all = { ...pkg.dependencies, ...pkg.devDependencies };
      const hits = INTERESTING_JS.filter((d) => all[d]).map((d) => `${d}@${String(all[d]).replace(/^[\^~]/, '')}`);
      const pm = pkg.packageManager?.split('@')[0]
        ?? (exists(path.join(dir, 'pnpm-lock.yaml')) ? 'pnpm' : exists(path.join(dir, 'yarn.lock')) ? 'yarn' : exists(path.join(dir, 'package-lock.json')) ? 'npm' : null);
      const scripts = Object.keys(pkg.scripts || {});
      s.push(`JS${pkg.name ? ` \`${pkg.name}\`` : ''}${pm ? ` (${pm})` : ''}${hits.length ? `: ${hits.join(', ')}` : ''}${scripts.length ? ` — scripts: ${scripts.join(', ')}` : ''}`);
    } catch { s.push('JS (package.json unreadable)'); }
  }
  const py = read(path.join(dir, 'pyproject.toml'));
  if (py) {
    const fw = ['fastapi', 'django', 'flask', 'langchain', 'sqlalchemy'].filter((d) => new RegExp(`["']${d}`, 'i').test(py));
    s.push(`Python${fw.length ? `: ${fw.join(', ')}` : ''}${exists(path.join(dir, 'uv.lock')) ? ' (uv)' : ''}`);
  } else if (exists(path.join(dir, 'requirements.txt'))) s.push('Python (requirements.txt)');
  if (exists(path.join(dir, 'go.mod'))) s.push('Go');
  const gradle = read(path.join(dir, 'build.gradle')) ?? read(path.join(dir, 'build.gradle.kts'));
  if (gradle) s.push(`JVM Gradle${/spring-boot|org\.springframework\.boot/.test(gradle) ? ': Spring Boot' : ''}`);
  const pom = read(path.join(dir, 'pom.xml'));
  if (pom) s.push(`JVM Maven${/spring-boot/.test(pom) ? ': Spring Boot' : ''}`);
  return s;
}

const MARKERS = [
  ['CLAUDE.md', 'CLAUDE.md'], ['README.md', 'README'], ['.claude/github-issue.yml', 'github-issue.yml'],
  ['.claude/launch.json', 'launch.json'], ['.env.example', '.env.example'], ['.gitattributes', '.gitattributes'],
];
function devFiles(dir) {
  const out = [];
  for (const [p, label] of MARKERS) if (exists(path.join(dir, p))) out.push(label);
  for (const e of ls(dir)) {
    if (!e.isFile()) continue;
    if (/^(docker-)?compose[\w.-]*\.ya?ml$/.test(e.name) || /(^|\.)Dockerfile$|^Dockerfile[\w.-]*$|\.Dockerfile$/.test(e.name)) out.push(e.name);
  }
  if (exists(path.join(dir, '.env'))) out.push('.env (local, not read)');
  if (exists(path.join(dir, '.claude', 'commands'))) out.push(`.claude/commands(${ls(path.join(dir, '.claude', 'commands')).length})`);
  if (exists(path.join(dir, '.claude', 'skills'))) out.push(`.claude/skills(${dirs(path.join(dir, '.claude', 'skills')).length})`);
  if (exists(path.join(dir, '.github', 'workflows'))) out.push('CI(.github/workflows)');
  return out;
}

function crlfHint(dir) {
  // shell scripts with CRLF fail inside Linux containers ("set: Illegal option -")
  const bad = [];
  const walk = (d, depth) => {
    if (depth > 3) return;
    for (const e of ls(d)) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(p, depth + 1); continue; }
      if (!/\.(sh|bash)$/.test(e.name)) continue;
      const t = read(p);
      if (t && t.includes('\r\n')) bad.push(rel(p));
    }
  };
  walk(dir, 0);
  return bad;
}

// ---------- repos ----------
function findUnits() {
  const units = [];
  const visit = (dir, depth) => {
    const g = gitInfo(dir);
    const isUnit = dir === ROOT || g || stackOf(dir).length;
    if (isUnit) units.push({ path: rel(dir), git: g, stack: stackOf(dir), files: devFiles(dir), children: dirs(dir) });
    if (depth >= 2) return;
    for (const name of dirs(dir)) {
      if (dir === ROOT || !g) visit(path.join(dir, name), depth + 1);
      else if (depth < 2 && gitInfo(path.join(dir, name))) visit(path.join(dir, name), depth + 1); // nested repo
    }
  };
  visit(ROOT, 0);
  return units;
}

// ---------- docs tree ----------
function firstHeading(file) {
  const t = read(file);
  if (!t) return '';
  const fm = t.startsWith('---') ? t.indexOf('\n---', 3) : -1;
  const body = fm > 0 ? t.slice(fm + 4) : t;
  const h = /^#{1,3}\s+(.+)$/m.exec(body);
  return h ? h[1].trim().slice(0, 70) : '';
}

function tree(dir, depth, prefix = '') {
  const lines = [];
  const entries = ls(dir).filter((e) => !SKIP.has(e.name) && !e.name.startsWith('.')).sort((a, b) => (b.isDirectory() - a.isDirectory()) || a.name.localeCompare(b.name));
  const files = entries.filter((e) => e.isFile());
  const byExt = {};
  for (const f of files) (byExt[path.extname(f.name) || f.name] ||= []).push(f.name);
  const collapsed = new Set(Object.entries(byExt).filter(([ext, n]) => n.length > COLLAPSE_AT && ext !== '.md').map(([ext]) => ext));
  const rows = [];
  for (const e of entries) {
    if (e.isDirectory()) rows.push({ dir: e.name });
    else if (!collapsed.has(path.extname(e.name) || e.name)) rows.push({ file: e.name });
  }
  for (const ext of collapsed) {
    const names = byExt[ext];
    rows.push({ note: `*${ext} × ${names.length} (${names[0]} … ${names[names.length - 1]})` });
  }
  rows.forEach((r, i) => {
    const last = i === rows.length - 1;
    const branch = prefix + (last ? '└── ' : '├── ');
    const next = prefix + (last ? '    ' : '│   ');
    if (r.dir) {
      const p = path.join(dir, r.dir);
      if (depth > 1) { lines.push(`${branch}${r.dir}/`); lines.push(...tree(p, depth - 1, next)); }
      else lines.push(`${branch}${r.dir}/  (${count(p)} files)`);
    } else if (r.file) {
      const h = r.file.endsWith('.md') ? firstHeading(path.join(dir, r.file)) : '';
      lines.push(`${branch}${r.file}${h && h.toLowerCase() !== r.file.replace(/\.md$/, '').toLowerCase() ? `  — ${h}` : ''}`);
    } else lines.push(`${branch}${r.note}`);
  });
  return lines;
}

function count(dir) {
  let n = 0;
  const walk = (d) => { for (const e of ls(d)) { if (SKIP.has(e.name)) continue; if (e.isDirectory()) walk(path.join(d, e.name)); else n++; } };
  walk(dir);
  return n;
}

function findDocDirs(units) {
  const found = [];
  const seen = new Set();
  for (const u of units) {
    const base = path.join(ROOT, u.path);
    for (const name of dirs(base)) if (DOC_DIRS.has(name.toLowerCase())) {
      const p = path.join(base, name);
      if (!seen.has(p)) { seen.add(p); found.push(p); }
    }
  }
  return found;
}

// ---------- --check ----------
function checkPaths(file) {
  const text = read(path.resolve(ROOT, file));
  if (text == null) { console.error(`cannot read ${file}`); process.exit(2); }
  const base = path.dirname(path.resolve(ROOT, file));
  const missing = [];
  const seen = new Set();
  let index = null; // every relative path in the workspace, for "some/path" written relative to a folder named nearby
  const indexed = () => {
    if (index) return index;
    index = [];
    const skip = new Set(['.git', 'node_modules', 'target', '.venv', '.next', 'dist', '__pycache__']);
    const walk = (d, depth) => {
      if (depth > 7) return;
      for (const e of ls(d)) {
        if (skip.has(e.name)) continue;
        const p = path.join(d, e.name);
        index.push(rel(p) + (e.isDirectory() ? '/' : ''));
        if (e.isDirectory()) walk(p, depth + 1);
      }
    };
    walk(ROOT, 0);
    return index;
  };
  for (const m of text.matchAll(/`([^`\s]+)`/g)) {
    const p = m[1].replace(/[),.;]+$/, '').replace(/:\d+(-\d+)?$/, '');
    if (seen.has(p)) continue;
    seen.add(p);
    // only things that look like workspace paths: contain "/" or a file extension
    if (!/[/]|\.[a-z0-9]{1,5}$/i.test(p)) continue;
    // skip URLs, container paths, image tags, env/flags, globs, placeholders
    if (/^(https?:|[a-z]+:\/\/|\/|\$|~|-)|[<>{}*|=:@]|\.\.\.|YYMMDD|^\d/.test(p)) continue;
    if (p.replace(/\/$/, '') === path.basename(ROOT)) continue;
    if (exists(path.join(base, p)) || exists(path.join(ROOT, p))) continue;
    const want = p.endsWith('/') ? p : p.replace(/\/$/, '');
    if (indexed().some((q) => q === want || q.endsWith('/' + want) || (!p.endsWith('/') && (q === want + '/' || q.endsWith('/' + want + '/'))))) continue;
    missing.push(p);
  }
  return missing;
}

// ---------- main ----------
if (opt.check) {
  const missing = checkPaths(opt.check);
  if (!missing.length) { console.log(`ok: every path in ${opt.check} exists`); process.exit(0); }
  console.log(`missing paths in ${opt.check} (check each — some may be planned or outside the workspace):`);
  for (const p of missing) console.log(`- ${p}`);
  process.exit(1);
}

const units = findUnits();
const docDirs = findDocDirs(units);
const crlf = crlfHint(ROOT);

if (opt.json) {
  console.log(JSON.stringify({ root: ROOT, units, docs: docDirs.map(rel), crlfScripts: crlf }, null, 2));
  process.exit(0);
}

const out = [];
out.push(`# Workspace map: ${path.basename(ROOT)}`, '');
const rootUnit = units.find((u) => u.path === '.');
out.push(rootUnit.git ? `Root is a git repository (${rootUnit.git.remote ?? 'no origin'}, branch ${rootUnit.git.branch}).` : 'Root is **not** a git repository.', '');
out.push('## Folders', '', '| Folder | Git | Stack | Dev/test files |', '|---|---|---|---|');
for (const u of units) {
  const g = u.git ? `${u.git.remote ?? '(no origin)'}${u.git.branch ? ` @ ${u.git.branch}` : ''}${u.git.worktree ? ' (worktree)' : ''}` : '—';
  out.push(`| \`${u.path === '.' ? './' : u.path + '/'}\` | ${g} | ${u.stack.join('<br>') || '—'} | ${u.files.join(', ') || '—'} |`);
}
const plain = rootUnit.children.filter((c) => !c.startsWith('.') && !units.some((u) => u.path === c || u.path.startsWith(c + '/')));
if (plain.length) out.push('', `Other top-level folders (no git, no manifest): ${plain.map((c) => `\`${c}/\``).join(', ')}`);
for (const d of docDirs) {
  out.push('', `## \`${rel(d)}/\``, '', '```text', `${rel(d)}/`, ...tree(d, opt.depth), '```');
}
if (crlf.length) out.push('', '## Warnings', '', `Shell scripts with CRLF line endings (fail in Linux containers; pin \`*.sh text eol=lf\` in .gitattributes): ${crlf.map((p) => `\`${p}\``).join(', ')}`);
console.log(out.join('\n'));
