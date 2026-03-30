resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${var.lambda_function_name}"
  retention_in_days = 0
}

# -----------------------------------------------------------------------------
# Import block
# -----------------------------------------------------------------------------
import {
  to = aws_cloudwatch_log_group.lambda
  id = "/aws/lambda/team-expense-tracker-ApiFunction-kfud5RBOQhBP"
}
