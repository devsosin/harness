# API client, auth, and MSW mocks

## Client

- One `fetch` wrapper in `src/lib/api/client.ts`: base path, `credentials: 'include'`, JSON in/out, CSRF header on POST/PUT/PATCH/DELETE, request timeout (`AbortSignal.timeout`), error mapping. Features never call `fetch` directly.
- Types in `src/lib/api/types.ts` transcribed from the API spec (or generated from OpenAPI if the backend publishes one — then never hand-edit the generated file).
- Envelope (backend preset): success `{ data, meta? }`, error `{ error: { code, message, fieldErrors?, requestId } }`. Map to one `ApiError` class with `status`, `code`, `fieldErrors`, `requestId`. Show `message`; log `requestId` for support; never show raw server text you did not expect.
- Query keys from a per-area factory (`orderKeys.list(filters)`), so invalidation after a mutation is exact.

## Auth (cookie JWT)

- Access and refresh tokens in `HttpOnly` cookies set by the backend. JS never reads them.
- CSRF: read the non-HttpOnly CSRF cookie (only in `csrf.ts`) and send it as the agreed header.
- On `401`: call refresh **once** (single-flight promise shared by concurrent requests), retry the original request; if refresh fails, clear the Query cache and stores, go to `/login?redirect=<current>`.
- Session bootstrap: `GET /me` before rendering guarded routes; role-based menu hiding is convenience only.
- Re-authentication for sensitive changes (if the API has it): get the re-auth token right before the change, keep it in memory only.

## MSW

- Handlers in `src/mocks/handlers/<area>.ts`, shared by the browser worker (dev) and `setupServer` (tests).
- Fixtures: from the anonymized seed when one exists (a script converts `seed.sql` → JSON; regenerate when the seed changes), otherwise small hand-written fixtures. Values the seed lacks (roles, mock passwords) are defined in `src/mocks/` with a comment.
- A mock "today" pinned to the latest date in the fixtures, so date-based screens don't go empty as fixtures age.
- Stateful mock DB for mutations (`mocks/db.ts`) so create → list shows the new row.
- Scenarios: a dev-only panel or `?scenario=` switch (empty, slow, error per endpoint); in tests `server.use(...)` overrides.
- Every screen covers: success, empty, loading (delay), validation (`fieldErrors`), 401, 403, 404, 409, 429, 500.
- Mocks never ship: started only behind an explicit dev/test flag, never as a fallback when the API fails.
- When the real backend arrives: switch the screen to the real API without UI changes, then verify against it and note any contract difference in the API spec.
