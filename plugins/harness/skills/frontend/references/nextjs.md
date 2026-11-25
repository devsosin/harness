# Next.js App Router (preset B)

Used as a router and static renderer in front of a separate backend API — not as a full-stack server.

## Layout

```text
app/                  # routes and layouts (page.tsx, layout.tsx, loading.tsx, error.tsx, not-found.tsx)
├── (public)/         # pre-rendered pages: landing, content, product pages (SEO/AEO)
├── (app)/            # logged-in app; client components
├── sitemap.ts, robots.ts, manifest.ts
components/  features/<area>/  lib/api/  lib/auth/  mocks/  tests/
```

## Rendering rules

- Pages are Server Components by default and are pre-rendered at build. Put `'use client'` only on the interactive leaf components (forms, lists with filters), not on whole pages — public content then stays in the HTML.
- Personal data is fetched in client components (TanStack Query) with the user's cookies; never at build time, never cached by Next.
- Build-time `fetch` only for public data (articles, catalog). With `output: 'export'`: no request-time server features (cookies(), headers(), dynamic routes without `generateStaticParams`, middleware, route handlers that need a server, `next/image` default loader).
- Server-only values stay server-only (`import 'server-only'`); `NEXT_PUBLIC_*` is public.
- Do not add Prisma, Server Actions that write data, or route handlers acting as the API — the backend owns data and rules.

## API and mocks

- Same client and envelope as preset A (`lib/api/`). Requests go to the backend's origin; with a different origin, the backend's CORS allows only the frontend origin and cookies are `SameSite`/`Secure` accordingly.
- MSW in the browser intercepts client-side requests only. Build-time or server-side fetches are not intercepted — mock those with fixtures or a mock server process. Enable mocks with an explicit env flag; never in production.

## Metadata (SEO/AEO)

- `export const metadata` / `generateMetadata` per page: title, description, canonical (`alternates.canonical`), Open Graph.
- `app/sitemap.ts` and `app/robots.ts` generate the files at build.
- JSON-LD in the page as `<script type="application/ld+json">` from a typed object. Rules in seo-aeo.md.

## Deploy

- Vercel: zero config; set the backend URL env per environment.
- Static host / nginx: `output: 'export'` → `out/`; nginx serves files (`try_files $uri $uri.html $uri/ =404`), `trailingSlash` set consistently with nginx.

## Commands

`pnpm dev`, `pnpm dev:mock`, `pnpm build`, `pnpm start` (server mode only), `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm e2e`.
