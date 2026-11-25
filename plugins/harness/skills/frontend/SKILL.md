---
name: frontend
description: React(TypeScript) 프론트엔드 저장소를 만들거나 화면·기능을 구현할 때의 절차와 규칙(Vite SPA 또는 Next.js 정적, API·MSW 목, 화면 상태, 테스트, PWA, SEO·AEO). 사용자가 "프론트 시작/셋업", "새 React 프로젝트", "화면 만들어/구현해", "페이지 추가", "API 연결", "목 API", "MSW", "PWA", "뒤로가기 누르면 종료", "SEO", "검색 노출", "AEO", "robots.txt", "Vite 냐 Next 냐" 라고 하거나, react 저장소의 UI 코드를 고칠 때 쓴다. implement 중 대상이 프론트엔드일 때도 읽는다.
---

# Frontend

Scope: React + TypeScript web apps (admin screens, service screens, PWAs). Data always goes through the backend API (Rust/Axum by default); the browser never touches the DB or external service secrets directly.

Most rules are framework-independent. Only what differs per framework (routing, build and deploy, server/client boundary) is in the framework files under references. The repo's CLAUDE.md and README override this skill.

Output language: reports to the user follow the user's language; UI copy follows the service language (§3 Text).

## 0. What to read

| Situation | Read |
|---|---|
| New repo, choosing a stack | [references/presets.md](references/presets.md) → the chosen framework file |
| Working in a Vite SPA repo | [references/vite-spa.md](references/vite-spa.md) |
| Working in a Next.js repo | [references/nextjs.md](references/nextjs.md) |
| API wiring, auth, mocks | [references/api-and-mocks.md](references/api-and-mocks.md) |
| Run modes (mock / existing server / local compose), `.env.example`, deploy prep | the `harness:local-run` skill (`${CLAUDE_SKILL_DIR}/../local-run/SKILL.md`) |
| Writing and running tests | [references/testing.md](references/testing.md) |
| PWA (install, offline, updates, back button) | [references/pwa.md](references/pwa.md) |
| Search and AI-answer visibility of public pages | [references/seo-aeo.md](references/seo-aeo.md) |

`package.json` tells which repo it is: `next` → Next.js; `vite` + `@tanstack/react-router` → Vite SPA.

## 1. New repo setup

1. **Choose a preset**: match the questions in presets.md (public pages and SEO/AEO, deploy target, PWA, admin-only) against the user's requirements and propose one. The user decides. Unanswered items stay `TBD`.
2. **Versions**: use the stable versions at install time; pin `packageManager` (pnpm) and Node LTS. Pin combinations that break compatibility (ESLint plugins vs TypeScript major …) and give the reason in CLAUDE.md.
3. **Skeleton order**: tooling (TS strict, ESLint flat config, Prettier, Vitest, Playwright) → design tokens → shared components → API client and error mapping → auth flow → MSW → first screen. Skip an earlier step and every screen builds it differently. MSW is run mode 1; set up modes 2 and 3 with the `harness:local-run` skill.
4. **CLAUDE.md**: write Product, Stack, Structure, API & Mocking, UI, Testing, Commands in the repo's CLAUDE.md (template at the end of presets.md). The workspace root CLAUDE.md is the `workspace-claude-md` skill.
5. **Checks** go into `verify` in `.claude/github-issue.yml`: `pnpm typecheck`, `pnpm lint`, `pnpm test` (+ `pnpm build` if needed). Playwright setup (config template, `pnpm e2e`, CI) is in [references/testing.md](references/testing.md); add `pnpm e2e` to `verify` once the first critical flow has a spec.

## 2. Implementing a screen or feature

1. **Read the sources**: screen design docs (`docs/design/pages/…`, the "components used" table), feature spec, API spec. Do not invent behavior the spec lacks — ask, or follow the doc's proposal and leave an open issue.
2. **Contract first**: copy the needed request/response types from the spec into `src/lib/api/`. If a field the spec lacks is needed, propose an API spec change instead of inventing it on the client.
3. **Mocks**: MSW handlers and fixtures — success, empty, validation error, 401/403, 404, 409, 429, 500 scenarios.
4. **Screen**: assemble from shared components, desktop → tablet → mobile within the same route.
5. **Tests**: interaction tests (on MSW), key flows in Playwright.
6. **Checks**: run typecheck, lint and test and report results. Say separately what was tried against the real backend and what only against mocks.

## 3. Common rules

### Structure and responsibility
- `src/components/` = 1:1 with the shared components in the design docs. Do not restyle base components inside pages — the same button ends up different per screen.
- `src/features/<area>/` = UI, hooks and API adapters per area. Areas do not import each other directly; shared code moves up to `components` / `lib`.
- Components only render and handle interaction. API calls and business rules live in hooks and adapters.
- Server state in TanStack Query, UI state in Zustand (or component state). Never copy server data into Zustand — the two copies drift.
- Filters, pages and sorting live in URL search params (refresh, sharing and back keep working).

### Screen states
- Loading, empty, error and success states for every data region. Buttons disable while pending and prevent double submits.
- Destructive actions get a confirm dialog; bulk actions report results (n succeeded, n failed, reasons).
- Dates and times state the display time zone (e.g. KST) and are formatted with `Intl`.

### Forms
- React Hook Form + Zod. Validate search params with the same Zod schemas.
- Attach the server's `fieldErrors` to their fields. Client validation is a helper; the server is final.

### Accessibility
- Semantic HTML, every action by keyboard, visible focus, never convey state by color alone, trap and restore focus in dialogs. A headless accessibility library (React Aria Components) brings most of this.

### Security
- Tokens in `HttpOnly` cookies — JS never reads, stores or logs them. CSRF header on state-changing requests.
- Never render user input as HTML (no `dangerouslySetInnerHTML`; previews as text too).
- Hiding menus is convenience, not authorization — the server blocks.
- No secrets in the client bundle. `VITE_*` and `NEXT_PUBLIC_*` are public.
- Write-only values (external service keys …) do not stay on screen or in state after submit.

### Text
- UI copy in the service language (usually Korean). Code and identifiers in English.

### PWA (summary — details in pwa.md)
- The service worker caches only the app shell and never `/api` responses (on shared devices the previous user's data would show). Updates show a [Refresh] prompt instead of auto-reloading.
- Back button in the installed Android app: home and bottom-tab screens (plus screens the product names) live in one `EXIT_ROUTES` list; back on those → "press again to exit" popup → again → exit. Bottom-tab navigation uses `replace`, so the same popup appears on any tab. Implement with CloseWatcher (does not touch router history). Not on iOS.

### Public page visibility (summary — details in seo-aeo.md)
- Order matters: ① body and meta in server-made HTML (Next.js static) ② `robots.txt` does not block search bots (OAI-SearchBot, PerplexityBot, Claude-SearchBot, Yeti); check the CDN's AI bot blocking ③ sitemap + registration with Search Console, Bing Webmaster, Naver Search Advisor. Without ① and ②, ③ alone gets no citations. `llms.txt` is not needed.

## 4. Don'ts

- Weakening assertions to make tests pass.
- Shipping mocks in production builds, or silently falling back to mocks when the API fails.
- Copying and editing a shared component for one screen — fix the shared component and check its "used on" screens.
- Assuming API fields or endpoints the spec lacks on the client.
