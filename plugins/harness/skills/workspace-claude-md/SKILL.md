---
name: workspace-claude-md
description: 여러 git 저장소를 한 폴더에서 다루는 프로젝트(워크스페이스)의 CLAUDE.md 를 만들거나 다시 맞춘다 — 루트 CLAUDE.md(폴더·저장소 지도, 문서 우선순위, 수정 범위, Docker 개발·테스트 환경, 작업 방식)와 저장소별 CLAUDE.md(스택·구조·명령). 구조 파악 스크립트로 저장소·스택·docs 트리를 먼저 읽고, 적은 경로가 실제로 있는지 검사한다. 신규 서비스(프로토타입 포함), 기존 시스템 재공학·업그레이드, 마이그레이션, 리팩토링 프로젝트에 쓴다. 사용자가 "CLAUDE.md 만들어/작성/정리/업데이트해", "프로젝트 셋업", "새 프로젝트 시작", "워크스페이스 구조 정리", "폴더 구조 파악해", "레포 여러 개 관리", "frontend·backend 저장소 나눠서 시작" 이라고 하거나, 새 세션이 프로젝트 구조를 매번 다시 찾고 있을 때, CLAUDE.md 의 경로·명령이 실제와 달라졌을 때 이 스킬을 쓴다. 저장소 하나짜리 프로젝트에서 그 저장소 CLAUDE.md 만 쓸 때도 §5 를 따른다.
---

# 워크스페이스 CLAUDE.md

목표: 새 세션이 **CLAUDE.md 만 읽고** 어느 폴더가 무엇이고, 어떤 문서를 믿고, 어디를 고치고, 테스트를 어떻게 돌리는지 바로 아는 것. 세션은 이전 대화를 모르므로, CLAUDE.md 에 없는 사실은 매번 다시 찾거나 틀리게 추측한다.

CLAUDE.md 는 매 세션 맥락에 들어간다. 그래서 **짧고, 사실이고, 가리키기만** 한다: 명세·설계 내용은 `docs/` 에 두고 CLAUDE.md 는 그 위치와 우선순위만 적는다. 루트는 대략 150줄, 저장소별은 200줄 안쪽을 목표로 한다.

흐름: **지도 → 읽기 → 분류 → 결정 확인 → 환경 확인 → 쓰기 → 검사**

## 1. 지도 — 구조 파악 스크립트

```bash
node "${CLAUDE_SKILL_DIR}/scripts/workspace-map.mjs" <워크스페이스 루트>
```

읽기만 한다(Node 18+, 의존성 없음). 마크다운으로:

- 폴더 표: 어느 폴더가 git 저장소인지(하위 저장소 포함), `origin`(토큰은 지움)·현재 브랜치, 스택(`Cargo.toml`·`package.json`·`pyproject.toml`·Gradle/Maven 의 주요 의존성과 스크립트), 개발·테스트 파일(compose·Dockerfile·`.env.example`·`.claude/github-issue.yml`·CI·CLAUDE.md·README).
- `docs/`·`analysis/` 트리: md 마다 첫 제목, 같은 확장자가 많으면 `*.sql × 12 (첫 … 끝)` 로 접는다. `--depth N` 으로 깊이를 바꾼다(기본 3).
- 경고: CRLF 셸 스크립트(리눅스 컨테이너에서 `set: Illegal option -` 으로 바로 실패한다).
- `--json` 은 같은 내용을 JSON 으로.

`.env` 는 있는지만 표시하고 **읽지 않는다.** 값이 필요하면 `.env.example` 의 키 이름만 쓴다.

스크립트 테스트: `node --test ${CLAUDE_SKILL_DIR}/scripts/workspace-map.test.mjs`. 스크립트를 바꾸면 테스트도 같이 바꾼다.

## 2. 읽기

스크립트가 보여 준 것 중에서 읽는다:

