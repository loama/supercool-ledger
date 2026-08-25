# Review round two

Three new reviewers independently examined the corrected round one commit. Their scopes again covered financial security, implementation and operations, and presentation. They received no round one conclusions.

## Accepted findings

1. Empty journals could commit because the original constraint ran only after a posting insert. A new deferred journal trigger now validates every journal at commit.
2. A completed transfer did not independently prove that its postings matched its declared accounts and amount. A deferred transfer trigger now requires exactly the matching debit and credit.
3. Cached balances could be changed directly. Deferred checks now require every account cache and posting sum to agree in both directions at commit.
4. Migration history had no checksum. The runner now stores SHA 256 digests and rejects changed applied files.
5. Readiness named one migration. It now compares every migration shipped with the running artifact.
6. The initial Render hook seeded synthetic financial data automatically. The hook was removed, and the demonstration remains an explicit reviewer command.
7. Database connection attempts were unbounded, and readiness failures became server errors. Connections now use a bounded timeout, and readiness returns a stable `503` response.
8. Sentry could lose a final event during shutdown. Graceful shutdown now closes Sentry with a bounded wait before allowing process exit.
9. Customer transfer authorization did not distinguish system accounts. The route now rejects a system source or destination.
10. The video closing card implied that its single scenario displayed a concurrency race. It now states that concurrency tests are included.
11. API error examples were reused under unrelated status codes. Each documented status now carries a matching example, and the metrics route declares its separate authentication scheme.

## Judgment adjustments

The security reviewer correctly identified that the assessment uses one database owner credential for migration and runtime work. The Render Blueprint cannot declaratively create and wire a second PostgreSQL role. This remains an explicit production limitation rather than a hidden claim. The database now prevents accidental or future script corruption through commit constraints, but a stolen owner credential still requires rotation, isolation, and incident response. Production must use separate migration, application, reconciliation, and recovery roles with tenant policy inside PostgreSQL.

The reconciliation drift test now disables one constraint trigger before injecting synthetic corruption, then restores it. This makes the test honest: normal application and script writes cannot create that drift, while reconciliation still proves detection after privileged control bypass or physical recovery.

## Verification

The final round two gate completed with 55 passing tests and 343 assertions. Strict TypeScript checks, lint, formatting, the production build, and the production dependency audit also passed.
