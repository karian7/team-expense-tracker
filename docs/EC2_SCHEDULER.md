# EC2 자동 중지/시작 Lambda 스케줄러

## 개요

평일 야간 시간(23:00-09:00 KST)에 EC2 인스턴스를 자동으로 중지하여 비용을 절감하는 Lambda 스케줄러입니다.

### 비용 절감 효과

- **월 절감액**: $1.98 (472시간 중지)
- **연 절감액**: $23.76
- **Lambda 추가 비용**: $0 (Free Tier 범위 내)

### 대상 리소스

- **EC2 인스턴스**: i-02e27c45dc05f5c03
- **이름**: team-expense-tracker
- **타입**: t4g.nano (ARM64)
- **리전**: ap-northeast-2 (서울)
- **용도**: Backend API 서버

## 스케줄

| 시간 | 동작 | UTC 시간 | 실행 요일 | EventBridge Cron |
|------|------|---------|----------|------------------|
| 23:00 KST | EC2 중지 | 14:00 UTC | 월~금 | `cron(0 14 ? * MON-FRI *)` |
| 09:00 KST | EC2 시작 | 00:00 UTC | 월~금 | `cron(0 0 ? * MON-FRI *)` |
| 주말 | 중지 상태 유지 | - | 토~일 | Start Lambda가 주말 체크 |

## 아키텍처

```
EventBridge Scheduler
┌─────────────────────────────────┐
│ stop-ec2-weekday-rule           │
│ cron(0 14 ? * MON-FRI *)        │  ← 평일 14:00 UTC (23:00 KST)
└──────────────┬──────────────────┘
               ↓
        ┌──────────────┐
        │ stop-ec2-    │
        │ scheduler    │ ← Lambda (Python 3.12)
        └──────┬───────┘
               ↓
        EC2 Stop Instances
               ↓
    ┌──────────────────────┐
    │ i-02e27c45dc05f5c03  │
    │ team-expense-tracker │
    └──────────────────────┘
               ↑
        EC2 Start Instances
               ↑
        ┌──────┴───────┐
        │ start-ec2-   │
        │ scheduler    │ ← Lambda (Python 3.12 + pytz)
        └──────────────┘   주말 체크 로직 포함
               ↑
┌──────────────┴──────────────────┐
│ start-ec2-weekday-rule          │
│ cron(0 0 ? * MON-FRI *)         │  ← 평일 00:00 UTC (09:00 KST)
└─────────────────────────────────┘
```

## 구축된 AWS 리소스

### 1. IAM Role
- **이름**: `lambda-ec2-scheduler-role`
- **ARN**: `arn:aws:iam::637423484158:role/lambda-ec2-scheduler-role`
- **권한**:
  - `AWSLambdaBasicExecutionRole` (관리형 정책)
  - `ec2-scheduler-policy` (인라인 정책)
    - `ec2:DescribeInstances`
    - `ec2:StopInstances`
    - `ec2:StartInstances`
    - 조건: 서울 리전만 허용

### 2. Lambda Functions

#### Stop Lambda
- **함수 이름**: `stop-ec2-scheduler`
- **ARN**: `arn:aws:lambda:ap-northeast-2:637423484158:function:stop-ec2-scheduler`
- **런타임**: Python 3.12
- **핸들러**: `stop_instance.lambda_handler`
- **메모리**: 128MB
- **타임아웃**: 10초
- **환경 변수**: `INSTANCE_ID=i-02e27c45dc05f5c03`
- **로그 그룹**: `/aws/lambda/stop-ec2-scheduler`

#### Start Lambda
- **함수 이름**: `start-ec2-scheduler`
- **ARN**: `arn:aws:lambda:ap-northeast-2:637423484158:function:start-ec2-scheduler`
- **런타임**: Python 3.12
- **핸들러**: `start_instance.lambda_handler`
- **메모리**: 128MB
- **타임아웃**: 10초
- **의존성**: pytz (timezone 처리)
- **환경 변수**: `INSTANCE_ID=i-02e27c45dc05f5c03`
- **로그 그룹**: `/aws/lambda/start-ec2-scheduler`

### 3. EventBridge Rules

#### Stop Rule
- **규칙 이름**: `stop-ec2-weekday-rule`
- **ARN**: `arn:aws:events:ap-northeast-2:637423484158:rule/stop-ec2-weekday-rule`
- **스케줄**: `cron(0 14 ? * MON-FRI *)`
- **상태**: ENABLED
- **타겟**: stop-ec2-scheduler Lambda

