resource "aws_lambda_function" "api" {
  function_name = var.lambda_function_name
  role          = aws_iam_role.lambda.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.api.repository_url}:${var.lambda_image_tag}"
  architectures = ["arm64"]
  memory_size   = var.lambda_memory_size
  timeout       = var.lambda_timeout

  environment {
    variables = {
      NODE_ENV          = "production"
      DATABASE_URL      = var.database_url
      DIRECT_URL        = var.direct_url
      OCR_PROVIDER      = var.ocr_provider
      OPENAI_API_KEY    = var.openai_api_key
      VAPID_PUBLIC_KEY  = var.vapid_public_key
      VAPID_PRIVATE_KEY = var.vapid_private_key
      VAPID_EMAIL       = var.vapid_email
      ALLOWED_ORIGINS   = var.allowed_origins
      JSON_BODY_LIMIT   = var.json_body_limit
    }
  }

  lifecycle {
    ignore_changes = [image_uri]
  }
}

resource "aws_lambda_permission" "api_gateway_root" {
  statement_id  = "team-expense-tracker-ApiFunctionRootApiPermission-ckKSCnUiNLIH"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*/"
}

resource "aws_lambda_permission" "api_gateway_proxy" {
  statement_id  = "team-expense-tracker-ApiFunctionProxyApiPermission-FmPs4XThRuLK"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*/*"
}

# -----------------------------------------------------------------------------
# Import blocks
# -----------------------------------------------------------------------------
import {
  to = aws_lambda_function.api
  id = "team-expense-tracker-ApiFunction-kfud5RBOQhBP"
}

import {
  to = aws_lambda_permission.api_gateway_root
  id = "team-expense-tracker-ApiFunction-kfud5RBOQhBP/team-expense-tracker-ApiFunctionRootApiPermission-ckKSCnUiNLIH"
}

import {
  to = aws_lambda_permission.api_gateway_proxy
  id = "team-expense-tracker-ApiFunction-kfud5RBOQhBP/team-expense-tracker-ApiFunctionProxyApiPermission-FmPs4XThRuLK"
}
