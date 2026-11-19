# Vite SPA (preset A)

## Layout

```text
src/
├── routes/            # TanStack Router file routes (__root.tsx, _auth/…, $id.tsx)
├── components/        # shared components (Button, Input, Dialog, ListPage, AppShell …)
├── features/<area>/   # area UI, hooks (useXxxQuery/useXxxMutation), api adapters
├── lib/api/           # client.ts, types.ts, errors.ts, csrf.ts
├── lib/auth/          # bootstrap (/me), refresh single-flight, guards
├── stores/            # Zustand, UI state only
├── mocks/             # browser.ts, server.ts, handlers/, fixtures/, scenarios.ts
└── styles/tokens.css  # design tokens (Tailwind v4 @theme)
```

## Routing

- File-based routes with the Vite plugin; the generated `routeTree.gen.ts` is generated — don't edit it.
- Search params validated with a Zod schema per route (`validateSearch`); filters, page, sort live there.
- Guards in `beforeLoad` using the session from `/me`; on no session `redirect({ to: '/login', search: { redirect } })`.
- Data prefetch in `loader` via `queryClient.ensureQueryData` when the route needs it before render; otherwise query in the component.
- Code-split heavy routes (`.lazy.tsx`).

## Env and modes

- Run modes follow the `harness:local-run` skill: `.env.mock` (`VITE_API_MOCK=true`) for `pnpm dev:mock` (mode 1); `.env.local` `API_PROXY_TARGET` for `pnpm dev` against an existing server (mode 2); compose for the full local stack (mode 3). Only `VITE_*` reaches the client and it is public.
- Dev proxy: `server.proxy['/api']` → `API_PROXY_TARGET` (default `http://localhost:8080`) so cookies stay same-origin.
- Mocks start only when the mode says so (`if (import.meta.env.VITE_API_MOCK === 'true') await import('./mocks/browser')`), so production bundles contain no mock code — check with `pnpm build` and a grep of `dist/`.

## Build and deploy

- `pnpm build` → `dist/`. Docker: multi-stage `node:24-alpine` build → `nginx:alpine` serving `dist/`.
- nginx: SPA fallback (`try_files $uri /index.html`), long cache for hashed assets, `no-cache` for `index.html` and `sw.js`, `/api` proxied to the backend, security headers (CSP, `X-Content-Type-Options`, `Referrer-Policy`). Backend URL from env via `nginx.conf.template`.
- QA build with mocks over HTTPS (MSW needs a secure context): a `Dockerfile.mock` + reverse proxy with TLS, only for QA.

## SEO note

A SPA serves an empty HTML shell; crawlers and AI answer engines that do not run JavaScript see nothing. Fine for login-only apps. For public pages either pre-render them (a static site or Next.js export) or choose preset B — see seo-aeo.md.
