# Baseline security requirements (SR)

The starting point for `target-stack.md`: the lists used in two rebuild projects (admin back office, Rust/Axum + React), trimmed to be stack-neutral. Do not delete items that do not fit the project; mark them "n/a — reason" (other docs reference the numbers).

| ID | Requirement |
|---|---|
| SR-01 | Deny by default: every API requires authentication, except endpoints listed as public (e.g. login, health, signed webhooks). |
| SR-02 | Authorization (role and ownership) is enforced on the server for every operation. Hiding UI is not authorization. |
| SR-03 | Tokens are verified on every request: signature with a fixed algorithm, expiry, and (for refresh tokens) the server-side record. Secrets are random, ≥ 256 bits, handled as secrets. |
| SR-04 | Passwords only as adaptive hashes (Argon2id or bcrypt); never logged or returned. Changing a password requires the current one. |
| SR-05 | No credentials in source or committed config; `.env` never committed (only `.env.example` with key names). Runtime secrets from a secret store; cloud access by roles, not static keys. Credentials found in the legacy system are treated as exposed and not reused. |
| SR-06 | No administrator defined by credentials in configuration. |
| SR-07 | All input validated on the server (type, length, range, format), regardless of client validation. |
| SR-08 | Parameterized queries only; no SQL built from user input. |
| SR-09 | File upload/download: private storage, the server authorizes and chooses the object key, short-lived URLs, type and size limits, uploaded objects verified before use. |
| SR-10 | Error responses expose no stack traces, SQL, or internals; details logged on the server only. |
| SR-11 | HTTPS only. CORS limited to known origins. Auth cookies `HttpOnly`, `Secure`, `SameSite`; CSRF protection for cookie auth. |
| SR-12 | Public sign-up or public exposure → two-factor authentication and lockout after repeated failures (thresholds: Requires decision). Not required while all accounts are admin-created. |
| SR-13 | Passwords, tokens, signed URLs, and secrets are never logged. |
| SR-14 | Development tools (DB consoles, debug endpoints, mock APIs) disabled in production. |
| SR-15 | Rate limiting at least on login and token refresh. |
| SR-16 | Third-party credentials stored in the DB are encrypted at rest (authenticated encryption, key from the environment, key version, bound to the owner record), write-only through the API, decrypted only at use, audited. |
| SR-17 | Inbound webhooks/callbacks are authenticated (signature or shared secret) or, if the provider cannot sign, only accepted for requests the server is waiting for, and are idempotent. |

SR-17 was not in the original lists; it was added from a case that had to accept unsigned external cancellation-result callbacks.
