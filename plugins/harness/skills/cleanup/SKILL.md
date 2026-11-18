---
name: cleanup
description: 이슈·PR 작업이 남긴 백그라운드 작업·컨테이너 안 프로세스, 연결된 세션, 워크트리·병합된 브랜치, 테스트용 Docker 컨테이너·볼륨·이미지, 임시 파일을 정리하고 Windows Docker Desktop 의 WSL 디스크(vhdx) 압축을 제안한다. 사용자가 "정리해", "환경 정리", "도커 볼륨 정리", "디스크 정리", "워크트리·브랜치 지워", "세션 정리", "작업 마무리" 라고 하거나, PR 을 올리거나 병합한 뒤, Docker 디스크·메모리 부족으로 빌드가 멈췄을 때 쓴다.
---

# Cleanup after work

Goal: when work ends, leave nothing **this work created**, and delete nothing **belonging to other people or sessions**. Deletion rests on two questions: "who created it?" and "can it be recreated?"

Output language: reports and questions to the user follow the user's language.

| Class | Examples | Handling |
|---|---|---|
| Created by this work | compose stack started with `-p <id>`, this session's worktree, this issue's merged branch, temp password files | clean up right away |
| Existing containers this work started | a stopped shared DB or dev container this session started with `docker start` / `compose up` | stop (do not remove) |
| Caches left by other work | `*_target`, `*cargo-registry`, `*cache` volumes with no container, dangling images, build cache | show list and sizes, clean after confirmation |
| Data | DB and state volumes like `*pgdata`, `*-db-data`, release image tags | only when the user names them for deletion |
| In use | containers running since before the session, and their volumes | do not touch |

**When the session ends, none of the containers it used may still be running.** Remove what it brought up, stop what it started. Leave only what was running before the session. Leftover containers hold memory (when the Docker VM runs short the whole engine hangs) and blur "who is using this" at the next cleanup.

**The license to delete is "it can be recreated".** Containers and caches can be recreated any time while the compose file and the start command remain. So before deleting, check that the recreate method is recorded (step 3). Data volumes come back as an empty DB from compose, so this license does not apply to them.

Deleting something that cannot be recreated is irreversible, so "not sure" always goes in the ask bucket. If the user widens the scope ("the other sessions are done"), follow the widened-scope rules in step 4, but still ask about data by name.

## 1. List what this work created

Collect from the conversation and work log first — the script does not know "who created it".

- Background jobs (shells, monitors, subagents) and **commands run inside containers**. Stopping the host's `docker exec` leaves `cargo`/`npm` inside the container running, holding build locks and memory — end them with `docker exec <c> pkill -f <cmd>` or by stopping the container.
- Compose project names brought up (`docker compose -p <name>`) and the commands used; containers and images created separately.
- Containers this session **started** — stopped at session start, started by this session. Keep them apart from those running before the session (they get stopped at cleanup).
- Git worktrees, branches and those branches' PR numbers. Throwaway files this work wrote inside a worktree (review tests, experiment scripts) — their paths too.
- Sessions this work started (when the app provides session tools: the linked list from `list_sessions`).
- Files in scratch or temp folders — especially files holding passwords or tokens.

## 2. Inspect current state (read-only)

```bash
node "${CLAUDE_SKILL_DIR}/scripts/inventory.mjs" --mine <compose project>... --repo <repo>...
```

- git: worktrees (clean or not), branches (merged into the default branch, upstream gone).
- Docker: containers (MINE marker; `recreatable` if the compose files remain, `compose-files-missing` if not; running containers without a restart policy), volume classes (`MINE`, `MINE-DATA`, `CACHE`, `CACHE-ATTACHED`, `DATA`, `IN-USE`, `UNKNOWN`) and sizes, my images and dangling images, my networks.
- Windows: `docker_data.vhdx` size, what Docker actually uses, what compaction could reclaim, host drive capacity and free space, the compaction threshold (step 5), and whether it is exceeded (`PROPOSE`).
- `--json` prints the same as JSON. The script deletes nothing.

Name-based classes are guesses. Even a `CACHE` with an ambiguous name (`app-data-cache` …) is treated as data and asked about.

## 3. Clean up — what this work created

Order matters: stop the user of a thing before deleting the thing.

