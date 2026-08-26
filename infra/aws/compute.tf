resource "aws_ecr_repository" "application" {
  name                 = local.name_prefix
  image_tag_mutability = "IMMUTABLE"

  encryption_configuration {
    encryption_type = "AES256"
  }

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "application" {
  repository = aws_ecr_repository.application.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Remove untagged images after 30 days"
      selection = {
        tagStatus   = "untagged"
        countType   = "sinceImagePushed"
        countUnit   = "days"
        countNumber = 30
      }
      action = {
        type = "expire"
      }
    }]
  })
}

resource "aws_ecs_cluster" "main" {
  name = local.name_prefix

  setting {
    name  = "containerInsights"
    value = "enhanced"
  }
}

data "aws_iam_policy_document" "ecs_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "task_execution" {
  name               = "${local.name_prefix}-task-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume_role.json
}

resource "aws_iam_role_policy_attachment" "task_execution" {
  role       = aws_iam_role.task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "task_execution_secrets" {
  statement {
    actions = ["secretsmanager:GetSecretValue"]
    resources = concat(
      [
        aws_secretsmanager_secret.application_database_password.arn,
        aws_secretsmanager_secret.auth_secret.arn,
        aws_secretsmanager_secret.database_url.arn,
        aws_secretsmanager_secret.metrics_token.arn,
        aws_secretsmanager_secret.migration_database_url.arn,
      ],
      var.auth_secret_secondary == null ? [] : [aws_secretsmanager_secret.auth_secret_secondary[0].arn],
      var.metrics_token_secondary == null ? [] : [aws_secretsmanager_secret.metrics_token_secondary[0].arn],
    )
  }
}

resource "aws_iam_role_policy" "task_execution_secrets" {
  name   = "secrets"
  role   = aws_iam_role.task_execution.id
  policy = data.aws_iam_policy_document.task_execution_secrets.json
}

resource "aws_iam_role" "application_task" {
  name               = "${local.name_prefix}-application-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume_role.json
}

locals {
  application_image = "${aws_ecr_repository.application.repository_url}@${var.image_digest}"
  container_secrets = concat(
    [
      {
        name      = "AUTH_SECRET"
        valueFrom = "${aws_secretsmanager_secret.auth_secret.arn}:::${aws_secretsmanager_secret_version.auth_secret.version_id}"
      },
      {
        name      = "DATABASE_URL"
        valueFrom = "${aws_secretsmanager_secret.database_url.arn}:::${aws_secretsmanager_secret_version.database_url.version_id}"
      },
      {
        name      = "METRICS_TOKEN"
        valueFrom = "${aws_secretsmanager_secret.metrics_token.arn}:::${aws_secretsmanager_secret_version.metrics_token.version_id}"
      },
    ],
    var.auth_secret_secondary == null ? [] : [{
      name      = "AUTH_SECRET_SECONDARY"
      valueFrom = "${aws_secretsmanager_secret.auth_secret_secondary[0].arn}:::${aws_secretsmanager_secret_version.auth_secret_secondary[0].version_id}"
    }],
    var.metrics_token_secondary == null ? [] : [{
      name      = "METRICS_TOKEN_SECONDARY"
      valueFrom = "${aws_secretsmanager_secret.metrics_token_secondary[0].arn}:::${aws_secretsmanager_secret_version.metrics_token_secondary[0].version_id}"
    }],
  )
  migration_secrets = [
    {
      name      = "APPLICATION_DATABASE_PASSWORD"
      valueFrom = "${aws_secretsmanager_secret.application_database_password.arn}:::${aws_secretsmanager_secret_version.application_database_password.version_id}"
    },
    {
      name      = "DATABASE_URL"
      valueFrom = "${aws_secretsmanager_secret.migration_database_url.arn}:::${aws_secretsmanager_secret_version.migration_database_url.version_id}"
    },
  ]
}

resource "aws_ecs_task_definition" "application" {
  family                   = "${local.name_prefix}-application"
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.application_task.arn

  container_definitions = jsonencode([{
    name      = "application"
    image     = local.application_image
    essential = true
    portMappings = [{
      containerPort = var.container_port
      hostPort      = var.container_port
      protocol      = "tcp"
      name          = "http"
    }]
    environment = [
      { name = "HOST", value = "0.0.0.0" },
      { name = "LOG_LEVEL", value = "info" },
      { name = "PORT", value = tostring(var.container_port) },
      { name = "SANDBOX_ENABLED", value = "false" },
    ]
    secrets = local.container_secrets
    healthCheck = {
      command = [
        "CMD-SHELL",
        "bun -e 'fetch(\"http://127.0.0.1:${var.container_port}/health/ready\").then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))'",
      ]
      interval    = 30
      retries     = 3
      startPeriod = 30
      timeout     = 5
    }
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.application.name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "application"
      }
    }
  }])

  depends_on = [
    aws_iam_role_policy.task_execution_secrets,
    aws_iam_role_policy_attachment.task_execution,
    aws_secretsmanager_secret_version.application_database_password,
    aws_secretsmanager_secret_version.auth_secret,
    aws_secretsmanager_secret_version.auth_secret_secondary,
    aws_secretsmanager_secret_version.database_url,
    aws_secretsmanager_secret_version.metrics_token,
    aws_secretsmanager_secret_version.metrics_token_secondary,
    aws_secretsmanager_secret_version.migration_database_url,
  ]
}

