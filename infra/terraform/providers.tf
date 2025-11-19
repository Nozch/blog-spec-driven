terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    upstash = {
      source  = "upstash/upstash"
      version = "~> 2.1"
    }
  }
}
