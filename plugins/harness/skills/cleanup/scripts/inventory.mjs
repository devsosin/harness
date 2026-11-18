#!/usr/bin/env node
// Read-only inventory of what a finished task may have left behind: git worktrees and branches,
// Docker containers, volumes, images, networks and build cache, and (on Windows) the size of Docker
// Desktop's WSL disk next to what Docker actually uses. It never deletes anything; it classifies
// each item so the cleanup skill can decide what to remove and what to ask about.
//
//   node inventory.mjs [--mine <compose-project>]... [--repo <path>]... [--json]
//
// --mine   compose projects (or name prefixes) this task created, e.g. `snd005`. Repeatable.
// --repo   git repositories to check. Repeatable; defaults to the current directory.
// --json   machine-readable output instead of the report.
//
// Classes: mine (created by this task) · cache (rebuildable: target, registry, git, cache …, no
// container uses it) · data (databases and other state — never removed without the user) ·
// in-use (a running container needs it) · unknown (ask).
// Node 18+, no dependencies.

import { execFileSync } from "node:child_process";
import { existsSync, statSync, statfsSync } from "node:fs";
import { dirname, join } from "node:path";

const args = process.argv.slice(2);
const mine = [];
const repos = [];
let json = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--mine") mine.push(args[++i]);
  else if (args[i] === "--repo") repos.push(args[++i]);
  else if (args[i] === "--json") json = true;
  else {
    console.error(`unknown argument: ${args[i]}`);
    process.exit(2);
  }
}
if (repos.length === 0) repos.push(process.cwd());

const CACHE = /(^|[-_])(target|cargo[-_]?target|cargo[-_]?registry|cargo[-_]?git|registry|cache|build[-_]?cache|node[-_]?modules|sqlx[-_]?cli|pip|go[-_]?mod|gradle|m2)$/i;
const DATA = /(pg|postgres|mysql|maria|mongo|redis|db|data|minio|elastic|es[-_]?data)/i;

function run(cmd, argv, opts = {}) {
  try {
    return execFileSync(cmd, argv, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 60_000, ...opts });
  } catch (err) {
    return null;
  }
}

function lines(text) {
  return (text ?? "").split(/\r?\n/).filter(Boolean);
}

function jsonLines(text) {
  return lines(text).map((l) => JSON.parse(l));
}

function labels(text) {
  const out = {};
  for (const pair of (text ?? "").split(",")) {
    const at = pair.indexOf("=");
    if (at > 0) out[pair.slice(0, at)] = pair.slice(at + 1);
  }
  return out;
}

function isMine(name, project) {
  return mine.some((m) => project === m || name === m || name.startsWith(`${m}_`) || name.startsWith(`${m}-`));
}

// ---- git -----------------------------------------------------------------------------------

function gitInventory(repo) {
  const git = (...a) => run("git", ["-C", repo, ...a]);
  if (git("rev-parse", "--git-dir") === null) return { repo, error: "not a git repository" };
  git("fetch", "--prune", "--quiet");
  const head = (git("symbolic-ref", "--short", "refs/remotes/origin/HEAD") ?? "origin/main").trim();
  const current = (git("branch", "--show-current") ?? "").trim();

  const worktrees = [];
  let wt = null;
  for (const l of lines(git("worktree", "list", "--porcelain"))) {
    if (l.startsWith("worktree ")) {
      wt = { path: l.slice(9), branch: null, main: worktrees.length === 0 };
      worktrees.push(wt);
    } else if (l.startsWith("branch ")) wt.branch = l.slice(7).replace("refs/heads/", "");
    else if (l === "detached") wt.branch = "(detached)";
  }
  for (const w of worktrees) {
    const status = run("git", ["-C", w.path, "status", "--porcelain"]);
    w.dirty = status === null ? "missing" : lines(status).length > 0;
  }

  const merged = new Set(lines(git("branch", "--format=%(refname:short)", "--merged", head)));
  const branches = lines(git("branch", "--format=%(refname:short)\t%(upstream:short)\t%(upstream:track)")).map((l) => {
    const [name, upstream, track] = l.split("\t");
    return {
      name,
      upstream: upstream || null,
      gone: track === "[gone]",
      mergedInto: merged.has(name) ? head : null,
      current: name === current,
    };
  });
  return { repo, defaultBranch: head, current, worktrees: worktrees.filter((w) => !w.main), branches };
}