#### Start Rule
- **규칙 이름**: `start-ec2-weekday-rule`
- **ARN**: `arn:aws:events:ap-northeast-2:637423484158:rule/start-ec2-weekday-rule`
- **스케줄**: `cron(0 0 ? * MON-FRI *)`
- **상태**: ENABLED
- **타겟**: start-ec2-scheduler Lambda

## 전체 구축 명령어

### 1단계: 준비 작업

```bash
# 작업 디렉토리 생성
mkdir -p ~/lambda-scheduler
cd ~/lambda-scheduler

# AWS 계정 정보 확인
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export AWS_REGION=ap-northeast-2
echo "Account ID: $ACCOUNT_ID"
```

### 2단계: IAM 역할 생성

```bash
# Trust Policy 파일 생성
cat > trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "lambda.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}
EOF

# EC2 Scheduler Policy 파일 생성
cat > ec2-scheduler-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "ec2:DescribeInstances",
      "ec2:StopInstances",
      "ec2:StartInstances"
    ],
    "Resource": "*",
    "Condition": {
      "StringEquals": {"ec2:Region": "ap-northeast-2"}
    }
  }]
}
EOF

# IAM 역할 생성
aws iam create-role \
  --role-name lambda-ec2-scheduler-role \
  --assume-role-policy-document file://trust-policy.json \
  --description "Role for Lambda to start/stop EC2 instances on schedule"

# 관리형 정책 연결
aws iam attach-role-policy \
  --role-name lambda-ec2-scheduler-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# 인라인 정책 추가
aws iam put-role-policy \
  --role-name lambda-ec2-scheduler-role \
  --policy-name ec2-scheduler-policy \
  --policy-document file://ec2-scheduler-policy.json

# IAM 전파 대기
sleep 10
```

### 3단계: Lambda 함수 코드 작성

```bash
# Stop Lambda 코드 작성
cat > stop_instance.py << 'EOF'
import boto3
import os
import json

def lambda_handler(event, context):
    instance_id = os.environ.get('INSTANCE_ID')
    region = os.environ.get('AWS_REGION', 'ap-northeast-2')

    if not instance_id:
        print("ERROR: INSTANCE_ID not set")
        return {'statusCode': 400, 'body': json.dumps('INSTANCE_ID not set')}

    ec2 = boto3.client('ec2', region_name=region)

    try:
        response = ec2.describe_instances(InstanceIds=[instance_id])
        if not response['Reservations']:
            return {'statusCode': 404, 'body': json.dumps('Instance not found')}

        instance = response['Reservations'][0]['Instances'][0]
        current_state = instance['State']['Name']
        instance_name = next((tag['Value'] for tag in instance.get('Tags', []) if tag['Key'] == 'Name'), 'Unknown')

        print(f"Instance: {instance_name} ({instance_id}), State: {current_state}")

        if current_state == 'stopped':
            return {'statusCode': 200, 'body': json.dumps({'message': 'Already stopped'})}

        if current_state in ['stopping', 'pending', 'shutting-down', 'terminating', 'terminated']:
            return {'statusCode': 200, 'body': json.dumps({'message': f'Skipped (state: {current_state})'})}

        stop_response = ec2.stop_instances(InstanceIds=[instance_id])
        new_state = stop_response['StoppingInstances'][0]['CurrentState']['Name']

        print(f"Successfully stopped instance. New state: {new_state}")
        return {'statusCode': 200, 'body': json.dumps({'message': 'Successfully stopped', 'new_state': new_state})}

    except Exception as e:
        print(f"ERROR: {str(e)}")
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)})}
EOF

# Start Lambda 코드 작성
cat > start_instance.py << 'EOF'
import boto3
import os
import json
from datetime import datetime
import pytz

def lambda_handler(event, context):
    instance_id = os.environ.get('INSTANCE_ID')
    region = os.environ.get('AWS_REGION', 'ap-northeast-2')

    if not instance_id:
        print("ERROR: INSTANCE_ID not set")
        return {'statusCode': 400, 'body': json.dumps('INSTANCE_ID not set')}

    # 주말 체크 (KST 기준)
    kst = pytz.timezone('Asia/Seoul')
    now_kst = datetime.now(kst)
    weekday = now_kst.weekday()  # 0=Monday, 6=Sunday
    weekday_name = now_kst.strftime('%A')

    print(f"Current KST: {now_kst.strftime('%Y-%m-%d %H:%M:%S %Z')}, Weekday: {weekday_name}")

    if weekday >= 5:  # 5=Saturday, 6=Sunday
        print(f"Weekend detected, skipping start")
        return {'statusCode': 200, 'body': json.dumps({'message': 'Skipped (weekend)', 'weekday': weekday_name})}

    ec2 = boto3.client('ec2', region_name=region)

    try:
        response = ec2.describe_instances(InstanceIds=[instance_id])
        if not response['Reservations']:
            return {'statusCode': 404, 'body': json.dumps('Instance not found')}

        instance = response['Reservations'][0]['Instances'][0]
        current_state = instance['State']['Name']
        instance_name = next((tag['Value'] for tag in instance.get('Tags', []) if tag['Key'] == 'Name'), 'Unknown')

        print(f"Instance: {instance_name} ({instance_id}), State: {current_state}")

        if current_state == 'running':
            return {'statusCode': 200, 'body': json.dumps({'message': 'Already running'})}

        if current_state in ['pending', 'stopping', 'shutting-down', 'terminating', 'terminated']:
            return {'statusCode': 200, 'body': json.dumps({'message': f'Skipped (state: {current_state})'})}

        start_response = ec2.start_instances(InstanceIds=[instance_id])
        new_state = start_response['StartingInstances'][0]['CurrentState']['Name']

        print(f"Successfully started instance. New state: {new_state}")
        return {'statusCode': 200, 'body': json.dumps({'message': 'Successfully started', 'new_state': new_state})}

    except Exception as e:
        print(f"ERROR: {str(e)}")
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)})}
EOF
```