- 이미 있는 CLAUDE.md(루트·저장소별), README, `.claude/` 아래 설정·명령·규칙 문서(`github-issue.yml` 의 `verify` 는 그대로 명령의 근거가 된다).
- `docs/` 의 제품·설계·운영 문서 머리(버전 줄, 목차), `analysis/` 가 있으면 그 목적.
- compose·Dockerfile·`package.json` scripts — 문서보다 이쪽이 실제 명령이다.

이미 CLAUDE.md 가 있으면 **새로 쓰지 않고 고친다.** 사용자가 쌓은 규칙(작업 방식, 금지 사항, 결정)은 남기고, 낡은 경로·명령만 바꾼다. 무엇을 바꿨는지 마지막에 보고한다.

## 3. 분류 — 프로젝트 종류

[references/project-types.md](references/project-types.md) 에서 고른다. 종류에 따라 문서 우선순위와 수정 범위가 달라진다:

| 종류 | 표시 | 핵심 |
|---|---|---|
| 신규 서비스 | 기존 코드 없음, `docs/product` 가 기준 | 목(mock) 먼저, 결정 안 된 것은 결정 필요로 |
| 재공학·업그레이드 | 기존 시스템 폴더(Spring·PHP·Python 등) + `analysis/` | 기존 코드는 읽기 전용, As-is(`analysis/`)와 To-be(`docs/`) 분리 |
| 마이그레이션 | 운영 DB 사본, 마이그레이션 SQL, 이전 절차 문서 | 운영 영향 확인, 적용 기록·절차 |
| 리팩토링 | 같은 스택, 동작 보존 | 기준선 테스트 수, 범위 밖 변경 금지 |

섞여 있으면(재공학 + 마이그레이션) 둘 다 적는다. 판단이 안 서면 사용자에게 한 번 묻는다.

## 4. 결정 확인 — 스택

- **백엔드는 고정 프리셋**: Rust + Axum + SQLx + PostgreSQL, 테스트는 Docker. 틀은 [references/backend-rust.md](references/backend-rust.md). AI·LLM 호출도 Axum 서비스 안에서 어댑터로 구현한다(별도 Python 서버를 두지 않는다). 기존 저장소가 다른 스택이면 그 스택을 그대로 적는다 — 프리셋은 새로 만드는 저장소에만 쓴다.
- **프론트엔드는 요구사항으로 고른다**: frontend 스킬의 `${CLAUDE_SKILL_DIR}/../frontend/references/presets.md` 질문(SEO·AEO, 배포 위치, PWA, 관리자/공개 화면)으로 Vite SPA(기본)와 Next.js(정적 배포) 중 제안하고 사용자가 정한다. 프론트엔드 저장소 CLAUDE.md 틀도 그 파일 끝에 있다. 화면 구현 규칙은 CLAUDE.md 에 옮겨 쓰지 않고 `harness:frontend` 스킬을 가리킨다.
- 이미 저장소가 있으면 스크립트가 찾은 실제 의존성이 문서보다 우선이다. 문서와 다르면 둘 다 적지 말고 사용자에게 알린다.
- 정해지지 않은 것은 CLAUDE.md 에 `TBD — <누가/언제 정하나>` 로 남긴다. 추측으로 채우면 다음 세션이 결정된 것으로 읽는다.

## 5. 환경 확인 — Docker 개발·테스트

[references/docker-dev.md](references/docker-dev.md). CLAUDE.md 의 명령은 **이 컴퓨터에서 실제로 돌아가는 것**이어야 한다:

1. 호스트 도구 확인: `cargo --version`, `node --version`, `pnpm --version`, `docker version`. Rust 가 없으면 Docker 명령으로 적는다(이 사용자는 기본이 Docker).
2. 저장소마다 `verify`(또는 build·test) 를 한 번 돌려 본다. 오래 걸리면 백그라운드로. 못 돌린 명령은 CLAUDE.md 에 `(확인 안 됨: <이유>)` 를 붙이고 보고한다.
3. 작업별로 만든 컨테이너·볼륨을 지울 수 있게 이름 규칙(compose `-p <작업 id>`)을 적는다. 정리 절차 자체는 harness `cleanup` 스킬이 맡는다 — CLAUDE.md 에는 규칙과 그 스킬 이름만.
4. 운영 데이터가 든 DB, 실제 외부 API(결제·메시지·판매 채널)를 부르는 경로가 있으면 "호출 전 사용자 확인"을 적는다.

