locals {
  alarm_actions = var.alarm_sns_topic_arn == null ? [] : [var.alarm_sns_topic_arn]
}

resource "aws_cloudwatch_log_group" "application" {
  name              = "/ecs/${local.name_prefix}/application"
  retention_in_days = var.log_retention_days
}

resource "aws_cloudwatch_log_group" "migration" {
  name              = "/ecs/${local.name_prefix}/migration"
  retention_in_days = var.log_retention_days
}

resource "aws_cloudwatch_metric_alarm" "unhealthy_targets" {
  alarm_name          = "${local.name_prefix}-unhealthy-targets"
  alarm_description   = "One or more application targets are unhealthy"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Maximum"
  threshold           = 1
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions

  dimensions = {
    LoadBalancer = aws_lb.application.arn_suffix
    TargetGroup  = aws_lb_target_group.application.arn_suffix
  }
}

resource "aws_cloudwatch_metric_alarm" "no_healthy_targets" {
  count = var.bootstrap_mode ? 0 : 1

  alarm_name          = "${local.name_prefix}-no-healthy-targets"
  alarm_description   = "The enabled service has no healthy application targets"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Minimum"
  threshold           = 1
  treat_missing_data  = "breaching"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions

  dimensions = {
    LoadBalancer = aws_lb.application.arn_suffix
    TargetGroup  = aws_lb_target_group.application.arn_suffix
  }
}

resource "aws_cloudwatch_metric_alarm" "database_cpu" {
  alarm_name          = "${local.name_prefix}-database-cpu"
  alarm_description   = "PostgreSQL writer CPU remains above 80 percent"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  treat_missing_data  = "missing"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.writer.identifier
  }
}

resource "aws_cloudwatch_metric_alarm" "database_free_storage" {
  alarm_name          = "${local.name_prefix}-database-free-storage"
  alarm_description   = "PostgreSQL writer has less than 10 GiB of free storage"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 10737418240
  treat_missing_data  = "missing"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.writer.identifier
  }
}

resource "aws_cloudwatch_metric_alarm" "database_connections" {
  alarm_name          = "${local.name_prefix}-database-connections"
  alarm_description   = "PostgreSQL writer has more than 80 active connections"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  treat_missing_data  = "missing"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.writer.identifier
  }
}
