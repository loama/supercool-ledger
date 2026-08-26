resource "aws_db_subnet_group" "main" {
  name       = local.name_prefix
  subnet_ids = aws_subnet.database[*].id

  tags = {
    Name = local.name_prefix
  }
}

resource "aws_db_instance" "writer" {
  identifier = local.name_prefix

  engine         = "postgres"
  engine_version = "17.6"
  instance_class = var.database_instance_class

  allocated_storage     = var.database_allocated_storage
  max_allocated_storage = var.database_max_allocated_storage
  storage_encrypted     = true
  storage_type          = "gp3"

  db_name  = var.database_name
  username = var.database_username
  password = var.database_password
  port     = 5432

  auto_minor_version_upgrade      = true
  backup_retention_period         = 7
  copy_tags_to_snapshot           = true
  deletion_protection             = var.database_deletion_protection
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
  final_snapshot_identifier       = var.skip_final_snapshot ? null : "${local.name_prefix}-final"
  multi_az                        = var.database_multi_az
  performance_insights_enabled    = true
  publicly_accessible             = false
  skip_final_snapshot             = var.skip_final_snapshot

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.database.id]

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_secretsmanager_secret" "database_url" {
  name                    = "${local.name_prefix}/database-url"
  description             = "Least privilege PostgreSQL writer URL for the application"
  recovery_window_in_days = 30
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id = aws_secretsmanager_secret.database_url.id
  secret_string = format(
    "postgres://%s:%s@%s:%d/%s?sslmode=require",
    urlencode(var.database_application_username),
    urlencode(var.database_application_password),
    aws_db_instance.writer.address,
    aws_db_instance.writer.port,
    var.database_name,
  )
}

resource "aws_secretsmanager_secret" "migration_database_url" {
  name                    = "${local.name_prefix}/migration-database-url"
  description             = "PostgreSQL owner URL used only by the migration task"
  recovery_window_in_days = 30
}

resource "aws_secretsmanager_secret_version" "migration_database_url" {
  secret_id = aws_secretsmanager_secret.migration_database_url.id
  secret_string = format(
    "postgres://%s:%s@%s:%d/%s?sslmode=require",
    urlencode(var.database_username),
    urlencode(var.database_password),
    aws_db_instance.writer.address,
    aws_db_instance.writer.port,
    var.database_name,
  )
}

resource "aws_secretsmanager_secret" "application_database_password" {
  name                    = "${local.name_prefix}/application-database-password"
  description             = "Password used by migrations to provision the application login"
  recovery_window_in_days = 30
}

resource "aws_secretsmanager_secret_version" "application_database_password" {
  secret_id     = aws_secretsmanager_secret.application_database_password.id
  secret_string = var.database_application_password
}

resource "aws_secretsmanager_secret" "auth_secret" {
  name                    = "${local.name_prefix}/auth-secret"
  description             = "Application authentication secret"
  recovery_window_in_days = 30
}

resource "aws_secretsmanager_secret_version" "auth_secret" {
  secret_id     = aws_secretsmanager_secret.auth_secret.id
  secret_string = var.auth_secret
}

resource "aws_secretsmanager_secret" "auth_secret_secondary" {
  count = var.auth_secret_secondary == null ? 0 : 1

  name                    = "${local.name_prefix}/auth-secret-secondary"
  description             = "Second application authentication secret used during rotation"
  recovery_window_in_days = 30
}

resource "aws_secretsmanager_secret_version" "auth_secret_secondary" {
  count = var.auth_secret_secondary == null ? 0 : 1

  secret_id     = aws_secretsmanager_secret.auth_secret_secondary[0].id
  secret_string = var.auth_secret_secondary
}

resource "aws_secretsmanager_secret" "metrics_token" {
  name                    = "${local.name_prefix}/metrics-token"
  description             = "Application metrics bearer token"
  recovery_window_in_days = 30
}

resource "aws_secretsmanager_secret_version" "metrics_token" {
  secret_id     = aws_secretsmanager_secret.metrics_token.id
  secret_string = var.metrics_token
}

resource "aws_secretsmanager_secret" "metrics_token_secondary" {
  count = var.metrics_token_secondary == null ? 0 : 1

  name                    = "${local.name_prefix}/metrics-token-secondary"
  description             = "Second metrics bearer token used during rotation"
  recovery_window_in_days = 30
}

resource "aws_secretsmanager_secret_version" "metrics_token_secondary" {
  count = var.metrics_token_secondary == null ? 0 : 1

  secret_id     = aws_secretsmanager_secret.metrics_token_secondary[0].id
  secret_string = var.metrics_token_secondary
}
