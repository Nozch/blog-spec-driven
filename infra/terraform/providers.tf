terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.46"
    }
    upstash = {
      source  = "upstash/upstash"
      version = "~> 1.3"
    }
  }
}
