#!/usr/bin/env python3
import json

# Read current config
with open('cloudfront-current-config.json', 'r') as f:
    data = json.load(f)

etag = data['ETag']
config = data['DistributionConfig']

# Add backend origin
backend_origin = {
    "Id": "EC2-team-expense-tracker-be",
    "DomainName": "ec2-43-200-6-114.ap-northeast-2.compute.amazonaws.com",
    "OriginPath": "",
    "CustomHeaders": {"Quantity": 0},
    "CustomOriginConfig": {
        "HTTPPort": 3001,
        "HTTPSPort": 443,
        "OriginProtocolPolicy": "http-only",
        "OriginSslProtocols": {
            "Quantity": 1,
            "Items": ["TLSv1.2"]
        },
        "OriginReadTimeout": 30,
        "OriginKeepaliveTimeout": 5
    },
    "ConnectionAttempts": 3,
    "ConnectionTimeout": 10,
    "OriginShield": {"Enabled": False}
}

config['Origins']['Items'].append(backend_origin)
config['Origins']['Quantity'] = len(config['Origins']['Items'])

# Add cache behavior for /api/*
api_cache_behavior = {
    "PathPattern": "/api/*",
    "TargetOriginId": "EC2-team-expense-tracker-be",
    "TrustedSigners": {"Enabled": False, "Quantity": 0},
    "TrustedKeyGroups": {"Enabled": False, "Quantity": 0},
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
        "Quantity": 7,
        "Items": ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"],
        "CachedMethods": {
            "Quantity": 2,
            "Items": ["GET", "HEAD"]
        }
    },
    "SmoothStreaming": False,
    "Compress": False,
    "LambdaFunctionAssociations": {"Quantity": 0},
    "FunctionAssociations": {"Quantity": 0},
    "FieldLevelEncryptionId": "",
    "CachePolicyId": "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
    "OriginRequestPolicyId": "216adef6-5c7f-47e4-b989-5492eafa07d3"
}

# Initialize CacheBehaviors if not exists
if 'Items' not in config['CacheBehaviors']:
    config['CacheBehaviors']['Items'] = []

config['CacheBehaviors']['Items'].append(api_cache_behavior)
config['CacheBehaviors']['Quantity'] = len(config['CacheBehaviors']['Items'])

# Save updated config
with open('cloudfront-updated-config.json', 'w') as f:
    json.dump(config, f, indent=2)

# Save ETag separately
with open('cloudfront-etag.txt', 'w') as f:
    f.write(etag)

print("✅ CloudFront config updated successfully")
print(f"   - Added backend origin: {backend_origin['DomainName']}")
print(f"   - Added cache behavior: /api/*")
print(f"   - ETag saved: {etag}")