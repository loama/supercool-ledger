# Cloud deployment

## Assessment deployment

Render keeps the runnable infrastructure small. One Blueprint defines the Docker web service, PostgreSQL database, generated secrets, migration command, and readiness check.

The application and database run in Frankfurt. The database does not expose a public allow list. The application receives its private connection string through a Blueprint reference.

The Blueprint intentionally omits automatic demonstration seeding. Synthetic financial data is created only through an explicit reviewer command.

Render supplies one owner connection to both the migration hook and the application. This is acceptable only for the synthetic assessment. The unresolved production boundary is explicit: migrations, customer operations, reconciliation, and recovery need separate database roles, with tenant policy enforced inside PostgreSQL.

## AWS production topology

The repository also has a deployable Terraform root at `infra/aws`. It creates a VPC across two availability zones, public load balancer subnets, private ECS application subnets, private RDS subnets, one cost aware NAT gateway, immutable ECR images, Secrets Manager entries, CloudWatch logs and alarms, and service scaling from two tasks to six tasks.

RDS PostgreSQL 17 uses Multi AZ mode by default. AWS maintains a synchronous standby and preserves one writer endpoint across managed failover. The application sends every balance read to that writer endpoint. The Terraform root creates no read replica because replica lag would weaken immediate balance visibility after a completed transfer.

The load balancer redirects HTTP to HTTPS and uses a supplied ACM certificate. Application tasks accept traffic only from the load balancer. PostgreSQL accepts traffic only from the application security group. Neither ECS nor RDS receives a public address.

The release sequence keeps schema changes outside the long running service. The first apply uses bootstrap mode, which creates the database, cluster, and migration task without creating the service or autoscaling. Operators run `bun run db:migrate`, verify its zero exit code, disable bootstrap mode, and apply again to create the service with scaling from two tasks to six tasks. Later releases also run the migration before the explicit ECS service update. See `infra/aws/README.md` for the exact commands.

Terraform state contains secret values. Production state therefore belongs in an encrypted, versioned S3 bucket with blocked public access, narrow IAM access, and locking. The example uses one NAT gateway and modest compute defaults to control cost. A stricter recovery target should use one NAT gateway per availability zone or private VPC endpoints.