1. **Jobs and processes**: stop leftover background jobs and in-container commands.
2. **Sessions**: if sessions this work started are finished, suggest archiving them. Sessions are records the user can reopen, so never delete them; archive only after the user confirms.
3. **git**
   - Worktrees: if clean, `git worktree remove <path>`. With uncommitted changes, do not remove; tell the user. Exception: a worktree this work created whose `git -C <path> status --short` shows only the throwaway files recorded in step 1 (pr-reviewer's review tests etc.) → `git worktree remove --force <path>`. Any unknown change → do not remove.
   - Local branches: confirm the PR merged — squash and rebase merges do not show in `git branch --merged`, so use `gh pr view <branch> --json state`. If `MERGED` and not checked out, `git branch -D <branch>`. If checked out, switch to the default branch, update it, then delete. If the working tree has user edits, tell the user before switching.
   - Remote branches: if the repo did not auto-delete on merge and the PR merged, ask once whether to delete (others can see it).
4. **Check the recreate method**: before removing my stack, check a command to bring the same environment back remains — `test_env.setup` in the repo's `.claude/github-issue.yml`, the README, or the commands this work used. If the repo records none, suggest a `test_env` entry from the commands this work used (ask the user before editing the file). Include short override files that lived only in scratch (`noports.yml` …) in that suggestion. Remove this work's stack even without a known command, but say "no recreate method" in the report.
5. **Stop started containers**: stop the "started" containers from step 1 with `docker stop <name>`. Do not remove them (they belong to other work).
6. **Docker (my stack)**: delete by explicit name.
   ```bash
   docker compose -p <name> -f <compose file> down -v --rmi local   # containers, networks, volumes, built images
   ```
   If `down` fails because the compose file or env vars are missing, pass names one by one to `docker container rm`, `docker volume rm`, `docker image rm`, `docker network rm`. Remove `MINE-DATA` only when it is this work's temp DB (confirm from the conversation).
7. **Temp files**: delete password/token files and temp scripts this work created (after `down` if it needs them).

Never use commands whose scope is not set by name, like `docker system prune -a --volumes` — they also delete other projects' DBs that are merely stopped.

## 4. Leftovers of other work — ask, then clean

Show `CACHE` (no container using it), dangling images and build cache with sizes in one go and ask. Only what is needed to decide: name, size, which project (compose label, working folder), and what gets slower if deleted (next build from scratch).

Never recommend deleting `DATA`, `UNKNOWN` or release image tags. If disk is truly short, report sizes only and delete when the user names them.

**When the user widens the scope** ("all other sessions are done", "clean up everything unused"): delete what can be recreated without asking.
- `CACHE` volumes, dangling images, build cache.
- **Stopped and `recreatable`** containers of other projects, and `CACHE-ATTACHED` volumes attached only to them. The compose files remain, so the next `up` recreates them (builds start from scratch).
- `compose-files-missing` containers cannot be recreated — ask.
- Even in the widened scope, never delete running containers, `DATA`/`UNKNOWN`/`MINE-DATA` (other than this work's) volumes, or release image tags.

## 5. WSL disk compaction (Windows Docker Desktop)

`docker_data.vhdx` only grows. Deleting volumes frees space inside Docker but not on the Windows disk.

- **The threshold scales with the host disk**: compaction stops every container, so it is worth it only when it reclaims a meaningful amount. Drive capacity ≤256GB: expected reclaim 20GB; ≤512GB: 50GB; larger: 10% of capacity. inventory computes the threshold and `PROPOSE`. If cleanup will delete more, add it and decide again (re-running inventory after deleting is exact).
- Above the threshold, propose; below, report the numbers only. But if drive free space is under 10%, or the user asked directly ("shrink the disk"), plan it regardless of the threshold.
- When proposing, state: expected reclaim, that **all running containers stop for a few minutes** (list them — those stopped in step 3 drop out), and that the user must click "Yes" in a UAC prompt. Compact after the step 3 and 4 cleanup.
- If the user agrees:
  ```powershell
  powershell -NoProfile -ExecutionPolicy Bypass -File "${CLAUDE_SKILL_DIR}/scripts/compact-vhdx.ps1"
  ```
  `-DryRun` shows only the target and the containers that would stop. The script runs fstrim → quits Docker Desktop → `wsl --shutdown` → `diskpart compact vdisk` (UAC) → starts Docker Desktop → restarts containers that did not come back for lack of a restart policy → prints sizes before and after. It takes minutes, so run it in the background and read the result when done.
- Afterwards re-run the step 2 script and confirm the containers are up as before.

When the Docker engine does not respond (`docker ps` hangs or returns 500), memory is often short. Check and report `memory` in `%USERPROFILE%\.wslconfig`; whether to edit that file is the user's call (it is a system setting).

## 6. Report

Finish with three short groups.

- **Deleted**: names by kind and space reclaimed (Docker `system df` before/after, vhdx before/after, C: free space).
- **Kept and why**: data volumes, other projects' stacks, worktrees with uncommitted changes, etc.
- **Questions**: the step 4 list, remote branches, session archiving, vhdx compaction — only those not yet answered.

Do not hide what could not be deleted (permissions, locks, unresponsive engine); say what remained and why.
