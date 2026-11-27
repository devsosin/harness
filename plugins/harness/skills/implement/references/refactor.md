# Refactoring and legacy removal

## Refactoring (structure change) — behavior stays the same

Common guide (CLEAN_ARCHITECTURE §6): a structure-only PR passes **the same tests, same count**, and every supported feature combination builds.

1. **Check coverage** — is the code you will move or change covered by tests? For uncovered behavior (especially API response shape, error codes, DB results), add a check that pins current behavior **before changing it** — a new test, or an assertion line on an existing test that already runs it (e.g. `assert_eq!(body["provider"], "aligo")`). Either way, confirm it **passes on the code before the change**, commit it separately, then refactor. It must still pass afterwards. List the newly pinned behaviors in the PR.
2. **Move in small steps** — one responsibility (one module, one type) at a time, running tests each time. Never mix moves and edits in one commit (so the reviewer can confirm "moved only" in the diff).
   - Rust: after a move or rename, if rust-analyzer is installed, use its find references (LSP) on the moved or renamed item to confirm no old path is left; then grep for what LSP cannot see (macro input, SQL files, docs). Same for each symbol in legacy removal step 1.
3. **Move tests along** — tests move with their code. Do not delete tests or weaken assertions. If one must change, give the reason in the commit message and the PR.
4. **Pin serialized values** — when turning strings into enums, test that values going to the API and DB do not change (serde names, DB mapping).
5. **Verification bar** — same test names and count as the baseline (plus the characterization tests you added). If a file stays over ~250 lines, explain why in the PR.

## Legacy removal — remove only what is being removed

1. **Find every reference** — search the whole repo for the symbols, paths, columns, env vars and config keys being removed (`grep -rn` over code, tests, migrations, check scripts, docs, Docker, CI). The issue's "Target" list is a starting point and may not be complete.
2. **Impact on other repos** — if you remove API response fields or paths, check the clients that read them (the issue's related issues, other repos). If the issue has a deploy order, note it in the PR's "Notes".
3. **Tests**
   - Delete tests that checked the removed behavior — list their names in the PR (so the reviewer can confirm each deletion was intended).
   - Add tests proving it is gone (e.g. removed path → 404, field absent from response).
   - Tests of remaining behavior (shared code) must still pass.
4. **DB** — drop columns and constraints in a new migration file per the repo's rules. Drop only after the code no longer reads or writes the column (an older version may still run during deploy). If there is a production data condition (e.g. "after confirming 0 rows"), put a check query in the migration or leave it as a user review item on the issue.
5. **Dependencies** — remove libraries and build settings no longer used (e.g. `Cargo.toml` dependencies, profiles) and update the lock file.
6. **Docs** — fix the parts of the README, plan docs and comments that describe what was removed; if a plan doc has a change log, add a line.
7. **Verification bar** — tests fewer than the baseline = tests deliberately deleted; tests added = removal checks. `grep` for the removed symbols finds nothing left (except intended places).
