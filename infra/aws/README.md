# AWS production deployment

This Terraform root creates one SuperCool Ledger environment in AWS. It has a VPC across two availability zones, one NAT gateway in each zone, a public Application Load Balancer, private ECS Fargate tasks, private RDS PostgreSQL 17, ECR, Secrets Manager, CloudWatch, and target tracking scaling from two tasks to six tasks.

Terraform creates no read replica. Every balance read goes to the PostgreSQL writer so a completed transfer is immediately visible without replica lag.

## Prepare the environment

Use Terraform 1.15. Request or import an ACM certificate in the deployment region. The certificate must cover a name in the supplied Route 53 hosted zone. Copy the example values and replace every placeholder:

```bash
cd infra/aws
cp terraform.tfvars.example terraform.tfvars
```

Keep `bootstrap_mode = true` for the first apply. In bootstrap mode Terraform creates the network, database, ECR repository, ECS cluster, secrets, log groups, load balancer, and both task definitions. It does not create the ECS service or either autoscaling resource. This prevents the application readiness check from reaching an unmigrated database.

Keep `terraform.tfvars` out of version control. The root writes the database password, authentication secret, metrics token, and database URL into Terraform state. Configure the S3 backend with encryption, versioning, blocked public access, narrow IAM access, and state locking before a production apply. Do not store production state on a laptop or in CI artifacts.

Initialize the root:

```bash
terraform init \
  -backend-config="bucket=YOUR_STATE_BUCKET" \
  -backend-config="key=supercool-ledger/production.tfstate" \
  -backend-config="region=eu-central-1" \
  -backend-config="encrypt=true" \
  -backend-config="use_lockfile=true"
```

## Create ECR and push the first image

The first environment needs its ECR repository before the image digest exists. Create only that repository once:

```bash
terraform apply -target=aws_ecr_repository.application
```

Targeted apply is only an ECR bootstrap step. Do not use it for normal releases.

Run the image commands from the repository root. Prefix every candidate tag with `release-` and keep it unique. ECR rejects a second push to the same tag.

```bash
cd ../..
AWS_REGION=eu-central-1
ECR_REPOSITORY_URL="$(terraform -chdir=infra/aws output -raw ecr_repository_url)"
RELEASE_TAG="release-$(git rev-parse --short=12 HEAD)"
aws ecr get-login-password --region "$AWS_REGION" | \
  docker login --username AWS --password-stdin "${ECR_REPOSITORY_URL%%/*}"
docker build --platform linux/amd64 --tag "$ECR_REPOSITORY_URL:$RELEASE_TAG" .
docker push "$ECR_REPOSITORY_URL:$RELEASE_TAG"
aws ecr describe-images \
  --region "$AWS_REGION" \
  --repository-name "${ECR_REPOSITORY_URL##*/}" \
  --image-ids imageTag="$RELEASE_TAG" \
  --query 'imageDetails[0].imageDigest' \
  --output text
```

Copy the returned digest into `image_digest`. Task definitions reference that digest, never a mutable tag. The lifecycle policy retains the newest 20 unprotected `release-` candidates and removes untagged images after 30 days.

Protect the deployed digest and one known good rollback digest with unique tags that do not start with `release-`. Before promoting a new release, copy the existing `current-<sha>` manifest to `rollback-<sha>` and then remove its current tag. Copy the candidate manifest to `current-<sha>` and remove its release tag only after the service is stable. Remove the older rollback tag after both protected tags exist and the rollback choice has been verified. An image that still has a `release-` tag remains eligible for the 20 image lifecycle rule even if it also has another tag.

The following commands promote a stable candidate. Set `PREVIOUS_CURRENT_TAG` and `OLDER_ROLLBACK_TAG` from the repository inventory. Omit the previous or older step on the first release.

