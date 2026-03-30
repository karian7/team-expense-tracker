variable "region" {
  description = "AWS region"
  type        = string
  default     = "ap-northeast-2"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "team-expense-tracker"
}

variable "domain_name" {
  description = "Custom domain name for CloudFront"
  type        = string
  default     = "team-expenses.koasu.kim"
}

variable "acm_certificate_domain" {
  description = "ACM certificate domain (wildcard)"
  type        = string
  default     = "*.koasu.kim"
}

variable "s3_bucket_name" {
  description = "S3 bucket name for frontend"
  type        = string
  default     = "team-expense-tracker-fe"
}

variable "lambda_function_name" {
  description = "Lambda function name (SAM-generated)"
  type        = string
  default     = "team-expense-tracker-ApiFunction-kfud5RBOQhBP"
}

variable "ecr_repository_name" {
  description = "ECR repository name (SAM-generated)"
  type        = string
  default     = "teamexpensetrackerc8d13315/apifunction51503098repo"
}

variable "iam_role_name" {
  description = "IAM role name for Lambda (SAM-generated)"
  type        = string
  default     = "team-expense-tracker-ApiFunctionRole-oYyTu5DtkvnS"
}

variable "lambda_image_tag" {
  description = "Docker image tag for Lambda"
  type        = string
  default     = "latest"
}

variable "lambda_memory_size" {
  description = "Lambda memory size in MB"
  type        = number
  default     = 512
}

variable "lambda_timeout" {
  description = "Lambda timeout in seconds"
  type        = number
  default     = 60
}

variable "database_url" {
  description = "Supabase PostgreSQL connection URL (via PgBouncer)"
  type        = string
  sensitive   = true
}

variable "direct_url" {
  description = "Supabase PostgreSQL direct connection URL"
  type        = string
  sensitive   = true
}

variable "ocr_provider" {
  description = "OCR provider (openai | google | dummy)"
  type        = string
  default     = "openai"
}

variable "openai_api_key" {
  description = "OpenAI API key for OCR"
  type        = string
  sensitive   = true
}

variable "vapid_public_key" {
  description = "VAPID public key for Web Push"
  type        = string
}

variable "vapid_private_key" {
  description = "VAPID private key for Web Push"
  type        = string
  sensitive   = true
}

variable "vapid_email" {
  description = "VAPID contact email"
  type        = string
  default     = "mailto:ops@example.com"
}

variable "allowed_origins" {
  description = "Comma-separated allowed origins for Lambda CORS"
  type        = string
  default     = "https://kit.dev.9rum.cc"
}

variable "cors_allowed_origins" {
  description = "Allowed origins for API Gateway CORS"
  type        = list(string)
  default = [
    "https://kit.dev.9rum.cc",
    "https://team-expenses.koasu.kim",
    "http://localhost:5173",
    "http://localhost:3000",
  ]
}

variable "json_body_limit" {
  description = "JSON body size limit for Lambda"
  type        = string
  default     = "15mb"
}
