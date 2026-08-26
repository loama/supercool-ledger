# AWS production deployment

This Terraform root creates one SuperCool Ledger environment in AWS. It has a VPC across two availability zones, a public Application Load Balancer, private ECS Fargate tasks, private RDS PostgreSQL 17, ECR, Secrets Manager, CloudWatch, and target tracking scaling from two tasks to six tasks.

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

Run the image commands from the repository root. Choose a unique release tag. ECR rejects a second push to the same tag.

```bash
cd ../..
AWS_REGION=eu-central-1
ECR_REPOSITORY_URL="$(terraform -chdir=infra/aws output -raw ecr_repository_url)"
RELEASE_TAG="$(git rev-parse --short=12 HEAD)"
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

Copy the returned digest into `image_digest`. Task definitions reference that digest, never a mutable tag.

## Apply the bootstrap state

Confirm that `bootstrap_mode` remains `true`. Inspect and apply the bootstrap plan:

```bash
cd infra/aws
terraform plan -out=bootstrap.tfplan
terraform apply bootstrap.tfplan
```

The bootstrap apply produces the cluster, migration task, private subnet, and security group outputs. The `ecs_service_name` output remains null because no service or autoscaling resource exists yet.

## Run and verify the migration

Run the migration task before enabling or updating the service. The migration task runs `bun run db:migrate` with the same image digest and database URL as the application.

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

## Availability and cost

The load balancer, application tasks, and database subnets span two availability zones. Multi AZ RDS keeps one synchronous standby and moves the writer endpoint during managed failover. The application continues to use that writer endpoint. It never sends balance reads to a lagging replica.

The enabled deployment uses two Fargate tasks, one cost aware NAT gateway, a `db.t4g.medium` writer, 50 GiB of storage, and 30 days of logs. One NAT gateway reduces cost but leaves private image pulls and external calls dependent on its availability zone. A stricter production recovery target should use one NAT gateway per availability zone or VPC endpoints. Set an AWS Budget outside this root, review log retention, and remove unused environments.

RDS deletion protection and the load balancer deletion protection are enabled. The RDS lifecycle also prevents Terraform destroy. A deliberate retirement requires a reviewed configuration change and a verified final snapshot.

## Validation

Run the same checks as CI from the repository root:

```bash
docker run --rm -v "$PWD:/workspace" -w /workspace hashicorp/terraform:1.15.8 fmt -check -recursive infra/aws
docker run --rm -v "$PWD:/workspace" -w /workspace/infra/aws hashicorp/terraform:1.15.8 init -backend=false
docker run --rm -v "$PWD:/workspace" -w /workspace/infra/aws hashicorp/terraform:1.15.8 validate
```
