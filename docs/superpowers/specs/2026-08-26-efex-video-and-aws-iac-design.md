# EFEX inspired video and AWS infrastructure design

## Goal

Improve the assessment presentation in two ways. The Remotion walkthrough should use the visual language of EFEX, run at a pitch preserving tempo rate of 1.25, and explain the repository and reviewer sandbox. The repository should also contain validated Terraform for a major cloud deployment.

## Brand direction

The visual reference is the current EFEX website at `https://www.efex.com/`. The video may borrow its design language but must not claim that SuperCool Ledger is an EFEX product.

The visual system uses these values:

1. Near black `#111111` for primary surfaces.
2. White `#ffffff` and soft white `#f7f7f2` for text and light scenes.
3. Signal yellow `#fff98e` for active steps, calls to action, and status emphasis.
4. Gray `#a3a3a3` for secondary text.
5. DM Sans for display and body typography.
6. Large sentence case headings with regular weight and tight line height.
7. Soft yellow radial light and restrained grain on dark scenes.
8. Thin borders, flat surfaces, and almost no drop shadows.
9. Rounded buttons and selective rounded panels. Flowchart nodes remain mostly rectangular.

The header uses a custom assessment wordmark built from text and simple geometry. It must not copy or bundle an EFEX logo file.

## Video story

The walkthrough stays in Spanish and uses the Enrique M. Nieto voice. It contains ten numbered scenes:

1. The financial correctness promise.
2. The ledger invariants.
3. The repository map, grouped by API entry, domain modules, database rules, evidence, and operations.
4. The request lifecycle from Fastify through authentication, validation, service logic, PostgreSQL, and observability.
5. The atomic transfer sequence and its fixed account lock order.
6. The data model around tenants, accounts, transfers, journals, postings, audit events, and sandbox sessions.
7. The reviewer sandbox workflow. It explains session creation, success, replay, conflict, insufficient funds, race, entries, and reconciliation.
8. The captured PostgreSQL evidence.
9. The observability boundary across logs, metrics, traces, and unexpected errors.
10. The AWS deployment topology, migration boundary, and review path through the live sandbox, API reference, tests, and source.

The final artifact uses a pitch preserving audio tempo rate of exactly `1.25`. The scene and caption ranges use the shortened playback duration. The preview page still waits for an explicit play action.

## Cloud infrastructure

Terraform under `infra/aws` describes one deployable AWS environment.

The environment contains:

1. A VPC across two availability zones.
2. Public subnets for an Application Load Balancer and one NAT gateway in each availability zone.
3. Private application subnets for ECS Fargate tasks.
4. Private database subnets for RDS PostgreSQL 17.
5. An ECR repository with immutable image tags and image scanning.
6. An ECS cluster, task definition, service, deployment circuit breaker, health check, and target tracking scaling.
7. Separate application and migration task definitions.
8. Secrets Manager entries for the database URL, authentication secret, and metrics token.
9. CloudWatch log groups and alarms for service health and database pressure.
10. Security groups that permit only the load balancer to reach the application and only the application tasks to reach PostgreSQL.

Terraform does not deploy the application image itself. The image digest is an input. The deployment guide gives the exact ECR build, push, migration, and service update commands.

All balance reads stay on the PostgreSQL writer. The configuration does not create a read replica.

## Verification

The repository must prove these properties:

1. `terraform fmt` passes.
2. `terraform init` with the backend disabled passes.
3. `terraform validate` passes without AWS credentials.
4. The existing Bun check remains green.
5. A video integrity test checks the ten scenes, the exact playback rate, captions, and AWS and sandbox claims.
6. The final MP4 contains H.264 video and AAC audio at 1920 by 1080 and 30 frames per second.
7. Representative frames from every scene receive visual inspection.
8. The local player has controls and no autoplay attribute.

## Documentation

Update the README, cloud deployment guide, video guide, release verification, and technical references. The docs must state that EFEX supplied the visual reference, while the service remains the fictional SuperCool Ledger assessment project.
