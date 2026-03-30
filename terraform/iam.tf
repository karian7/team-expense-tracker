data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  name               = var.iam_role_name
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# -----------------------------------------------------------------------------
# Import blocks
# -----------------------------------------------------------------------------
import {
  to = aws_iam_role.lambda
  id = "team-expense-tracker-ApiFunctionRole-oYyTu5DtkvnS"
}

import {
  to = aws_iam_role_policy_attachment.lambda_basic_execution
  id = "team-expense-tracker-ApiFunctionRole-oYyTu5DtkvnS/arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}
