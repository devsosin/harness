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
- Run `pnpm typecheck && pnpm lint && pnpm test` for every change; `pnpm e2e` when a critical flow changed.

## Playwright (E2E)

Runs against mode 1 (`pnpm dev:mock`, MSW in the browser), so it needs no backend. Remote/local-mode E2E is out of scope.

### Setup

```bash
pnpm add -D @playwright/test
pnpm exec playwright install chromium        # per machine; CI: --with-deps
```

- `package.json`: `"e2e": "playwright test"`. One name in every repo — not `test:e2e`.
- Specs in `tests/e2e/*.spec.ts`. Vitest must not collect them (it would run them and fail): `test.exclude: ['tests/e2e/**', 'node_modules/**']` in the Vite/Vitest config.
- `.gitignore`: `test-results/`, `playwright-report/`, `blob-report/`.

`playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173; // not the dev port, so a running `pnpm dev` (mode 2) is never reused by mistake
const CI = !!process.env.CI;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  reporter: CI ? [['html', { open: 'never' }], ['github']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 375, height: 812 } } },
  ],
  webServer: {
    command: `pnpm dev:mock --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !CI,
  },
});
```

Next.js: same file; `pnpm dev:mock` must accept `--port` (`next dev -p`), so use ``command: `pnpm dev:mock -p ${PORT}` ``.

### Writing specs

- Same queries as component tests: `getByRole` / `getByLabel` / `getByText`, web-first assertions (`await expect(locator).toHaveText(…)`), never `waitForTimeout`.
- The mock bootstrap must `await worker.start()` before rendering (vite-spa.md); otherwise the first requests escape MSW and the test flakes. Then the first content assertion already waits for MSW — no extra hook.
- Scenarios through the URL switch from api-and-mocks.md: `page.goto('/orders?scenario=empty')`. Do not use `page.route` for API responses — it bypasses the MSW handlers the app and Vitest share, and the two drift.
- Critical flows only (login + refresh, the main job of each area); state variations belong in Vitest. Both projects run every spec; skip one with `test.skip(testInfo.project.name === 'mobile', '<why>')` only when the flow does not exist there.
- A failing run leaves `test-results/<test>/trace.zip`: `pnpm exec playwright show-trace <path>`.

### CI (GitHub Actions)

```yaml
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm e2e
      - uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with: { name: playwright-report, path: playwright-report/, retention-days: 7 }
```

`CI=true` (set by Actions) turns on retries, `forbidOnly`, the HTML report and a fresh dev server.