## 6. 쓰기

틀: 루트는 [references/root-template.md](references/root-template.md), 백엔드는 [references/backend-rust.md](references/backend-rust.md), 프론트엔드는 frontend 스킬의 `references/presets.md` 끝.

- **언어: CLAUDE.md 본문은 영어.** 코드 식별자·경로·명령·ID 는 그대로. `docs/` 문서의 언어 규칙(보통 한국어)은 CLAUDE.md 의 Documentation 절에 따로 적는다. 사용자가 다른 언어를 말하면 그쪽.
- **폴더 구조는 트리 + 표**: 스크립트 출력을 그대로 붙이지 말고, 사람이 고른 줄만 남겨 한 줄 주석을 단다. 폴더마다 "git 저장소(owner/name) / 아님", 역할, 읽기 전용 여부. 루트가 git 저장소가 아니면 첫 줄에 쓴다 — 루트에서 `git` 명령이 실패하는 이유가 된다.
- **가리키기**: 명세·설계·결정은 문서 경로로. 같은 내용을 두 곳에 쓰면 한쪽이 낡는다.
- **명령은 복사해 바로 돌릴 수 있게**: 작업 폴더, 필요한 환경변수 이름, Windows Git Bash 주의(`MSYS_NO_PATHCONV=1`)까지.
- **이유 한 줄**: 금지 규칙에는 이유를 붙인다(예: "적용한 마이그레이션은 고치지 않는다 — sqlx 체크섬이 거부한다"). 이유가 있어야 다음 세션이 예외 상황을 판단한다.
- 비밀값·계정·토큰·내부 IP 는 쓰지 않는다. 키 이름과 보관 위치(`.env`, SSM 경로 규칙)만.
- 저장소별 CLAUDE.md 는 그 저장소에 커밋되는 파일이다. 저장소 밖(루트·형제 저장소) 경로는 "워크스페이스 기준"이라고 밝힌다 — 그 저장소만 클론한 사람에게는 없다.

## 7. 검사

```bash
node "${CLAUDE_SKILL_DIR}/scripts/workspace-map.mjs" <루트> --check CLAUDE.md
node "${CLAUDE_SKILL_DIR}/scripts/workspace-map.mjs" <루트> --check <저장소>/CLAUDE.md
```

백틱 안 경로 중 워크스페이스 어디에도 없는 것을 보여 준다(컨테이너 경로·이미지 태그·자리표시자는 건너뜀). 하나씩 본다: 오타·옮겨진 경로면 고치고, 앞으로 만들 경로면 `(planned)` 를 붙인다.

그다음 스스로 확인한다:

- 새 세션이 "백엔드 테스트 돌려" 를 받았을 때 CLAUDE.md 만으로 명령을 찾을 수 있나.
- "이 문서와 저 문서가 다르다" 일 때 무엇을 따를지 쓰여 있나.
- 건드리면 안 되는 폴더가 이유와 함께 쓰여 있나.

## 8. 보고

사용자에게 짧게: 만든·고친 파일, 고른 프로젝트 종류와 스택, 실제로 돌려 본 명령과 못 돌린 명령, `TBD` 로 남긴 결정, `--check` 결과. 커밋은 사용자가 원할 때 — 저장소별 CLAUDE.md 는 그 저장소의 이슈·PR 흐름(github-issue·github-pr 스킬)을 따른다. 루트가 git 저장소가 아니면 루트 CLAUDE.md 는 커밋 대상이 없다고 알린다.

## 9. 다시 맞추기

이미 쓴 CLAUDE.md 를 최신으로 맞출 때는 §1 지도와 §7 검사만 먼저 돌리고, 달라진 부분만 고친다. 폴더를 옮기거나 저장소를 더한 작업의 PR 에서 함께 고치는 것이 가장 덜 낡는다.
