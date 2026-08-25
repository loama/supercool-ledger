# ADR 003: Database idempotency

Status: accepted

The financial transaction claims the idempotency key and stores the completed response. The key is unique within a tenant and operation scope.

An in memory cache was rejected because it disappears on restart and does not coordinate multiple instances. A separate key service was rejected because it would divide the financial commit across systems.
