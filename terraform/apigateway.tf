resource "aws_apigatewayv2_api" "main" {
  name          = var.project_name
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins     = var.cors_allowed_origins
    allow_methods     = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers     = ["Content-Type", "Authorization"]
    allow_credentials = true
  }
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_apigatewayv2_integration" "lambda_root" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "lambda_proxy" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "root" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "ANY /"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_root.id}"
}

resource "aws_apigatewayv2_route" "proxy" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "ANY /{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_proxy.id}"
}

# -----------------------------------------------------------------------------
# Import blocks
# -----------------------------------------------------------------------------
import {
  to = aws_apigatewayv2_api.main
  id = "qmbrr74d9h"
}

import {
  to = aws_apigatewayv2_stage.default
  id = "qmbrr74d9h/$default"
}

import {
  to = aws_apigatewayv2_integration.lambda_root
  id = "qmbrr74d9h/rvs62dk"
}

import {
  to = aws_apigatewayv2_integration.lambda_proxy
  id = "qmbrr74d9h/p92py6c"
}

import {
  to = aws_apigatewayv2_route.root
  id = "qmbrr74d9h/kb01qq0"
}

import {
  to = aws_apigatewayv2_route.proxy
  id = "qmbrr74d9h/4a9xe2b"
}
