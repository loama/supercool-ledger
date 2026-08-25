# ADR 001: Immutable double entry ledger

Status: accepted

Balances alone cannot explain or reconstruct financial history. Every movement therefore creates balanced postings inside an immutable journal transaction.

The accepted cost is additional tables, constraints, and reconciliation. The rejected alternative was a mutable balance table with an audit log. That design could let the audit record and financial value diverge.
