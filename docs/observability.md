# Observability

## Logs

Fastify writes bounded JSON completion records to standard output. Every record includes method, route template, status, duration, and request identifier. A valid trace identifier is added when tracing is active. Unexpected errors include the request identifier, trace identifier when available, route, and stable error code.

Redaction removes authorization headers, idempotency keys, request bodies, balances, amounts, account names, database URLs, and connection strings. A test feeds each prohibited field through the logger and checks the serialized output.

## Metrics

The protected `/metrics` endpoint exposes Prometheus text. Metrics include HTTP count and duration, transfer outcomes, idempotency decisions, and reconciliation outcomes.

Labels contain bounded categories. Account, transfer, tenant, request, and idempotency identifiers never become labels.

## Traces

OpenTelemetry spans cover every request, transfer creation, and reconciliation run without attaching amounts or account identifiers. Financial operation spans are explicit children of their request span. Set `OTEL_EXPORTER_OTLP_ENDPOINT` to activate batched HTTP export to a collector or compatible backend.

## Errors

Sentry receives unexpected exceptions only when `SENTRY_DSN` exists. Validation errors, authentication failures, conflicts, and insufficient funds are expected outcomes and do not create error issues.

## Alert conditions

Operators should alert on:

1. Any reconciliation discrepancy.
2. Sustained server errors.
3. Database connection pool exhaustion.
4. Elevated transaction latency.
5. Readiness failures.
6. A sharp increase in authentication failures or idempotency conflicts.
