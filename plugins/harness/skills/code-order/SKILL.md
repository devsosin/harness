---
name: code-order
description: 파일 안 코드(최상위 항목) 순서를 언어별 규칙대로 확인·정렬한다 — Rust 는 mod → use(std / 외부 / crate / pub use) → const → 타입별(정의 → impl → 그 impl 이 쓰는 함수) → 테스트. 사용자가 "코드 순서 맞춰/정렬해", "파일 안 순서 정리", "item order 확인", "impl 을 struct 옆으로" 라고 하거나, 리팩토링·파일 분리 뒤 순서가 섞였을 때, PR 전 정리할 때 쓴다.
---

# 코드 순서

규칙은 언어 가이드 `${CLAUDE_SKILL_DIR}/../../docs/<lang>/CODE_STYLE.md` 의 "Item order" 절. 스크립트는 항목을 통째로 옮기기만 하고 내용은 바꾸지 않는다(같은 글자만 있는지 스스로 검사). 지금은 Rust 만 있다: `scripts/rust.mjs`(Node 18+, 의존성 없음).

## 1. 확인
```bash
node ${CLAUDE_SKILL_DIR}/scripts/rust.mjs src examples tests
```
- 종료 코드: 0 = 모두 순서대로, 1 = 옮길 파일 있음(목록 출력), 2 = 읽지 못한 파일 있음(`skipped: 파일: 이유`).
- `skipped` 는 스크립트가 모르는 최상위 문법이다. 추측해 옮기지 않으므로 그 파일은 손으로 보거나 스크립트를 고친다.

## 2. 정렬
```bash
node ${CLAUDE_SKILL_DIR}/scripts/rust.mjs --write src examples tests
cargo fmt
node ${CLAUDE_SKILL_DIR}/scripts/rust.mjs src examples tests   # 0 이어야 한다
```
- 작업 트리가 깨끗할 때 돌리고, **순서 정렬만 커밋 하나**로 둔다(`style: reorder items (<이슈 ID>)`). 기능 변경과 섞지 않는다 — 리뷰어가 "옮기기만 했다"를 diff 로 확인할 수 있어야 한다.
- 저장소 검증(`verify`: 빌드·테스트)을 다시 돌린다. 경고 수가 전과 같은지도 본다.
- `git diff --stat` 으로 범위를 보고, 크게 옮겨진 파일 몇 개는 diff 를 직접 읽는다. 주석이 엉뚱한 항목에 붙었으면(구역 구분 주석 등) 손으로 고친다.

## 3. 판단이 필요한 경우
- 한 파일에 타입이 여럿이고 서로 무관하면 순서보다 파일 분리가 맞다(`CLEAN_ARCHITECTURE.md` 의 나누는 규칙).
- 여러 타입이 쓰는 함수는 처음 쓰는 타입 뒤에 놓인다. 공용이면 별도 파일로 빼는 것을 제안한다.
- 스크립트 테스트: `node --test ${CLAUDE_SKILL_DIR}/scripts/rust.test.mjs`. 규칙을 바꾸면 테스트도 같이 바꾼다.
