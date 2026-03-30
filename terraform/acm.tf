data "aws_acm_certificate" "wildcard" {
  provider = aws.us_east_1
  domain   = var.acm_certificate_domain
  statuses = ["ISSUED"]
}
