# Repo config `.claude/github-issue.yml`

Holds the rules that differ per repo. It lives at the repo root as `.claude/github-issue.yml` and is committed to that repo. If missing, the skill asks the user and creates it on first use (SKILL.md §1).

Every key is optional; missing keys use the defaults. Values (label descriptions, `when` text) are written in the repo's language.

```yaml
# Repo to create issues in. Default: `git remote get-url origin` of this folder.
repo: owner/name

# Language of issues, PRs and reports (ko, en …). Default: the repo docs' language.
language: ko

# Title format, using {id} and {summary}.
title_format: "[{id}] {summary}"

# ID prefixes. Empty ([]) means no ID in titles.
id_prefixes: [AUTH, ORDER, ERROR]

# Body template path (from the repo root). Default: .github/ISSUE_TEMPLATE/ or the skill's template.
# template: .github/ISSUE_TEMPLATE/task.md

labels:
  # Type labels — one per issue.
  type: [bug, enhancement, documentation]
  # Area labels — added when `when` matches. color is 6-digit hex (no #).
  areas:
    - name: "area:auth"
      color: 1d76db
      description: 인증
      when: src/auth/ 가 대상일 때
  # Issues with open user review items. Delete the key to not use it.
  review:
    name: needs-review
    color: d93f0b
    description: 사용자 검토·결정이 필요한 항목이 있음
  # Issues the user put on hold.
  on_hold:
    name: "status:on-hold"
    color: bfbfbf
    description: 사용자 결정으로 보류

# Verify commands for "Done when" (optional). implement and github-pr run all of them before a PR.
# Rust: lints come from [lints] in Cargo.toml + clippy.toml (harness docs/rust/templates). Workspace: add --workspace to clippy and test.
verify:
  - cargo fmt --check
  - cargo clippy --all-targets -- -D warnings
  - cargo test

# In-file item order check (code-order skill, optional). Language → paths to check.
# implement, github-pr and pr-reviewer run it with host Node alongside verify (the installed plugin's script).
# code_order:
#   rust: [src, examples, tests]

# Environment needed to run verify (optional). implement runs `check` before implementing;
# on failure it shows `setup` and asks the user first (e.g. whether to continue with partial verification).
# cleanup also uses `setup` as proof that removed things can be recreated — per-issue temp stacks use the same command with `-p <issue ID>`.
# test_env:
#   needs: [PostgreSQL 16 (db in the dev compose), sqlx-cli 0.9]
#   setup: docker compose -f docker-compose.dev.yml up -d db
#   check: docker compose -f docker-compose.dev.yml exec -T db pg_isready
#   env: DATABASE_URL from .env (never print or commit the value)

# Path of an old issue file kept as an ID → GitHub number index (optional). New issues add a line too.
# index_file: docs/OPEN_ISSUES.md

# Date the user settled this config.
decided: 2026-01-01
```

## Syncing labels

Create config labels missing on GitHub. `--force` only updates color and description if the label exists.

```bash
gh label create "<name>" -R <repo> --color <hex> --description "<description>" --force
```

## Changing the config

To add or rename labels, confirm with the user, edit this file, then sync labels. Rename with `gh label edit "<old>" -R <repo> --name "<new>"` so issues keep the label.
