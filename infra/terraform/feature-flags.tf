terraform {
  required_version = ">= 1.5.0"
}

# data "terraform_remote_state" "flags" {
#   backend = "local"
#   config = {
#     path = "./feature-flags-${var.environment}.tfstate"
#   }
# }

resource "terraform_data" "personal_blog_publishing" {
  input = {
    flag_name = "personal-blog-publishing"
    enabled   = false
  }
}