```bash
REPOSITORY_NAME="${ECR_REPOSITORY_URL##*/}"
CURRENT_TAG="current-${RELEASE_TAG#release-}"
PREVIOUS_CURRENT_TAG="current-<previous-sha>"
ROLLBACK_TAG="rollback-${PREVIOUS_CURRENT_TAG#current-}"
OLDER_ROLLBACK_TAG="rollback-<older-sha>"

PREVIOUS_MANIFEST="$(aws ecr batch-get-image \
  --region "$AWS_REGION" \
  --repository-name "$REPOSITORY_NAME" \
  --image-ids imageTag="$PREVIOUS_CURRENT_TAG" \
  --query 'images[0].imageManifest' \
  --output text)"
aws ecr put-image \
  --region "$AWS_REGION" \
  --repository-name "$REPOSITORY_NAME" \
  --image-tag "$ROLLBACK_TAG" \
  --image-manifest "$PREVIOUS_MANIFEST"

CANDIDATE_MANIFEST="$(aws ecr batch-get-image \
  --region "$AWS_REGION" \
  --repository-name "$REPOSITORY_NAME" \
  --image-ids imageTag="$RELEASE_TAG" \
  --query 'images[0].imageManifest' \
  --output text)"
aws ecr put-image \
  --region "$AWS_REGION" \
  --repository-name "$REPOSITORY_NAME" \
  --image-tag "$CURRENT_TAG" \
  --image-manifest "$CANDIDATE_MANIFEST"
aws ecr batch-delete-image \
  --region "$AWS_REGION" \
  --repository-name "$REPOSITORY_NAME" \
  --image-ids imageTag="$PREVIOUS_CURRENT_TAG" imageTag="$RELEASE_TAG"
aws ecr batch-delete-image \
  --region "$AWS_REGION" \
  --repository-name "$REPOSITORY_NAME" \
  --image-ids imageTag="$OLDER_ROLLBACK_TAG"
```

## Apply the bootstrap state

Confirm that `bootstrap_mode` remains `true`. Inspect and apply the bootstrap plan:

```bash
cd infra/aws
terraform plan -out=bootstrap.tfplan
terraform apply bootstrap.tfplan
```

The bootstrap apply produces the cluster, migration task, private subnet, and security group outputs. The `ecs_service_name` output remains null because no service or autoscaling resource exists yet.

## Run and verify the migration

Run the migration task before enabling or updating the service. The migration task runs `bun run db:migrate` with the same image digest as the application. It receives the RDS owner URL, applies schema migrations, and provisions the constrained application login. The service receives a separate URL for that login. The application role can use the runtime tables but cannot read migration history, create schema objects, or delete ledger postings.

Run these commands from the repository root:

```bash
cd ../..
AWS_REGION=eu-central-1
ECS_CLUSTER="$(terraform -chdir=infra/aws output -raw ecs_cluster_name)"
MIGRATION_TASK="$(terraform -chdir=infra/aws output -raw migration_task_definition_arn)"
APPLICATION_SUBNETS="$(terraform -chdir=infra/aws output -json application_subnet_ids | jq -r 'join(",")')"
APPLICATION_SECURITY_GROUP="$(terraform -chdir=infra/aws output -raw application_security_group_id)"

MIGRATION_ARN="$(aws ecs run-task \
  --region "$AWS_REGION" \
  --cluster "$ECS_CLUSTER" \
  --task-definition "$MIGRATION_TASK" \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$APPLICATION_SUBNETS],securityGroups=[$APPLICATION_SECURITY_GROUP],assignPublicIp=DISABLED}" \
  --query 'tasks[0].taskArn' \
  --output text)"

aws ecs wait tasks-stopped \
  --region "$AWS_REGION" \
  --cluster "$ECS_CLUSTER" \
  --tasks "$MIGRATION_ARN"
MIGRATION_EXIT_CODE="$(aws ecs describe-tasks \
  --region "$AWS_REGION" \
  --cluster "$ECS_CLUSTER" \
  --tasks "$MIGRATION_ARN" \
  --query 'tasks[0].containers[0].exitCode' \
  --output text)"
test "$MIGRATION_EXIT_CODE" = "0"
```

The final command exits with a failure status unless the migration container exits with zero. Do not enable or update the service after a failed migration.

## Enable the service after the first migration

Set `bootstrap_mode = false` in `terraform.tfvars`. Then create the service and its scaling target in a second plan and apply:

```bash
cd infra/aws
terraform plan -out=service.tfplan
terraform apply service.tfplan
AWS_REGION=eu-central-1
ECS_CLUSTER="$(terraform output -raw ecs_cluster_name)"
ECS_SERVICE="$(terraform output -raw ecs_service_name)"
aws ecs wait services-stable \
  --region "$AWS_REGION" \
  --cluster "$ECS_CLUSTER" \
  --services "$ECS_SERVICE"
```

