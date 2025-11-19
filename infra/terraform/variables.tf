variable "environment" {
  type        = string
  description = "Deployment environment: dev, staging, prod"
  default     = "dev"
}

variable "blog_domain" {
  type        = string
  description = "Root domain for blog email sending (e.g., blog.example.com)"
  default     = "nozchdesign.org"
}

variable "ses_mail_from_subdomain" {
  type        = string
  description = "Subdomain for custom MAIL FROM domain"
  default     = "mail"
}
