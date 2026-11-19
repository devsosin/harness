# Frontend presets — choosing and the repo CLAUDE.md template

Two presets. Both are React + TypeScript, pnpm, Tailwind, TanStack Query, MSW, Vitest, Playwright, talking to a separate backend API. They differ in routing, rendering, and deployment.

## Choosing

Ask these (answers from the requirements docs first; ask the user only what they do not say):

| Question | Points to |
|---|---|
| Must pages be found by search engines or cited by AI answer engines (public content, landing, articles, product pages)? | Next.js (pre-rendered HTML). A login-only admin → Vite SPA |
| Where does it deploy? Own server with nginx / S3+CloudFront | Vite SPA (static files) — Next.js `output: 'export'` also works |
| Vercel | Next.js (also fine for a Vite SPA) |
| Installable app (PWA) with an offline app shell? | either; Vite has the simpler setup (`vite-plugin-pwa`) |
| Per-request server logic in the frontend (SSR with cookies, edge middleware)? | Next.js server runtime — avoid unless needed; the backend API owns logic |
| Team already knows one? | that one |

Default when nothing points elsewhere: **Vite SPA**. When some pages are public and must be indexed but the app part is login-only, a split also works: a small Next.js (static) site for public pages + Vite SPA for the app.

Record the choice and the reason in `docs/product/TechStack.md` and the repo CLAUDE.md.

## Preset A — Vite SPA (default)

| Area | Choice |
|---|---|
| Build | Vite, static SPA, no SSR |
| Routing | TanStack Router, file-based routes, typed search params (Zod) |
| Server state / UI state | TanStack Query / Zustand |
| Styling | Tailwind CSS v4 with design tokens in `src/styles/tokens.css` (default palette and breakpoints replaced by the design system's) |
| UI primitives | React Aria Components (headless, accessible), `lucide-react` icons |
| Forms | React Hook Form + Zod (`@hookform/resolvers`) |
| Dates | `@internationalized/date` + `Intl` |
| Mocks / tests | MSW (shared by dev and tests), Vitest + React Testing Library + user-event (jsdom), Playwright (desktop 1280 + mobile 375) |
| Lint / format | ESLint flat config (typescript-eslint strict, react-hooks, jsx-a11y, TanStack plugins) + Prettier |
| PWA | `vite-plugin-pwa` (`generateSW`), app shell only |
| Deploy | Docker image: build + nginx (`nginx.conf.template`, `/api` proxied to the backend) |

Details: vite-spa.md.

## Preset B — Next.js App Router (static)

| Area | Choice |
|---|---|
| Build | Next.js App Router; pages pre-rendered at build (static), client components for interactive parts. `output: 'export'` for any static host, or Vercel |
| Routing | App Router folders (`app/`) |
| Data | TanStack Query in client components against the backend API; build-time `fetch` only for public, non-personal content |
| Styling / forms / tests / lint | same as preset A (Tailwind v4, React Hook Form + Zod, MSW, Vitest, Playwright) |
| SEO / AEO | Metadata API, `sitemap.ts`, `robots.ts`, JSON-LD — see seo-aeo.md |
| PWA | manual `public/sw.js` + manifest, or a maintained plugin; same caching rules |

Not used by default: Server Actions, route handlers as an API, Prisma or any direct DB access — the backend API owns data. Details: nextjs.md.

## Repo CLAUDE.md template

````markdown
# <App> — frontend

<One paragraph: who uses it, main jobs. "All data goes through the <backend> API.">

Workspace context: `<folder>/` in the `<workspace>` workspace (root CLAUDE.md). Paths outside this repo are marked *(workspace)*.

## Stack

<preset table rows that apply; decided-on dates and where decided (`docs/product/TechStack.md`)>

## Structure

- `src/routes/` (or `app/`) — routes; route map in `<docs/design/README.md>` *(workspace)*
- `src/components/` — shared components, one-to-one with `<docs/design/components/*.md>`
- `src/features/<area>/` — area UI, hooks, API adapters
- `src/lib/api/` — client, types from the API spec, error mapping
- `src/lib/auth/` — session bootstrap, refresh, guards
- `src/stores/` — Zustand (UI state only)
- `src/mocks/` — MSW handlers, fixtures, scenarios
- `tests/` — integration and E2E

## API & Mocking

- Contract: `<docs/product/API_SPEC.md>` *(workspace)* — base path, casing, envelope, errors, auth headers.
- <auth: cookies, CSRF header name, refresh rule>
- MSW for every screen before the backend exists; scenarios: success, empty, validation, 401/403, 404, 409, 429, 500. Mocks only in dev and tests.

## UI

- Design: `<docs/design/BASE.md>`, page and component specs. Loading / empty / error / success everywhere.
- Breakpoints: <mobile < 744 / tablet 744–1127 / desktop ≥ 1128>. <Korean> UI text.
- <PWA: exit screens `EXIT_ROUTES` in `<src/lib/pwa/exitGuard.ts>` (bottom-nav tab roots + <named screens>); bottom-nav links use `replace`. Never cache `/api` in the service worker.>
- <Public pages (SEO/AEO): which routes are pre-rendered and indexed; robots/sitemap source files; crawl-bot policy (training bots blocked or not).>
- Rules: harness `frontend` skill (presets, API & mocks, testing, PWA, SEO/AEO references).

## Testing

<what is tested where; critical Playwright flows by name>

## Commands

| Command | What |
|---|---|
| `pnpm install` | install |
| `pnpm dev:mock` | dev server with MSW |
| `pnpm dev` | dev server, `/api` → `API_PROXY_TARGET` in `.env.local` (default `<http://localhost:8080>`) |
| `pnpm typecheck` / `pnpm lint` / `pnpm test` | checks (run all three for every change) |
| `pnpm e2e` | Playwright |
| `pnpm build` | production build |

<## Work Plan — session order and progress table, if screens are built one area per session>
````
