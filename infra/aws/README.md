# AWS production deployment

This Terraform root creates one SuperCool Ledger environment in AWS. It has a VPC across two availability zones, a public Application Load Balancer, private ECS Fargate tasks, private RDS PostgreSQL 17, ECR, Secrets Manager, CloudWatch, and target tracking scaling from two tasks to six tasks.

Terraform creates no read replica. Every balance read goes to the PostgreSQL writer so a completed transfer is immediately visible without replica lag.

## Before the first plan

Use Terraform 1.15. Request or import an ACM certificate in the deployment region. The certificate must cover a name in the supplied Route 53 hosted zone. Copy the example values and replace every placeholder:

```bash
cd infra/aws
cp terraform.tfvars.example terraform.tfvars
```

Keep `terraform.tfvars` out of version control. The root writes the database password, authentication secret, metrics token, and database URL into Terraform state. Configure the S3 backend with encryption, versioning, blocked public access, narrow IAM access, and state locking before a production apply. Do not store production state on a laptop or in CI artifacts.

Initialize, inspect, and apply the configuration:

```bash
terraform init \
  -backend-config="bucket=YOUR_STATE_BUCKET" \
  -backend-config="key=supercool-ledger/production.tfstate" \
  -backend-config="region=eu-central-1" \
  -backend-config="encrypt=true" \
  -backend-config="use_lockfile=true"
terraform plan -out=production.tfplan
terraform apply production.tfplan
```

The first environment needs an ECR repository before the image digest exists. Create only that repository once, push the first image, record its digest in `terraform.tfvars`, then run the full plan and apply:

```bash
terraform apply -target=aws_ecr_repository.application
```

Targeted apply is only a bootstrap step. Do not use it for normal releases.

## Build and push the image

Run these commands from the repository root. Choose a unique release tag. ECR rejects a second push to the same tag.

```bash
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

Copy the returned digest into `image_digest`, then run `terraform plan` and `terraform apply`. The task definitions reference the image by digest, never by a mutable tag.

## Run the migration and release

Run the migration task before updating the service. The migration task runs `bun run db:migrate` with the same image digest and database URL as the application.

```bash
AWS_REGION=eu-central-1
ECS_CLUSTER="$(terraform -chdir=infra/aws output -raw ecs_cluster_name)"
ECS_SERVICE="$(terraform -chdir=infra/aws output -raw ecs_service_name)"
APPLICATION_TASK="$(terraform -chdir=infra/aws output -raw application_task_definition_arn)"
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
aws ecs describe-tasks \
  --region "$AWS_REGION" \
  --cluster "$ECS_CLUSTER" \
  --tasks "$MIGRATION_ARN" \
  --query 'tasks[0].containers[0].exitCode'
```

Continue only when the exit code is zero. Then update the service:

```bash
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

Terraform records new application task definitions but ignores the service task definition after initial creation. That lifecycle rule preserves the migration boundary for later releases. The public listener redirects HTTP to HTTPS and uses the supplied ACM certificate. The service deployment circuit breaker rolls back tasks that never pass `/health/ready`. Check the application and migration log groups before retrying a failed release.

## Availability and cost

The load balancer, application tasks, and database subnets span two availability zones. Multi AZ RDS keeps one synchronous standby and moves the writer endpoint during managed failover. The application continues to use that writer endpoint. It never sends balance reads to a lagging replica.

The default deployment uses two Fargate tasks, one cost aware NAT gateway, a `db.t4g.medium` writer, 50 GiB of storage, and 30 days of logs. One NAT gateway reduces cost but leaves private image pulls and external calls dependent on its availability zone. A stricter production recovery target should use one NAT gateway per availability zone or VPC endpoints. Set an AWS Budget outside this root, review log retention, and remove unused environments.

RDS deletion protection and the load balancer deletion protection are enabled. The RDS lifecycle also prevents Terraform destroy. A deliberate retirement requires a reviewed configuration change and a verified final snapshot.

## Validation

Run the same checks as CI from the repository root:

```bash
docker run --rm -v "$PWD:/workspace" -w /workspace hashicorp/terraform:1.15.8 fmt -check -recursive infra/aws
docker run --rm -v "$PWD:/workspace" -w /workspace/infra/aws hashicorp/terraform:1.15.8 init -backend=false
docker run --rm -v "$PWD:/workspace" -w /workspace/infra/aws hashicorp/terraform:1.15.8 validate
```
