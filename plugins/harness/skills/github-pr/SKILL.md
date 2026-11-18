---
name: github-pr
description: 이슈 하나를 PR 하나로 올린다 — 작업 단위 커밋, diff 확인, 이슈 제목과 같은 PR 제목, 커밋 요약 + 검증 + Closes 본문. 사용자가 "PR 만들어/올려/생성해", "커밋하고 PR", "작업 마무리해서 올려" 라고 하거나 이슈 작업을 끝내고 올릴 때 쓴다. 이슈가 없으면 먼저 github-issue 스킬로 만든다.
---

# GitHub PR

One PR = one issue. The real work is the implementation and reading the diff; the PR body does not restate the issue, it only summarizes the commits.

Output language: PR titles and bodies follow the repo setting `language` in `.claude/github-issue.yml` (if missing, the user's language). Commit messages follow §2.

## 1. Before pushing
- Confirm the issue ID and number (title `[ID] summary`). For another repo's issue use `owner/repo#N`.
- Branch: `<type>/<id-lowercase>-<english-kebab-summary>` (e.g. `refactor/order-002-remove-v1-order`). If the session started on a tool-made branch (`claude/…` etc.), rename it with `git branch -m` before the first push. Never commit directly to the default branch.
- Run the repo's `verify` from `.claude/github-issue.yml` (if missing, the verify commands in the repo docs) and make it pass. If `code_order` exists, also run `node ${CLAUDE_SKILL_DIR}/../code-order/scripts/<lang>.mjs <paths...>` per language (must exit 0; on 1, reorder with the code-order skill and keep it as a separate `style:` commit). If some check cannot run, ask the user first (implement skill §1.5); if you push with partial verification, open a draft PR.
- **Read the diff yourself**: `git status`, `git diff --stat`, the full `git diff`. Look for unintended changes (secrets, `.env`, temp files, format-only files, other work).
- If the repo requires review before committing (CLAUDE.md etc.), show the change and commit after approval.

## 2. Commits

Conventional Commits plus the issue ID — so `git log --oneline` alone shows the kind and the issue.

```text
<type>: <summary> (<issue ID>)

<body — why it changed and what is different. The diff shows what was done>

Refs #<issue number>
<trailers the repo or environment requires (Co-Authored-By etc.)>
```

- `type`: `feat` (feature) · `fix` (bug) · `refactor` (structure change or removal, same behavior) · `test` (tests only) · `docs` (docs only) · `build` (dependencies, build, Docker) · `chore` (dev environment, config, scripts). Changing behavior makes it `feat`/`fix`, not `refactor`.
- Summary: imperative, at most 72 characters, no trailing period. Language follows the repo's existing commits (English if none).
- Link the issue with `Refs #N` only — `Closes` goes in the PR body (so the issue does not close the moment a commit reaches the default branch).
- One commit per unit of work; moves and edits in separate commits. Several commits per PR is normal.
- Add files by path (no `git add -A` / `git add .`). For renames add both paths (`git add -A <old> <new>`). Check `git diff --cached --stat` before committing.

## 3. Creating the PR
- Title = the issue title exactly (`[ID] summary`) — 1:1 with the issue.
- Body from [assets/pr-template.md](assets/pr-template.md): per-commit summary, verification results, issue link. Do not restate the issue's background or decisions.
- Issue link: `Closes #N` if this PR finishes all of the issue's work and no review item is open, otherwise `Refs #N`.
- Write the body to a temp file and run `gh pr create -R <repo> --base <default branch> --title "<issue title>" --body-file <tmp>`.
- If a PR already exists, push more commits and align it with `gh pr edit --title/--body-file`.

## 4. After pushing
- If the default branch moved ahead and conflicts, merge the default branch instead of force-pushing, then re-run verify. If you must build on a prerequisite PR's branch, merge that branch (no rebase, no force push).
- When merging several PRs in order: after each merge, merge the default branch into the next PR, re-run verify, then merge. Before merging a PR with migrations, verify generated files against a DB with those migrations applied (`cargo sqlx prepare --check` etc.); if the repo uses a shared dev DB, apply the migration there right after merging so other sessions share the same baseline.
- Address review feedback in new commits. Merge only when the user asks.
- Tell the user the PR link (`[owner/repo#N](URL)`) and what could not be verified.
