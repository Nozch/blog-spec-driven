# =============================================================================
# AWS SES Sender Identity Configuration
# =============================================================================
# Purpose: Configure SES domain identity for blog email notifications
# Supports: FR-006 (publish failure notifications), FR-013 (email format/sender)
# =============================================================================

locals {
  ses_mail_from_domain = "${var.ses_mail_from_subdomain}.${var.blog_domain}"
}

# -----------------------------------------------------------------------------
# Domain Identity
# -----------------------------------------------------------------------------
# Registers the blog domain with SES, allowing any *@blog_domain address
# to be used as a sender (e.g., publishing@blog.example.com)

resource "aws_ses_domain_identity" "blog" {
  domain = var.blog_domain
}

# -----------------------------------------------------------------------------
# DKIM Configuration
# -----------------------------------------------------------------------------
# Enables DomainKeys Identified Mail signing for improved deliverability.
# SES generates 3 CNAME records that must be added to DNS.

resource "aws_ses_domain_dkim" "blog" {
  domain = aws_ses_domain_identity.blog.domain
}

# -----------------------------------------------------------------------------
# Custom MAIL FROM Domain
# -----------------------------------------------------------------------------
# Configures a custom MAIL FROM domain for better deliverability and
# alignment with SPF/DMARC policies.

resource "aws_ses_domain_mail_from" "blog" {
  domain           = aws_ses_domain_identity.blog.domain
  mail_from_domain = local.ses_mail_from_domain

  # Behavior when MX record lookup fails
  # USE_DEFAULT_VALUE: Fall back to amazonses.com (recommended for reliability)
  behavior_on_mx_failure = "UseDefaultValue"
}

# -----------------------------------------------------------------------------
# IAM Policy for Email Sending
# -----------------------------------------------------------------------------
# Grants permission to send emails from the verified domain identity.
# Attach this policy to the application's IAM role/user.

data "aws_iam_policy_document" "ses_send" {
  statement {
    sid    = "AllowSendEmail"
    effect = "Allow"

    actions = [
      "ses:SendEmail",
      "ses:SendRawEmail",
    ]

    resources = [aws_ses_domain_identity.blog.arn]

    # Restrict sending to only the verified domain
    condition {
      test     = "StringLike"
      variable = "ses:FromAddress"
      values   = ["*@${var.blog_domain}"]
    }
  }

  statement {
    sid    = "AllowGetSendQuota"
    effect = "Allow"

    actions = [
      "ses:GetSendQuota",
      "ses:GetSendStatistics",
    ]

    resources = ["*"]
  }
}

resource "aws_iam_policy" "ses_send" {
  name        = "blog-ses-send-${var.environment}"
  description = "Allows sending emails from ${var.blog_domain} via SES"
  policy      = data.aws_iam_policy_document.ses_send.json

  tags = {
    Feature = "personal-blog-publishing"
    Env     = var.environment
  }
}

# =============================================================================
# Outputs
# =============================================================================
# These outputs provide:
# 1. DNS records for manual configuration
# 2. ARNs for application IAM policy attachment

# -----------------------------------------------------------------------------
# Domain Verification Outputs
# -----------------------------------------------------------------------------

output "ses_domain_identity_arn" {
  description = "ARN of the SES domain identity for IAM policy references"
  value       = aws_ses_domain_identity.blog.arn
}

output "ses_domain_verification_token" {
  description = "TXT record value for domain verification. Add as: TXT _amazonses.<your-domain> = <this value>"
  value       = aws_ses_domain_identity.blog.verification_token
}

# -----------------------------------------------------------------------------
# DKIM Outputs
# -----------------------------------------------------------------------------

output "ses_dkim_tokens" {
  description = "DKIM tokens for CNAME records. Add 3 CNAMEs: <token>._domainkey.<your-domain> -> <token>.dkim.amazonses.com"
  value       = aws_ses_domain_dkim.blog.dkim_tokens
}

# -----------------------------------------------------------------------------
# MAIL FROM Outputs
# -----------------------------------------------------------------------------

output "ses_mail_from_domain" {
  description = "Custom MAIL FROM domain. Requires MX and SPF records."
  value       = local.ses_mail_from_domain
}

# -----------------------------------------------------------------------------
# IAM Policy Output
# -----------------------------------------------------------------------------

output "ses_send_policy_arn" {
  description = "IAM policy ARN granting permission to send emails from the blog domain"
  value       = aws_iam_policy.ses_send.arn
}

# =============================================================================
# DNS Records Reference (for manual configuration)
# =============================================================================
#
# After running `terraform apply`, add these records to your DNS provider:
#
# 1. Domain Verification (TXT)
#    Name:  _amazonses.${var.blog_domain}
#    Value: ${aws_ses_domain_identity.blog.verification_token}
#
# 2. DKIM (3 CNAME records)
#    Name:  <token>._domainkey.${var.blog_domain}
#    Value: <token>.dkim.amazonses.com
#    (Repeat for all 3 tokens from ses_dkim_tokens output)
#
# 3. SPF for MAIL FROM (TXT)
#    Name:  ${local.ses_mail_from_domain}
#    Value: v=spf1 include:amazonses.com ~all
#
# 4. MX for MAIL FROM
#    Name:  ${local.ses_mail_from_domain}
#    Value: 10 feedback-smtp.ap-northeast-1.amazonses.com
#
# 5. DMARC (TXT) - Recommended
#    Name:  _dmarc.${var.blog_domain}
#    Value: v=DMARC1; p=none; rua=mailto:dmarc-reports@${var.blog_domain}
#
# =============================================================================
