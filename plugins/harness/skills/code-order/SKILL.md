---
name: code-order
description: 파일 안 최상위 항목 순서를 언어별 규칙(Rust: mod → use → const → 타입별 정의·impl·그 impl 이 쓰는 함수 → 테스트)대로 확인·정렬한다. 사용자가 "코드 순서 맞춰/정렬해", "파일 안 순서 정리", "item order 확인", "impl 을 struct 옆으로" 라고 하거나, 리팩토링·파일 분리 뒤 순서가 섞였을 때, PR 전 정리할 때 쓴다.
---

# Code order

The rules are the "Item order" section of `${CLAUDE_SKILL_DIR}/../../docs/<lang>/CODE_STYLE.md`. The script only moves whole items and never changes their text (it checks that the same characters remain). Only Rust exists for now: `scripts/rust.mjs` (Node 18+, no dependencies).

Output language: reports to the user follow the user's language.

## 1. Check
If the repo's `.claude/github-issue.yml` has `code_order` (language → paths), use those paths. implement, github-pr and pr-reviewer run the same check from the same setting.
```bash
node ${CLAUDE_SKILL_DIR}/scripts/rust.mjs src examples tests
```
- Exit code: 0 = all in order, 1 = files to reorder (listed), 2 = unreadable files (`skipped: file: reason`).
- `skipped` means top-level syntax the script does not know. It never guesses, so check that file by hand or fix the script.

## 2. Reorder
```bash
node ${CLAUDE_SKILL_DIR}/scripts/rust.mjs --write src examples tests
cargo fmt
node ${CLAUDE_SKILL_DIR}/scripts/rust.mjs src examples tests   # must be 0
```
- Run on a clean working tree and keep **the reorder alone in one commit** (`style: reorder items (<issue ID>)`). Never mix it with behavior changes — the reviewer must be able to see "moves only" in the diff.
- Re-run the repo's `verify` (build, tests). Check the warning count is unchanged.
- **Compiling beats ordering.** If the build breaks after reordering, do not hand-revert that file as an exception; fix the script's rules (with tests). Position-sensitive items such as macros are the usual cause — `macro_rules!` is only visible below its definition.
- Look at the scope with `git diff --stat` and read the diff of a few heavily moved files. Fix by hand any comment that landed on the wrong item.
- Section comments (a plain comment followed by a blank line, e.g. `// ---------- carriers ----------`) stay in place; sorting happens only inside each section. A comment directly above an item (no blank line) moves with that item. A section comment without a following blank line is treated as an item comment, so add the blank line before sorting.

## 3. Judgment calls
- A file with several unrelated types needs splitting more than ordering (split rules in `CLEAN_ARCHITECTURE.md`). A file with several section comments: consider splitting by section first.
- A function used by several types goes after the first type that uses it. If it is shared, suggest moving it to its own file.
- Script tests: `node --test ${CLAUDE_SKILL_DIR}/scripts/rust.test.mjs`. Change the tests together with the rules.
