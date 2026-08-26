output "application_url" {
  description = "Public URL for the application load balancer."
  value       = "https://${var.application_domain}"
}

output "ecr_repository_url" {
  description = "ECR repository URL for application images."
  value       = aws_ecr_repository.application.repository_url
}

output "ecs_cluster_name" {
  description = "ECS cluster name used by application and migration tasks."
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "ECS application service name."
  value       = aws_ecs_service.application.name
}

output "application_task_definition_arn" {
  description = "Task definition ARN for the application release."
  value       = aws_ecs_task_definition.application.arn
}

output "migration_task_definition_arn" {
  description = "Task definition ARN for one time database migrations."
  value       = aws_ecs_task_definition.migration.arn
}

output "application_subnet_ids" {
  description = "Private subnet identifiers for ECS tasks."
  value       = aws_subnet.application[*].id
}

output "application_security_group_id" {
  description = "Security group identifier for ECS tasks."
  value       = aws_security_group.application.id
}
