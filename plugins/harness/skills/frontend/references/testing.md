# Testing

| Level | Tool | What |
|---|---|---|
| Unit | Vitest | pure functions: formatters, Zod schemas, query-key factories, mappers |
| Component | Vitest + React Testing Library + user-event (jsdom) | shared components: states, keyboard, a11y roles |
| Page / integration | same + MSW `setupServer` | a route rendered with providers; user flows against mock scenarios |
| E2E | Playwright, against `pnpm dev:mock` | critical flows only (login + refresh, the main job of each area) on desktop (1280) and mobile (375) projects |

## Rules

- Query by role and accessible name (`getByRole('button', { name: '저장' })`), not by test IDs or classes — the test then also checks accessibility.
- `user-event` for interactions; await what the user would wait for (`findBy…`), no fixed sleeps.
- Each test sets its own scenario; reset handlers and the mock DB after each test.
- One render helper (`renderWithProviders`) with QueryClient (retries off), router, and stores fresh per test.
- Cover for each page: success, empty, error, validation errors shown on fields, forbidden.
- Do not weaken an assertion to make a test pass; fix the code or the spec.
- Playwright: first run needs `pnpm exec playwright install chromium`; reuse the dev server (`webServer.reuseExistingServer`). Screenshots/videos only on failure.
- Run `pnpm typecheck && pnpm lint && pnpm test` for every change; `pnpm e2e` when a critical flow changed.