This apply creates two application tasks and target tracking autoscaling with a minimum of two tasks and a maximum of six tasks. The service deployment circuit breaker rolls back tasks that never pass `/health/ready`.

Keep `bootstrap_mode = false` after the service exists. The service lifecycle rejects an accidental plan that would remove it. A deliberate environment retirement requires a reviewed lifecycle change.

## Release a later image

Keep `bootstrap_mode = false`. Build and push a new immutable image, copy its digest into `image_digest`, then register the new task definitions. Run these commands from the repository root:

```bash
cd infra/aws
terraform plan -out=release.tfplan
terraform apply release.tfplan
cd ../..
```

Terraform ignores later changes to the live service task definition. Return to the repository root and run the migration and verification commands above. Continue only after `test "$MIGRATION_EXIT_CODE" = "0"` succeeds. Then update the service:

```bash
AWS_REGION=eu-central-1
ECS_CLUSTER="$(terraform -chdir=infra/aws output -raw ecs_cluster_name)"
ECS_SERVICE="$(terraform -chdir=infra/aws output -raw ecs_service_name)"
APPLICATION_TASK="$(terraform -chdir=infra/aws output -raw application_task_definition_arn)"
aws ecs update-service \
  --region "$AWS_REGION" \
  --cluster "$ECS_CLUSTER" \
  --service "$ECS_SERVICE" \
  --task-definition "$APPLICATION_TASK" \
  --force-new-deployment
aws ecs wait services-stable \
  --region "$AWS_REGION" \
  --cluster "$ECS_CLUSTER" \
  --services "$ECS_SERVICE"
```

The public listener redirects HTTP to HTTPS and uses the supplied ACM certificate. Check the application and migration log groups before retrying a failed release.

## Rotate credentials without a mixed fleet

Every ECS secret reference includes an explicit Secrets Manager version identifier. A Terraform apply registers a new task definition, but the service changes only after the explicit `aws ecs update-service` command. This keeps every running deployment on one reviewed set of secret versions. The application and migration task definitions use separate execution roles. The application role can read only its runtime database URL, authentication slots, and metrics slots. The migration role can read only the owner URL and the constrained role password.

Rotate `AUTH_SECRET` and `METRICS_TOKEN` in three stable deployments. First, keep the old value as primary and add the new value through `auth_secret_secondary` or `metrics_token_secondary`. Apply Terraform, update the service to the returned application task definition, and wait for stability. Second, make the new value primary and keep the old value as secondary, then repeat the apply and stable service update. Third, set the secondary variable to null and repeat the deployment. Do not advance until the previous service update is stable. Both secondary Secrets Manager resources are permanent slots. Setting a secondary variable to null removes only its secret version from the task definition, so another rotation can reuse the same name without waiting through a recovery window.

Rotate the application database credential with a new `database_application_username` and password. Apply Terraform to register the migration and application task definitions. Run the new migration task so it creates the new constrained role, verify its zero exit code, then deploy the new application task definition and wait for every old task to drain. Revoke and remove the old role only after no running task uses it. The RDS owner credential remains confined to the migration task and can be rotated separately through RDS and a new migration task definition.

## Availability and cost

The load balancer, application tasks, and database subnets span two availability zones. Multi AZ RDS keeps one synchronous standby and moves the writer endpoint during managed failover. The application continues to use that writer endpoint. It never sends balance reads to a lagging replica.

The enabled deployment uses two Fargate tasks, two NAT gateways, a `db.t4g.medium` writer, 50 GiB of storage, and 30 days of logs. Each private application subnet routes through the NAT gateway in its own availability zone. Set an AWS Budget outside this root, review log retention, and remove unused environments. Private VPC endpoints can replace some NAT traffic if their extra policy and operating cost fit the environment.

RDS deletion protection and the load balancer deletion protection are enabled. The RDS lifecycle also prevents Terraform destroy. A deliberate retirement requires a reviewed configuration change and a verified final snapshot.

## Validation

Run the same checks as CI from the repository root:

```bash
docker run --rm -v "$PWD:/workspace" -w /workspace hashicorp/terraform:1.15.8 fmt -check -recursive infra/aws
docker run --rm -v "$PWD:/workspace" -w /workspace/infra/aws hashicorp/terraform:1.15.8 init -backend=false
docker run --rm -v "$PWD:/workspace" -w /workspace/infra/aws hashicorp/terraform:1.15.8 validate
```