### 4단계: Lambda 패키징 및 배포

```bash
# pytz 의존성 설치 (Start Lambda용)
python3 -m pip install pytz --target . --quiet

# Zip 패키지 생성
zip -q -r stop-lambda.zip stop_instance.py
zip -q -r start-lambda.zip start_instance.py pytz/ pytz-*.dist-info/

# IAM Role ARN 설정
export ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/lambda-ec2-scheduler-role"

# Stop Lambda 함수 생성
aws lambda create-function \
  --function-name stop-ec2-scheduler \
  --runtime python3.12 \
  --role $ROLE_ARN \
  --handler stop_instance.lambda_handler \
  --zip-file fileb://stop-lambda.zip \
  --timeout 10 \
  --memory-size 128 \
  --region $AWS_REGION \
  --environment "Variables={INSTANCE_ID=i-02e27c45dc05f5c03}" \
  --description "Stop EC2 on weekday evenings (11PM KST)"

# Start Lambda 함수 생성
aws lambda create-function \
  --function-name start-ec2-scheduler \
  --runtime python3.12 \
  --role $ROLE_ARN \
  --handler start_instance.lambda_handler \
  --zip-file fileb://start-lambda.zip \
  --timeout 10 \
  --memory-size 128 \
  --region $AWS_REGION \
  --environment "Variables={INSTANCE_ID=i-02e27c45dc05f5c03}" \
  --description "Start EC2 on weekday mornings (9AM KST)"
```

### 5단계: EventBridge 스케줄 규칙 생성

```bash
# Stop 규칙 생성 (평일 14:00 UTC = 23:00 KST)
aws events put-rule \
  --name stop-ec2-weekday-rule \
  --schedule-expression "cron(0 14 ? * MON-FRI *)" \
  --state ENABLED \
  --description "Stop EC2 at 11PM KST on weekdays" \
  --region $AWS_REGION

# Start 규칙 생성 (평일 00:00 UTC = 09:00 KST)
aws events put-rule \
  --name start-ec2-weekday-rule \
  --schedule-expression "cron(0 0 ? * MON-FRI *)" \
  --state ENABLED \
  --description "Start EC2 at 9AM KST on weekdays" \
  --region $AWS_REGION
```

### 6단계: Lambda 호출 권한 및 타겟 연결

