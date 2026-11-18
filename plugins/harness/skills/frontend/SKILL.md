---
name: frontend
description: React(TypeScript) 프론트엔드 저장소를 만들거나 그 안에서 화면·기능을 구현할 때의 공통 절차와 규칙 — 프레임워크 프리셋 고르기(기본 Vite SPA + TanStack Router/Query, SEO·AEO 가 필요하면 Next.js App Router 정적 배포), 폴더 구조, API 클라이언트·인증 쿠키·CSRF, MSW 목으로 백엔드 없이 먼저 만들기, 화면 상태(로딩·빈·오류), 폼 검증, 접근성, 테스트(Vitest·RTL·Playwright), PWA, SEO·AEO. 사용자가 "프론트 시작/셋업", "새 React 프로젝트", "화면 만들어/구현해", "페이지 추가", "API 연결", "목 API", "MSW", "PWA", "뒤로가기 누르면 종료", "하단 탭", "SEO", "검색 노출", "AI 답변에 노출", "AEO", "Search Console 등록", "robots.txt", "Vite 냐 Next 냐" 라고 하거나, `package.json` 에 react 가 있는 저장소에서 UI 코드를 고칠 때 이 스킬을 쓴다. 이슈 구현(implement 스킬) 중 대상이 프론트엔드면 implement 의 언어 가이드 대신 이 스킬의 규칙을 함께 읽는다.
---

# 프론트엔드

대상: React + TypeScript 웹 앱(관리자 화면, 서비스 화면, PWA). 데이터는 언제나 백엔드 API(기본 Rust/Axum)로 오가고, 브라우저는 DB 나 외부 서비스 비밀키에 직접 닿지 않는다.

규칙의 대부분은 프레임워크와 무관하다. 프레임워크마다 다른 것(라우팅, 빌드·배포, 서버/클라이언트 경계)만 references 의 프레임워크 파일에 있다. 저장소의 CLAUDE.md·README 가 이 스킬보다 우선한다.

## 0. 어느 파일을 읽나

| 상황 | 읽을 것 |
|---|---|
| 새 저장소, 스택 고르기 | [references/presets.md](references/presets.md) → 고른 프레임워크 파일 |
| Vite SPA 저장소 작업 | [references/vite-spa.md](references/vite-spa.md) |
| Next.js 저장소 작업 | [references/nextjs.md](references/nextjs.md) |
| API 연결·인증·목 | [references/api-and-mocks.md](references/api-and-mocks.md) |
| 테스트 작성·실행 | [references/testing.md](references/testing.md) |
| PWA(설치, 오프라인, 업데이트, 뒤로가기) | [references/pwa.md](references/pwa.md) |
| 공개 화면의 검색·AI 답변 노출 | [references/seo-aeo.md](references/seo-aeo.md) |

저장소가 어느 쪽인지는 `package.json` 으로 안다: `next` 가 있으면 Next.js, `vite` + `@tanstack/react-router` 면 Vite SPA.

## 1. 새 저장소 셋업

1. **프리셋 고르기**: presets.md 의 질문(공개 화면·SEO/AEO, 배포 위치, PWA, 관리자 전용 여부)을 사용자 요구사항에 대 보고 하나를 제안한다. 사용자가 정한다. 답이 없는 항목은 `TBD` 로 남긴다.
2. **버전**: 설치 시점의 안정 버전을 쓰고 `packageManager`(pnpm)와 Node LTS 를 고정한다. 호환이 깨지는 조합(ESLint 플러그인과 TypeScript 메이저 등)은 고정하고 이유를 CLAUDE.md 에 적는다.
3. **뼈대 순서**: 도구(TS strict, ESLint flat config, Prettier, Vitest, Playwright) → 디자인 토큰 → 공통 컴포넌트 → API 클라이언트·에러 매핑 → 인증 흐름 → MSW → 첫 화면. 앞의 것이 없으면 화면마다 다르게 만들어진다.
4. **CLAUDE.md**: 저장소 CLAUDE.md 에 Product·Stack·Structure·API & Mocking·UI·Testing·Commands 를 쓴다(틀은 presets.md 끝). 워크스페이스 루트 CLAUDE.md 는 `workspace-claude-md` 스킬.
5. **검사 명령**을 `.claude/github-issue.yml` 의 `verify` 에 넣는다: `pnpm typecheck`, `pnpm lint`, `pnpm test` (+ 필요하면 `pnpm build`).

## 2. 화면·기능 구현 절차

1. **근거 읽기**: 화면 설계 문서(`docs/design/pages/…`, "사용 컴포넌트" 표), 기능 명세, API 명세. 명세에 없는 동작은 정하지 않는다 — 묻거나, 문서의 제안안대로 하고 열린 이슈로 남긴다.
2. **계약 먼저**: 필요한 API 의 요청·응답 타입을 `src/lib/api/` 에 명세에서 옮긴다. 명세에 없는 필드가 필요하면 클라이언트에서 지어내지 말고 API 명세 변경을 제안한다.
3. **목**: MSW 핸들러와 픽스처 — 성공·빈 결과·검증 오류·401/403·404·409·429·500 시나리오.
4. **화면**: 공통 컴포넌트로 조립한다. 데스크톱 → 태블릿 → 모바일 순으로 같은 라우트 안에서.
5. **테스트**: 상호작용 테스트(MSW 위), 핵심 흐름은 Playwright.
6. **검사**: typecheck·lint·test 를 돌리고 결과를 보고한다. 실제 백엔드와 붙여 본 것과 목으로만 확인한 것을 구분해서 말한다.

