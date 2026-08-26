# Primary references

The implementation choices were checked against primary documentation.

1. [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html) describes row locks, conflicting writes, and deadlock considerations.
2. [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html) describes `READ COMMITTED` and the visibility rules used by the transfer transaction.
3. [Fastify validation and serialization](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/) describes schema validation and response serialization.
4. [Fastify TypeScript](https://fastify.dev/docs/latest/Reference/TypeScript/) describes the framework type system and its limitations.
5. [Render Blueprint specification](https://render.com/docs/blueprint-spec) defines the `render.yaml` resources, plans, secrets, migration hook, and health check.
6. [OpenTelemetry JavaScript exporters](https://opentelemetry.io/docs/languages/js/exporters/) documents the OTLP HTTP exporter and collector pattern.
7. [GitHub Dependabot ecosystems](https://docs.github.com/en/code-security/reference/supply-chain-security/supported-ecosystems-and-repositories) confirms support for the text `bun.lock` format.
8. [EFEX](https://www.efex.com/) is the visual reference for the video palette, typography, spacing, and restrained diagram style. SuperCool Ledger does not use an EFEX logo or claim product affiliation.
9. [Install Terraform](https://developer.hashicorp.com/terraform/install) provides the official Terraform 1.15.8 installation packages and checksums.
10. [HashiCorp AWS provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs) documents the provider used by `infra/aws`.
11. [Amazon ECS on AWS Fargate](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/getting-started-fargate.html) documents the ECS task and service model used for the private application and migration tasks.
12. [Amazon RDS Multi AZ DB instance deployments](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZSingleStandby.html) documents synchronous standby replication, failover, and the fact that the standby does not serve read traffic.