// ---- docker --------------------------------------------------------------------------------

function dockerInventory() {
  if (run("docker", ["version", "--format", "{{.Server.Version}}"]) === null) return { error: "docker engine not reachable" };

  const containers = jsonLines(run("docker", ["ps", "-a", "--format", "json"])).map((c) => {
    const l = labels(c.Labels);
    // A compose container can be recreated when the compose files it was started from still exist.
    const configFiles = (l["com.docker.compose.project.config_files"] ?? "").split(",").filter(Boolean);
    return {
      name: c.Names,
      state: c.State,
      status: c.Status,
      image: c.Image,
      project: l["com.docker.compose.project"] ?? null,
      workingDir: l["com.docker.compose.project.working_dir"] ?? null,
      configFiles,
      recreatable: configFiles.length > 0 && configFiles.every((f) => existsSync(f)),
      restartsWithDocker: null,
    };
  });
  for (const c of containers) {
    const policy = run("docker", ["inspect", "-f", "{{.HostConfig.RestartPolicy.Name}}", c.name]);
    c.restartsWithDocker = policy ? !["", "no"].includes(policy.trim()) : null;
  }
  const running = new Set(containers.filter((c) => c.state === "running").map((c) => c.name));

  const df = JSON.parse(run("docker", ["system", "df", "-v", "--format", "json"]) ?? "{}");
  const sizes = new Map((df.Volumes ?? []).map((v) => [v.Name, v.Size]));
  const users = new Map();
  for (const c of containers) {
    const mounts = run("docker", ["inspect", "-f", "{{range .Mounts}}{{if .Name}}{{.Name}} {{end}}{{end}}", c.name]);
    for (const v of (mounts ?? "").trim().split(/\s+/).filter(Boolean)) {
      if (!users.has(v)) users.set(v, []);
      users.get(v).push(c.name);
    }
  }

  const volumes = jsonLines(run("docker", ["volume", "ls", "--format", "json"])).map((v) => {
    const l = labels(v.Labels);
    const project = l["com.docker.compose.project"] ?? null;
    const usedBy = users.get(v.Name) ?? [];
    const short = l["com.docker.compose.volume"] ?? v.Name;
    let kind;
    if (usedBy.some((c) => running.has(c))) kind = "in-use";
    else if (isMine(v.Name, project)) kind = DATA.test(short) && !CACHE.test(short) ? "mine-data" : "mine";
    else if (CACHE.test(short) || CACHE.test(v.Name)) kind = usedBy.length ? "cache-attached" : "cache";
    else if (DATA.test(short) || DATA.test(v.Name)) kind = "data";
    else kind = "unknown";
    return { name: v.Name, size: sizes.get(v.Name) ?? null, project, usedBy, kind };
  });

  const images = (df.Images ?? []).map((i) => ({
    ref: i.Repository === "<none>" ? i.ID.slice(7, 19) : `${i.Repository}:${i.Tag}`,
    size: i.Size,
    containers: Number(i.Containers),
    dangling: i.Repository === "<none>",
    mine: mine.some((m) => i.Repository === m || i.Repository.startsWith(`${m}-`) || i.Repository.startsWith(`${m}_`)),
  }));

  const networks = lines(run("docker", ["network", "ls", "--format", "{{.Name}}"])).filter(
    (n) => !["bridge", "host", "none"].includes(n),
  );

  const summary = lines(run("docker", ["system", "df", "--format", "{{.Type}}\t{{.Size}}\t{{.Reclaimable}}"])).map((l) => {
    const [type, size, reclaimable] = l.split("\t");
    return { type, size, reclaimable };
  });

  return {
    containers: containers.map((c) => ({ ...c, mine: isMine(c.name, c.project) })),
    volumes,
    images,
    networks: networks.map((n) => ({ name: n, mine: isMine(n, null) })),
    summary,
  };
}

// ---- WSL disk (Windows Docker Desktop) -----------------------------------------------------

// Compaction stops every container, so it is worth it only when it gives back a meaningful share of
// the host disk: 20GB on a disk up to 256GB, 50GB up to 512GB, 10% of anything larger.
function compactThreshold(totalBytes) {
  const g = totalBytes / 1e9;
  if (g <= 280) return 20e9; // 256GB disks report ~238-275GB
  if (g <= 560) return 50e9;
  return totalBytes * 0.1;
}

