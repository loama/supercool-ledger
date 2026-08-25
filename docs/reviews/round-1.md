# Review round one

Three independent reviewers examined the committed implementation before this round. Their scopes were financial correctness and security, implementation and operations, and documentation and video. The main review judged every finding against code, tests, database behavior, media metadata, and the production dependency graph.

## Accepted findings

1. Zero and excessive transfer amounts reached the generic server error path. They now return a stable `422 invalid_amount` response.
2. Concurrent migration runners could race. A PostgreSQL advisory lock now serializes the complete migration loop.
3. Readiness proved connectivity but not schema state. It now requires the latest expected migration.
4. Financial operation spans were roots instead of children. Routes now pass the explicit request context, with an exported span assertion.
5. Database references did not independently enforce tenant and currency boundaries. Composite foreign keys and reversal checks now protect postings, transfers, accounts, journals, and currencies.
6. Suspended tenants could create accounts and move money. Financial writes now lock and verify tenant status in their transaction.
7. Audit rows were mutable, and reconciliation lacked a durable record. Audit history is now append only, and each authenticated reconciliation writes an outcome event.
8. The interactive documentation dependency included a known static route vulnerability. The vulnerable dependency was removed, the documentation renderer was replaced, traversal checks were added, and the production audit is clean.
9. OpenAPI lacked practical examples. Account, transfer, error, replay, conflict, insufficient funds, and reconciliation evidence now appears in the contract.
10. The video had no captions. Sentence captions now cover the complete composition.
11. The committed demonstration snapshot needed stronger provenance. The PostgreSQL integration scenario now compares its stable results with the committed video evidence.
12. The component diagram left reconciliation disconnected. The invocation edge is now explicit.

## Judgment adjustments

The presentation reviewer suggested treating the committed JSON as a generated proof on its own. The final control separates two claims. The video test proves that narration, captions, and displayed values agree with the committed snapshot. The integration test independently executes the same scenario against PostgreSQL and compares all stable financial evidence. Random identifiers and timestamps are excluded by design.

The security reviewer suggested durable audit rows for every rejected request. Rejected requests do not change financial state, so they remain bounded metrics and structured logs. Completed financial writes and reconciliation outcomes create immutable audit events. This preserves forensic value without turning attacker controlled rejection volume into an unbounded financial record.

## Verification

The round one gate completed with 50 passing tests, 324 assertions, strict TypeScript checks, lint, formatting verification, a production build, and zero known production dependency vulnerabilities.
