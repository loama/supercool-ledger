# Cloud deployment

## Assessment deployment

Render keeps the runnable infrastructure small. One Blueprint defines the Docker web service, PostgreSQL database, generated secrets, migration command, and readiness check.

The application and database run in Frankfurt. The database does not expose a public allow list. The application receives its private connection string through a Blueprint reference.

## Production evolution

A larger AWS deployment would use an Application Load Balancer, private ECS tasks, RDS PostgreSQL with Multi AZ failover, Secrets Manager, KMS, CloudWatch or an OpenTelemetry destination, WAF controls, and isolated migration tasks.

The financial design would not change. PostgreSQL remains the single writer and coordination authority. Balance reads stay on the writer unless the product explicitly accepts replica lag.

The assessment does not implement that AWS deployment because its networking and identity resources would hide the ledger decisions under infrastructure volume.