```bash
# Stop Lambda 권한 추가
aws lambda add-permission \
  --function-name stop-ec2-scheduler \
  --statement-id AllowEventBridgeInvoke-Stop \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn "arn:aws:events:${AWS_REGION}:${ACCOUNT_ID}:rule/stop-ec2-weekday-rule" \
  --region $AWS_REGION

# Start Lambda 권한 추가
aws lambda add-permission \
  --function-name start-ec2-scheduler \
  --statement-id AllowEventBridgeInvoke-Start \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn "arn:aws:events:${AWS_REGION}:${ACCOUNT_ID}:rule/start-ec2-weekday-rule" \
  --region $AWS_REGION

# Stop Lambda 타겟 설정
aws events put-targets \
  --rule stop-ec2-weekday-rule \
  --targets "Id"="1","Arn"="arn:aws:lambda:${AWS_REGION}:${ACCOUNT_ID}:function:stop-ec2-scheduler" \
  --region $AWS_REGION

# Start Lambda 타겟 설정
aws events put-targets \
  --rule start-ec2-weekday-rule \
  --targets "Id"="1","Arn"="arn:aws:lambda:${AWS_REGION}:${ACCOUNT_ID}:function:start-ec2-scheduler" \
  --region $AWS_REGION
```

## 테스트 및 검증

### Lambda 함수 수동 테스트

```bash
# Stop Lambda 테스트
aws lambda invoke \
  --function-name stop-ec2-scheduler \
  --region ap-northeast-2 \
  --log-type Tail \
  --query 'LogResult' \
  --output text \
  response-stop.json | base64 -d

# 응답 확인
cat response-stop.json | jq .

# Start Lambda 테스트
aws lambda invoke \
  --function-name start-ec2-scheduler \
  --region ap-northeast-2 \
  --log-type Tail \
  --query 'LogResult' \
  --output text \
  response-start.json | base64 -d

# 응답 확인
cat response-start.json | jq .
```

### 전체 시스템 검증

```bash
# Lambda 함수 확인
aws lambda list-functions \
  --region ap-northeast-2 \
  --query "Functions[?contains(FunctionName, 'ec2-scheduler')].{Name:FunctionName, Runtime:Runtime, State:State}" \
  --output table

# EventBridge 규칙 확인
aws events list-rules \
  --region ap-northeast-2 \
  --query "Rules[?contains(Name, 'ec2-weekday')].{Name:Name, State:State, Schedule:ScheduleExpression}" \
  --output table

# IAM 역할 확인
aws iam get-role \
  --role-name lambda-ec2-scheduler-role \
  --query 'Role.{Name:RoleName, CreatedDate:CreateDate}' \
  --output table

# EC2 인스턴스 상태 확인
aws ec2 describe-instances \
  --instance-ids i-02e27c45dc05f5c03 \
  --region ap-northeast-2 \
  --query 'Reservations[0].Instances[0].[InstanceId, State.Name, Tags[?Key==`Name`].Value | [0]]' \
  --output table
```

### CloudWatch Logs 확인

```bash
# Stop Lambda 로그 실시간 확인
aws logs tail /aws/lambda/stop-ec2-scheduler \
  --follow \
  --format short \
  --region ap-northeast-2

# Start Lambda 로그 실시간 확인
aws logs tail /aws/lambda/start-ec2-scheduler \
  --follow \
  --format short \
  --region ap-northeast-2

# 최근 1시간 로그 필터링
aws logs filter-log-events \
  --log-group-name /aws/lambda/stop-ec2-scheduler \
  --start-time $(date -u -d '1 hour ago' +%s)000 \
  --region ap-northeast-2 \
  --query 'events[*].[timestamp, message]' \
  --output text
```

## 운영 관리

### 스케줄 일시 중지

```bash
# Stop 규칙 비활성화
aws events disable-rule \
  --name stop-ec2-weekday-rule \
  --region ap-northeast-2

# Start 규칙 비활성화
aws events disable-rule \
  --name start-ec2-weekday-rule \
  --region ap-northeast-2
```

### 스케줄 재개

```bash
# Stop 규칙 활성화
aws events enable-rule \
  --name stop-ec2-weekday-rule \
  --region ap-northeast-2

# Start 규칙 활성화
aws events enable-rule \
  --name start-ec2-weekday-rule \
  --region ap-northeast-2
```

### 수동 인스턴스 제어

