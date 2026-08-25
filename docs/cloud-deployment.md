# Cloud deployment

## Assessment deployment

Render keeps the runnable infrastructure small. One Blueprint defines the Docker web service, PostgreSQL database, generated secrets, migration command, and readiness check.

The application and database run in Frankfurt. The database does not expose a public allow list. The application receives its private connection string through a Blueprint reference.

The Blueprint intentionally omits automatic demonstration seeding. Synthetic financial data is created only through an explicit reviewer command.

Render supplies one owner connection to both the migration hook and the application. This is acceptable only for the synthetic assessment. The unresolved production boundary is explicit: migrations, customer operations, reconciliation, and recovery need separate database roles, with tenant policy enforced inside PostgreSQL.

## Production evolution

A larger AWS deployment would use an Application Load Balancer, private ECS tasks, RDS PostgreSQL with Multi AZ failover, Secrets Manager, KMS, CloudWatch or an OpenTelemetry destination, WAF controls, and isolated migration tasks.

The financial design would not change. PostgreSQL remains the single writer and coordination authority. Balance reads stay on the writer unless the product explicitly accepts replica lag.

The assessment does not implement that AWS deployment because its networking and identity resources would hide the ledger decisions under infrastructure volume.
