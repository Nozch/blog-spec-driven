variable "upstash_api_key" {
  type        = string
  description = "Upstash REST API key for managing Redis databases"
}

variable "upstash_email" {
  type        = string
  description = "Email associated with the Upstash account"
}

variable "redis_region" {
  type        = string
  description = "Desired Upstash Redis region"
  default     = "ap-northeast-1"
}

provider "upstash" {
  api_key = var.upstash_api_key
  email   = var.upstash_email
}

resource "upstash_redis_database" "publisher_queue" {
  database_name = "publisher-queue-${var.environment}"
  region        = var.redis_region
  tls           = true
  eviction      = false
}

output "redis_rest_url" {
  description = "Upstash REST endpoint for BullMQ publisher queue."
  value       = upstash_redis_database.publisher_queue.endpoint
}