function wslDisk() {
  if (process.platform !== "win32") return null;
  const base = process.env.LOCALAPPDATA ?? "";
  const path = join(base, "Docker", "wsl", "disk", "docker_data.vhdx");
  if (!existsSync(path)) return null;
  let host = null;
  try {
    const root = `${path.slice(0, 2)}/`;
    const s = statfsSync(root);
    host = { drive: path.slice(0, 2), totalBytes: s.bsize * s.blocks, freeBytes: s.bsize * s.bavail };
    host.thresholdBytes = compactThreshold(host.totalBytes);
  } catch {
    host = null;
  }
  return { path, bytes: statSync(path).size, host };
}

function toBytes(text) {
  const m = /^([\d.]+)\s*([kMGT]?B)$/i.exec((text ?? "").trim());
  if (!m) return 0;
  const unit = { B: 1, KB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12 }[m[2].toUpperCase()];
  return Number(m[1]) * unit;
}

const gb = (b) => `${(b / 1e9).toFixed(1)}GB`;

// ---- report --------------------------------------------------------------------------------

const report = { mine, git: repos.map(gitInventory), docker: dockerInventory(), wsl: wslDisk() };
if (report.wsl && !report.docker.error) {
  const used = report.docker.summary.reduce((sum, s) => sum + toBytes(s.size), 0);
  report.wsl.dockerUsedBytes = used;
  report.wsl.reclaimableBytes = Math.max(0, report.wsl.bytes - used);
  if (report.wsl.host) report.wsl.proposeCompaction = report.wsl.reclaimableBytes >= report.wsl.host.thresholdBytes;
}

if (json) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

const out = [];
for (const g of report.git) {
  out.push(`## git ${g.repo}`);
  if (g.error) {
    out.push(`  ${g.error}`);
    continue;
  }
  out.push(`  default ${g.defaultBranch}, current ${g.current || "(detached)"}`);
  for (const w of g.worktrees) out.push(`  worktree ${w.path} [${w.branch}] ${w.dirty === true ? "DIRTY" : w.dirty === "missing" ? "MISSING" : "clean"}`);
  for (const b of g.branches) {
    const tags = [b.current && "current", b.mergedInto && `merged into ${b.mergedInto}`, b.gone && "upstream gone", !b.upstream && "no upstream"].filter(Boolean);
    out.push(`  branch ${b.name}${tags.length ? ` (${tags.join(", ")})` : ""}`);
  }
}
const d = report.docker;
out.push("## docker");
if (d.error) out.push(`  ${d.error}`);
else {
  for (const s of d.summary) out.push(`  ${s.type}: ${s.size} (reclaimable ${s.reclaimable})`);
  for (const c of d.containers) {
    const tags = [
      c.mine && "MINE",
      c.project && `project=${c.project}`,
      c.project && (c.recreatable ? "recreatable" : "compose-files-missing"),
      c.restartsWithDocker === false && c.state === "running" && "no-restart-policy",
    ].filter(Boolean);
    out.push(`  container ${c.name} ${c.state} ${tags.join(" ")}`.trimEnd());
  }
  for (const v of d.volumes) out.push(`  volume ${v.name} ${v.size ?? "?"} ${v.kind.toUpperCase()}${v.usedBy.length ? ` used by ${v.usedBy.join(",")}` : ""}`);
  for (const i of d.images.filter((i) => i.mine || i.dangling)) out.push(`  image ${i.ref} ${i.size}${i.mine ? " MINE" : ""}${i.dangling ? " DANGLING" : ""}`);
  for (const n of d.networks.filter((n) => n.mine)) out.push(`  network ${n.name} MINE`);
}
if (report.wsl) {
  const w = report.wsl;
  out.push("## wsl disk");
  out.push(`  ${w.path}: ${gb(w.bytes)}${w.dockerUsedBytes !== undefined ? `, docker uses ~${gb(w.dockerUsedBytes)}, reclaimable by compaction ~${gb(w.reclaimableBytes)}` : ""}`);
  if (w.host) {
    out.push(`  host ${w.host.drive} ${gb(w.host.totalBytes)} total, ${gb(w.host.freeBytes)} free; compaction threshold ${gb(w.host.thresholdBytes)} -> ${w.proposeCompaction === undefined ? "unknown (docker not reachable)" : w.proposeCompaction ? "PROPOSE" : "below threshold"}`);
  }
}
console.log(out.join("\n"));
