# ADR 002: Locked cached balances

Status: accepted

The service stores a cached balance for fast reads and updates it in the same transaction as ledger postings. Every mutation locks the participating account rows in sorted identifier order.

Deriving the balance on every request was simpler but would make common reads increasingly expensive. An eventually updated cache was rejected because it could display stale money after a committed transfer.
