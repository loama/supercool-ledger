# Primary references

The implementation choices were checked against primary documentation.

1. [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html) describes row locks, conflicting writes, and deadlock considerations.
2. [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html) describes `READ COMMITTED` and the visibility rules used by the transfer transaction.
3. [Fastify validation and serialization](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/) describes schema validation and response serialization.
4. [Fastify TypeScript](https://fastify.dev/docs/latest/Reference/TypeScript/) describes the framework type system and its limitations.
5. [Render Blueprint specification](https://render.com/docs/blueprint-spec) defines the `render.yaml` resources, plans, secrets, migration hook, and health check.
6. [OpenTelemetry JavaScript exporters](https://opentelemetry.io/docs/languages/js/exporters/) documents the OTLP HTTP exporter and collector pattern.
7. [GitHub Dependabot ecosystems](https://docs.github.com/en/code-security/reference/supply-chain-security/supported-ecosystems-and-repositories) confirms support for the text `bun.lock` format.
