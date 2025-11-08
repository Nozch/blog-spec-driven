terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.46"
    }
  }
}

variable "aws_region" {
  type        = string
  description = "AWS region where draft storage bucket lives"
  default     = "ap-northeast-1"
}

variable "environment" {
  type        = string
  description = "Deployment environment suffix (e.g., dev, staging, prod)"
  default     = "dev"
}

provider "aws" {
  region = var.aws_region
}

locals {
  drafts_bucket_name = "blog-drafts-${var.environment}"
}

resource "aws_s3_bucket" "drafts" {
  bucket        = local.drafts_bucket_name
  force_destroy = false

  tags = {
    Feature = "personal-blog-publishing"
    Env     = var.environment
  }
}

resource "aws_s3_bucket_public_access_block" "drafts" {
  bucket = aws_s3_bucket.drafts.id

  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "drafts" {
  bucket = aws_s3_bucket.drafts.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "drafts" {
  bucket = aws_s3_bucket.drafts.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_policy" "drafts_encryption" {
  bucket = aws_s3_bucket.drafts.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Sid       = "DenyIncorrectEncryptionHeader",
        Effect    = "Deny",
        Principal = "*",
        Action    = "s3:PutObject",
        Resource  = "${aws_s3_bucket.drafts.arn}/*",
        Condition = {
          StringNotEquals = {
            "s3:x-amz-server-side-encryption" = "AES256"
          }
        }
      },
      {
        Sid       = "DenyUnEncryptedObjectUploads",
        Effect    = "Deny",
        Principal = "*",
        Action    = "s3:PutObject",
        Resource  = "${aws_s3_bucket.drafts.arn}/*",
        Condition = {
          Null = {
            "s3:x-amz-server-side-encryption" = "true"
          }
        }
      }
    ]
  })
}

data "aws_iam_policy_document" "drafts_rw" {
  statement {
    sid    = "AllowDraftUploadsEncrypted"
    effect = "Allow"

    actions = [
      "s3:PutObject",
    ]

    resources = ["${aws_s3_bucket.drafts.arn}/*"]

    condition {
      test     = "StringEquals"
      variable = "s3:x-amz-server-side-encryption"
      values   = ["AES256"]
    }
  }

  statement {
    sid    = "AllowDraftReadWrite"
    effect = "Allow"

    actions = [
      "s3:GetObject",
      "s3:DeleteObject",
      "s3:GetObjectTagging",
      "s3:PutObjectTagging"
    ]

    resources = ["${aws_s3_bucket.drafts.arn}/*"]
  }

  statement {
    sid    = "AllowBucketListing"
    effect = "Allow"
    actions = [
      "s3:ListBucket"
    ]
    resources = [aws_s3_bucket.drafts.arn]
  }
}

resource "aws_iam_policy" "drafts_rw" {
  name        = "blog-drafts-rw-${var.environment}"
  description = "Allows services to manage encrypted draft blobs in ${local.drafts_bucket_name}"
  policy      = data.aws_iam_policy_document.drafts_rw.json
}

output "draft_bucket_name" {
  description = "Name of the S3 bucket storing encrypted draft blobs."
  value       = aws_s3_bucket.drafts.bucket
}

output "draft_bucket_arn" {
  description = "ARN of the draft storage bucket."
  value       = aws_s3_bucket.drafts.arn
}

output "drafts_rw_policy_arn" {
  description = "IAM policy ARN granting read/write access to encrypted draft blobs."
  value       = aws_iam_policy.drafts_rw.arn
}
