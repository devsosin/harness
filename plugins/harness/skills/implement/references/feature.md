# New features and bug fixes

Work that changes behavior. Tests demand the behavior first; the implementation makes them pass.

## Writing tests

1. Name a test per "done when" item first — the name alone should say what it guarantees (e.g. `order_with_unknown_option_returns_404`).
2. Cover edges and failure paths too. Happy-path-only tests are the first thing review flags:
   - input validation (missing required values, out of range, unknown values)
   - authorization (another user's or partner's resource, access per role)
   - results of state changes (what remains in the DB), partial failure, retries (idempotency)
   - external responses (success, error, no response — via a mock server)
   - for a bug fix, **a test that reproduces the bug** comes first
3. Check API contracts (field names, status codes, error codes) through the response body — testing only internal functions misses serialization mistakes.

## Confirm failure (red)

Before implementing, run the new tests and check they fail **for the expected reason** (compile error, 404, value mismatch …). A test that passes from the start proves nothing, so rewrite it — and if the behavior was already implemented, tell the user.

## Implement (green)

- Start with the simplest implementation that passes, then clean it up per the guide (enums, module placement, error separation) and run again.
- New states and kinds are enums, not strings (CODE_STYLE §2).
- Reflect new APIs, settings and environment variables in the repo docs (README, API spec, `.env.example`).

## Verification bar

- Against the baseline: all existing tests pass; new test count = what you added.
- Better still: pick one new test, temporarily revert the implementation and see it fail (proves the test really checks the implementation).
