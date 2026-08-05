# Tests

- `unit/`: pure contracts and React component behavior; no external I/O.
- `integration/`: application/infrastructure contracts. Database cases use an isolated PostgreSQL URL prepared with `pnpm db:test:prepare`.
- `e2e/`: browser-visible user flows against a running Next.js server.
- `fixtures/`: sanitized, deterministic Riot and domain fixtures added by later sessions.

Never store credentials, production PUUIDs or unsanitized Riot payloads in fixtures or snapshots.

Database tests use `withRollback` from `integration/database-test-client.ts` for writes. The preparation command is intentionally non-destructive: it runs committed migrations and the idempotent seed, and refuses URLs that equal `DATABASE_URL` or whose database name lacks a standalone `test` segment.

PowerShell example:

```powershell
$env:TEST_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/deluxe_soloq_test'
pnpm db:test:prepare
pnpm test:integration
```
