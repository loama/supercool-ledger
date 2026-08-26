variable "aws_region" {
  description = "AWS region for every resource."
  type        = string
  default     = "eu-central-1"
}

variable "project_name" {
  description = "Project name used in resource names and tags."
  type        = string
  default     = "supercool-ledger"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project_name))
    error_message = "The project name must contain lowercase letters, numbers, and hyphens only."
  }
}

variable "environment" {
  description = "Deployment environment used in resource names and tags."
  type        = string
  default     = "production"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.environment))
    error_message = "The environment must contain lowercase letters, numbers, and hyphens only."
  }
}

variable "availability_zones" {
  description = "Exactly two availability zones for the environment."
  type        = list(string)
  default     = ["eu-central-1a", "eu-central-1b"]

  validation {
    condition     = length(var.availability_zones) == 2 && length(distinct(var.availability_zones)) == 2
    error_message = "Provide exactly two distinct availability zones."
  }
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.40.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for the two public load balancer subnets."
  type        = list(string)
  default     = ["10.40.0.0/24", "10.40.1.0/24"]

  validation {
    condition     = length(var.public_subnet_cidrs) == 2
    error_message = "Provide exactly two public subnet CIDR blocks."
  }
}

variable "application_subnet_cidrs" {
  description = "CIDR blocks for the two private application subnets."
  type        = list(string)
  default     = ["10.40.10.0/24", "10.40.11.0/24"]

  validation {
    condition     = length(var.application_subnet_cidrs) == 2
    error_message = "Provide exactly two application subnet CIDR blocks."
  }
}

variable "database_subnet_cidrs" {
  description = "CIDR blocks for the two private database subnets."
  type        = list(string)
  default     = ["10.40.20.0/24", "10.40.21.0/24"]

  validation {
    condition     = length(var.database_subnet_cidrs) == 2
    error_message = "Provide exactly two database subnet CIDR blocks."
  }
}

variable "alb_ingress_cidrs" {
  description = "Networks allowed to reach the public load balancer."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "certificate_arn" {
  description = "ACM certificate ARN for the public HTTPS listener."
  type        = string
  nullable    = false

  validation {
    condition     = can(regex("^arn:aws[a-z-]*:acm:[a-z0-9-]+:[0-9]{12}:certificate/.+$", var.certificate_arn))
    error_message = "Provide an ACM certificate ARN."
  }
}

variable "application_domain" {
  description = "Public DNS name covered by the ACM certificate."
  type        = string
  nullable    = false
}

variable "route53_zone_id" {
  description = "Route 53 hosted zone identifier for the public DNS record."
  type        = string
  nullable    = false
}

variable "image_digest" {
  description = "Immutable sha256 digest for the application image in ECR."
  type        = string

  validation {
    condition     = can(regex("^sha256:[0-9a-f]{64}$", var.image_digest))
    error_message = "The image digest must use the sha256 prefix and 64 lowercase hexadecimal characters."
  }
}

variable "container_port" {
  description = "Port exposed by the application container."
  type        = number
  default     = 3000
}

variable "task_cpu" {
  description = "Fargate CPU units for application and migration tasks."
  type        = number
  default     = 512
}

variable "task_memory" {
  description = "Fargate memory in MiB for application and migration tasks."
  type        = number
  default     = 1024
}

variable "bootstrap_mode" {
  description = "Whether Terraform omits the application service and autoscaling until migrations pass."
  type        = bool
  default     = true
}

variable "desired_task_count" {
  description = "Normal number of application tasks."
  type        = number
  default     = 2

  validation {
    condition     = var.desired_task_count >= 2 && var.desired_task_count <= 6
    error_message = "The desired task count must be between two and six."
  }
}

variable "database_name" {
  description = "PostgreSQL database name."
  type        = string
  default     = "supercool"
}

variable "database_username" {
  description = "PostgreSQL owner user used by this assessment deployment."
  type        = string
  default     = "supercool"
}

variable "database_password" {
  description = "PostgreSQL owner password stored in Terraform state and Secrets Manager."
  type        = string
  sensitive   = true
  nullable    = false

  validation {
    condition     = length(var.database_password) >= 20
    error_message = "The database password must contain at least 20 characters."
  }
}

variable "auth_secret" {
  description = "Application authentication secret stored in Terraform state and Secrets Manager."
  type        = string
  sensitive   = true
  nullable    = false

  validation {
    condition     = length(var.auth_secret) >= 32
    error_message = "The authentication secret must contain at least 32 characters."
  }
}

variable "metrics_token" {
  description = "Metrics bearer token stored in Terraform state and Secrets Manager."
  type        = string
  sensitive   = true
  nullable    = false

  validation {
    condition     = length(var.metrics_token) >= 32
    error_message = "The metrics token must contain at least 32 characters."
  }
}

variable "database_instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t4g.medium"
}

variable "database_allocated_storage" {
  description = "Initial RDS storage in GiB."
  type        = number
  default     = 50
}

variable "database_max_allocated_storage" {
  description = "Maximum RDS storage in GiB when storage autoscaling applies."
  type        = number
  default     = 200
}

variable "database_multi_az" {
  description = "Whether RDS maintains a synchronous standby in the second availability zone."
  type        = bool
  default     = true
}

variable "database_deletion_protection" {
  description = "Whether RDS rejects deletion through Terraform."
  type        = bool
  default     = true
}

variable "skip_final_snapshot" {
  description = "Whether RDS skips its final snapshot during deletion."
  type        = bool
  default     = false
}

variable "log_retention_days" {
  description = "CloudWatch log retention period."
  type        = number
  default     = 30
}

variable "alarm_sns_topic_arn" {
  description = "Optional SNS topic ARN for CloudWatch alarm actions."
  type        = string
  default     = null
  nullable    = true
}