```bash
# 즉시 중지
aws ec2 stop-instances \
  --instance-ids i-02e27c45dc05f5c03 \
  --region ap-northeast-2

# 즉시 시작
aws ec2 start-instances \
  --instance-ids i-02e27c45dc05f5c03 \
  --region ap-northeast-2

# 인스턴스 상태 확인
aws ec2 describe-instances \
  --instance-ids i-02e27c45dc05f5c03 \
  --region ap-northeast-2 \
  --query 'Reservations[0].Instances[0].State.Name' \
  --output text
```

### Lambda 함수 업데이트

```bash
# 코드 수정 후 재패키징
cd ~/lambda-scheduler
zip -q -r stop-lambda.zip stop_instance.py
zip -q -r start-lambda.zip start_instance.py pytz/ pytz-*.dist-info/

# Stop Lambda 코드 업데이트
aws lambda update-function-code \
  --function-name stop-ec2-scheduler \
  --zip-file fileb://stop-lambda.zip \
  --region ap-northeast-2

# Start Lambda 코드 업데이트
aws lambda update-function-code \
  --function-name start-ec2-scheduler \
  --zip-file fileb://start-lambda.zip \
  --region ap-northeast-2
```

### 스케줄 시간 변경

```bash
# 예: Stop 시간을 22시 KST (13시 UTC)로 변경
aws events put-rule \
  --name stop-ec2-weekday-rule \
  --schedule-expression "cron(0 13 ? * MON-FRI *)" \
  --state ENABLED \
  --region ap-northeast-2

# 예: Start 시간을 08시 KST (전날 23시 UTC)로 변경
aws events put-rule \
  --name start-ec2-weekday-rule \
  --schedule-expression "cron(0 23 ? * SUN-THU *)" \
  --state ENABLED \
  --region ap-northeast-2
```

## 롤백 (전체 삭제)

전체 리소스를 삭제하는 경우 **역순**으로 진행해야 합니다:

```bash
#!/bin/bash
set -e

REGION="ap-northeast-2"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "EC2 스케줄러 롤백 시작..."

# 1. EventBridge 타겟 제거
echo "1. EventBridge 타겟 제거..."
aws events remove-targets \
  --rule stop-ec2-weekday-rule \
  --ids "1" \
  --region $REGION 2>/dev/null || true

aws events remove-targets \
  --rule start-ec2-weekday-rule \
  --ids "1" \
  --region $REGION 2>/dev/null || true

# 2. EventBridge 규칙 삭제
echo "2. EventBridge 규칙 삭제..."
aws events delete-rule \
  --name stop-ec2-weekday-rule \
  --region $REGION 2>/dev/null || true

aws events delete-rule \
  --name start-ec2-weekday-rule \
  --region $REGION 2>/dev/null || true

# 3. Lambda 함수 삭제
echo "3. Lambda 함수 삭제..."
aws lambda delete-function \
  --function-name stop-ec2-scheduler \
  --region $REGION 2>/dev/null || true

aws lambda delete-function \
  --function-name start-ec2-scheduler \
  --region $REGION 2>/dev/null || true

# 4. IAM 정책 분리
echo "4. IAM 정책 분리..."
aws iam detach-role-policy \
  --role-name lambda-ec2-scheduler-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole 2>/dev/null || true

aws iam delete-role-policy \
  --role-name lambda-ec2-scheduler-role \
  --policy-name ec2-scheduler-policy 2>/dev/null || true

# 5. IAM 역할 삭제
echo "5. IAM 역할 삭제..."
aws iam delete-role \
  --role-name lambda-ec2-scheduler-role 2>/dev/null || true

# 6. CloudWatch Logs 삭제 (선택)
echo "6. CloudWatch Logs 로그 그룹 삭제..."
aws logs delete-log-group \
  --log-group-name /aws/lambda/stop-ec2-scheduler \
  --region $REGION 2>/dev/null || true

aws logs delete-log-group \
  --log-group-name /aws/lambda/start-ec2-scheduler \
  --region $REGION 2>/dev/null || true

echo ""
echo "✅ 롤백 완료!"
```

## 비용 분석

### Lambda 비용

**사용량**:
- 월 호출: ~40회 (평일 20일 × 2회/일)
- 실행 시간: ~100ms/호출
- 메모리: 128MB
- 컴퓨팅: 128MB × 0.1초 × 40회 = 0.5 GB-초

**가격** (서울 리전):
- $0.20 / 100만 요청
- $0.0000166667 / GB-초