## 3. 공통 규칙

### 구조와 책임
- `src/components/` = 디자인 문서의 공통 컴포넌트와 1:1. 페이지 안에서 기본 컴포넌트를 다시 꾸미지 않는다 — 같은 버튼이 화면마다 달라진다.
- `src/features/<area>/` = 영역별 UI·훅·API 어댑터. 영역끼리 직접 import 하지 않고 공통은 `components`·`lib` 로 올린다.
- 컴포넌트는 그리기와 상호작용만. API 호출·비즈니스 규칙은 훅·어댑터로.
- 서버 상태는 TanStack Query, UI 상태는 Zustand(또는 컴포넌트 상태). 서버 데이터를 Zustand 에 복사하지 않는다 — 두 사본이 어긋난다.
- 필터·페이지·정렬은 URL search params 에 둔다(새로고침·공유·뒤로가기가 그대로 동작).

### 화면 상태
- 데이터가 있는 모든 영역에 로딩·빈·오류·성공 상태. 버튼은 진행 중 비활성화와 중복 제출 방지.
- 파괴적 동작은 확인 대화상자, 일괄 작업은 결과 보고(성공 n·실패 n·이유).
- 날짜·시간은 표시 시간대(예: KST)를 명시하고 `Intl` 로 포맷.

### 폼
- React Hook Form + Zod. 같은 Zod 스키마로 search params 도 검증.
- 서버의 `fieldErrors` 를 해당 필드에 붙인다. 클라이언트 검증은 보조이고 서버가 최종이다.

### 접근성
- 의미 있는 HTML, 키보드로 모든 동작, 보이는 포커스, 상태를 색만으로 전달하지 않기, 대화상자 포커스 가두기·복귀. 헤드리스 접근성 라이브러리(React Aria Components)를 쓰면 대부분 따라온다.

### 보안
- 토큰은 `HttpOnly` 쿠키 — JS 에서 읽지도 저장하지도 기록하지도 않는다. 상태를 바꾸는 요청에 CSRF 헤더.
- 사용자 입력을 HTML 로 렌더하지 않는다(`dangerouslySetInnerHTML` 금지, 미리보기도 텍스트로).
- 메뉴 숨기기는 편의일 뿐 권한이 아니다 — 서버가 막는다.
- 비밀키는 클라이언트 번들에 넣지 않는다. `VITE_*`·`NEXT_PUBLIC_*` 는 공개값이다.
- 쓰기 전용 값(외부 서비스 키 등)은 제출 후 화면·상태에 남기지 않는다.

### 텍스트
- UI 문구는 서비스 언어(보통 한국어). 코드·식별자는 영어.

### PWA (요점 — 자세히는 pwa.md)
- 서비스 워커는 앱 셸만 캐시하고 `/api` 응답은 절대 캐시하지 않는다(공용 기기에서 앞 사람 데이터가 보인다). 업데이트는 자동 새로고침 대신 [새로고침] 안내.
- 안드로이드 설치 앱의 뒤로가기: 홈과 하단 탭 화면(그리고 제품이 지정한 화면)은 `EXIT_ROUTES` 한 곳에 두고, 그 화면에서 뒤로가기 → "한 번 더 누르면 종료" 팝업 → 한 번 더 → 종료. 하단 탭 이동은 `replace` 라서 어느 탭에서든 같은 팝업이 뜬다. 구현은 CloseWatcher(라우터 history 를 건드리지 않음). iOS 에는 넣지 않는다.

### 공개 페이지 노출 (요점 — 자세히는 seo-aeo.md)
- 순서가 중요하다: ① 서버에서 만든 HTML 에 본문·메타가 있게(Next.js 정적) ② `robots.txt` 에서 검색용 봇(OAI-SearchBot·PerplexityBot·Claude-SearchBot·Yeti)을 막지 않기, CDN 의 AI 봇 차단 확인 ③ sitemap + Search Console·Bing Webmaster·Naver Search Advisor 등록. ①②가 없으면 ③만으로는 인용되지 않는다. `llms.txt` 는 필요 없다.

## 4. 하지 않는 것

- 테스트를 통과시키려고 단언을 약하게 바꾸기.
- 목을 운영 빌드에 넣거나, API 실패 시 목으로 조용히 대체하기.
- 화면 하나를 위해 공통 컴포넌트를 복사해 고치기 — 공통 컴포넌트를 고치고 "사용 화면"을 확인한다.
- 명세에 없는 API 필드·엔드포인트를 클라이언트에서 가정하기.