resource "aws_ecs_task_definition" "migration" {
  family                   = "${local.name_prefix}-migration"
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.application_task.arn

  container_definitions = jsonencode([{
    name      = "migration"
    image     = local.application_image
    essential = true
    command   = ["bun", "run", "db:migrate"]
    environment = [
      { name = "LOG_LEVEL", value = "info" },
      { name = "APPLICATION_DATABASE_USERNAME", value = var.database_application_username },
    ]
    secrets = local.migration_secrets
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.migration.name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "migration"
      }
    }
  }])

  depends_on = [
    aws_iam_role_policy.task_execution_secrets,
    aws_iam_role_policy_attachment.task_execution,
    aws_secretsmanager_secret_version.application_database_password,
    aws_secretsmanager_secret_version.auth_secret,
    aws_secretsmanager_secret_version.auth_secret_secondary,
    aws_secretsmanager_secret_version.database_url,
    aws_secretsmanager_secret_version.metrics_token,
    aws_secretsmanager_secret_version.metrics_token_secondary,
    aws_secretsmanager_secret_version.migration_database_url,
  ]
}

resource "aws_lb" "application" {
  name               = substr(local.name_prefix, 0, 32)
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.load_balancer.id]
  subnets            = aws_subnet.public[*].id

  drop_invalid_header_fields = true
  enable_deletion_protection = true
}

resource "aws_lb_target_group" "application" {
  name        = substr("${local.name_prefix}-app", 0, 32)
  port        = var.container_port
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.main.id

  deregistration_delay = 30

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/health/ready"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 3
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.application.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.application.arn
  port              = 443
  protocol          = "HTTPS"
  certificate_arn   = var.certificate_arn
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.application.arn
  }
}

resource "aws_route53_record" "application" {
  zone_id = var.route53_zone_id
  name    = var.application_domain
  type    = "A"

  alias {
    name                   = aws_lb.application.dns_name
    zone_id                = aws_lb.application.zone_id
    evaluate_target_health = true
  }
}

resource "aws_ecs_service" "application" {
  count = var.bootstrap_mode ? 0 : 1

  name            = local.name_prefix
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.application.arn
  desired_count   = var.desired_task_count
  launch_type     = "FARGATE"

  enable_ecs_managed_tags           = true
  health_check_grace_period_seconds = 60
  propagate_tags                    = "SERVICE"

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  network_configuration {
    assign_public_ip = false
    security_groups  = [aws_security_group.application.id]
    subnets          = aws_subnet.application[*].id
  }

  load_balancer {
    container_name   = "application"
    container_port   = var.container_port
    target_group_arn = aws_lb_target_group.application.arn
  }

  depends_on = [aws_lb_listener.https]

  lifecycle {
    ignore_changes  = [desired_count, task_definition]
    prevent_destroy = true
  }
}

resource "aws_appautoscaling_target" "application" {
  count = var.bootstrap_mode ? 0 : 1

  max_capacity       = 6
  min_capacity       = 2
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.application[0].name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "application_cpu" {
  count = var.bootstrap_mode ? 0 : 1

  name               = "${local.name_prefix}-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.application[0].resource_id
  scalable_dimension = aws_appautoscaling_target.application[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.application[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }

    scale_in_cooldown  = 300
    scale_out_cooldown = 60
    target_value       = 60
  }
}
