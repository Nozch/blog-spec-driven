variable "upstash_api_key" {
  type        = string
  description = "Upstash REST API key for managing Redis databases"
}

variable "upstash_email" {
  type        = string
  description = "Email associated with the Upstash account"
}


provider "upstash" {
  api_key = var.upstash_api_key
  email   = var.upstash_email
}

resource "upstash_redis_database" "publisher_queue" {
  database_name   = "publisher-queue-${var.environment}"
  tls             = true
  eviction        = false
  region          = "global" 
  primary_region  = "ap-northeast-1"
}

output "redis_rest_url" {
  description = "Upstash REST endpoint for BullMQ publisher queue."
  value       = upstash_redis_database.publisher_queue.endpoint
}
