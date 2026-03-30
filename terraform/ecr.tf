resource "aws_ecr_repository" "api" {
  name                 = var.ecr_repository_name
  image_tag_mutability = "MUTABLE"

  encryption_configuration {
    encryption_type = "AES256"
  }

  image_scanning_configuration {
    scan_on_push = false
  }
}

# -----------------------------------------------------------------------------
# Import block
# -----------------------------------------------------------------------------
import {
  to = aws_ecr_repository.api
  id = "teamexpensetrackerc8d13315/apifunction51503098repo"
}