**계산**:
- 요청 비용: (40 / 1,000,000) × $0.20 = $0.000008
- 컴퓨팅 비용: 0.5 × $0.0000166667 = $0.000008
- **월 총 비용: $0.000016 ≈ $0**

**Free Tier**: 100만 요청/월, 40만 GB-초/월 (영구 무료)

### EventBridge 비용

- **비용**: $0 (모든 스케줄 이벤트 무료)

### CloudWatch Logs 비용

**사용량**:
- 로그 수집: ~5KB/호출 × 40회 = 200KB/월
- 로그 저장: ~200KB

**가격**:
- $0.76 / GB 수집
- $0.033 / GB 저장

**계산**:
- 수집: (0.0002 GB) × $0.76 = $0.00015
- 저장: (0.0002 GB) × $0.033 = $0.000007
- **월 총 비용: $0.00016 ≈ $0**

**Free Tier**: 5GB 수집/월, 5GB 저장/월

### EC2 절감액

**t4g.nano 서울 리전**: $0.0042/시간

**절감 시간**:
- 평일: 14시간/일 × 20일 = 280시간
- 주말: 48시간/주 × 4주 = 192시간
- **총**: 472시간/월

**절감액**:
- **월**: 472 × $0.0042 = **$1.98**
- **연**: $1.98 × 12 = **$23.76**

### 총 비용 요약

| 항목 | 월 비용 | 비고 |
|------|---------|------|
| Lambda | $0 | Free Tier |
| EventBridge | $0 | 무료 |
| CloudWatch Logs | $0 | Free Tier |
| **운영 비용 합계** | **$0** | |
| **EC2 절감액** | **-$1.98** | 순 절감 |

## 문제 해결

### Lambda 함수가 실행되지 않음

**증상**: 예정된 시간에 EC2 인스턴스가 중지/시작되지 않음

**원인 1**: EventBridge 규칙이 비활성화됨

```bash
# 상태 확인
aws events describe-rule \
  --name stop-ec2-weekday-rule \
  --region ap-northeast-2 \
  --query 'State'

# 활성화
aws events enable-rule \
  --name stop-ec2-weekday-rule \
  --region ap-northeast-2
```

**원인 2**: Lambda 호출 권한 누락

```bash
# 권한 확인
aws lambda get-policy \
  --function-name stop-ec2-scheduler \
  --region ap-northeast-2

# 권한 재추가 (6단계 참고)
```

### Lambda 실행 중 권한 오류

**증상**: CloudWatch Logs에 `AccessDeniedException` 에러

**해결**:
```bash
# IAM 정책 확인
aws iam get-role-policy \
  --role-name lambda-ec2-scheduler-role \
  --policy-name ec2-scheduler-policy

# 정책 재적용 (2단계 참고)
```

### 토요일에 인스턴스가 시작됨

**증상**: 주말에도 인스턴스가 시작됨

**원인**: Start Lambda의 pytz 의존성 누락

**해결**:
```bash
# Start Lambda 로그 확인
aws logs tail /aws/lambda/start-ec2-scheduler \
  --region ap-northeast-2

# pytz 재설치 및 재배포 (4단계 참고)
```

## 주의사항

1. **서비스 중단 시간**: 23:00-09:00 KST 사이에는 Backend API 접근 불가
2. **주말 동작**: Start Lambda가 KST 기준으로 주말을 체크하므로 토/일에는 시작 안 함
3. **DB 무결성**: SQLite 파일이 EBS에 저장되어 중지/시작 시 데이터 유실 없음
4. **PM2 자동 시작**: EC2 시작 시 PM2가 자동으로 Backend 애플리케이션을 실행해야 함
   - systemd 설정 확인: `sudo systemctl status pm2-ec2-user`
   - 필요시 설정: `pm2 startup && pm2 save`

## 참고 자료

- **Lambda 함수 코드**: `~/lambda-scheduler/`
- **AWS Lambda 문서**: https://docs.aws.amazon.com/lambda/
- **EventBridge Cron**: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-create-rule-schedule.html
- **EC2 API**: https://docs.aws.amazon.com/AWSEC2/latest/APIReference/

## 구축 이력

- **구축일**: 2025-12-16
- **구축자**: Claude Code
- **계정 ID**: 637423484158
- **리전**: ap-northeast-2 (서울)
- **첫 실행 예정**: 2025-12-16 23:00 KST
