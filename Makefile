.PHONY: help build build-frontend build-backend deploy deploy-frontend deploy-backend deploy-all provision-server setup-server clean update-ssh-config

# 환경 변수
S3_BUCKET := team-expense-tracker-fe
CLOUDFRONT_DISTRIBUTION_ID := E2FU12DEM4MJNW
SSH_HOST := tet
REMOTE_PATH := /home/ec2-user/team-expense-tracker
FRONTEND_DIR := frontend
BACKEND_DIR := backend

# 기본 타겟
help:
	@echo "사용 가능한 명령어:"
	@echo "  make build              - Frontend와 Backend 모두 빌드"
	@echo "  make build-frontend     - Frontend만 빌드"
	@echo "  make build-backend      - Backend만 빌드"
	@echo "  make deploy-all         - 전체 빌드 후 배포"
	@echo "  make deploy-frontend    - Frontend를 S3에 배포"
	@echo "  make deploy-backend     - Backend를 SSH로 배포"
	@echo "  make provision-server   - 서버 프로비저닝 (Node.js, pnpm 등 설치)"
	@echo "  make setup-server       - 서버 초기 설정 (의존성 설치 등)"
	@echo "  make clean              - 빌드 결과물 삭제"

# 빌드
build: build-frontend build-backend

build-frontend:
	@echo "🏗️  Frontend 빌드 중..."
	cd $(FRONTEND_DIR) && pnpm build
	@echo "✅ Frontend 빌드 완료"

build-backend:
	@echo "🏗️  Backend 빌드 중..."
	cd $(BACKEND_DIR) && pnpm build
	@echo "✅ Backend 빌드 완료"

# 배포
deploy-all: build deploy-frontend deploy-backend
	@echo "🎉 전체 배포 완료!"

# SSH config 업데이트 (EC2 Public DNS 자동 반영)
update-ssh-config:
	@echo "🔄 SSH config 업데이트 중..."
	@INSTANCE_ID=i-02e27c45dc05f5c03; \
	PUBLIC_DNS=$$(aws ec2 describe-instances \
		--instance-ids $$INSTANCE_ID \
		--query 'Reservations[0].Instances[0].PublicDnsName' \
		--output text); \
	if [ "$$PUBLIC_DNS" = "None" ] || [ -z "$$PUBLIC_DNS" ]; then \
		echo "❌ 인스턴스 $$INSTANCE_ID의 Public DNS를 가져올 수 없습니다."; \
		exit 1; \
	fi; \
	echo "📍 새로운 Public DNS: $$PUBLIC_DNS"; \
	sed -i.bak "/^Host tet$$/,/^$$/ s|^\(\s*HostName\s\).*|\1$$PUBLIC_DNS|" ~/.ssh/config; \
	echo "✅ SSH config 업데이트 완료"

deploy-frontend: build-frontend
	@echo "☁️  Frontend S3 배포 중..."
	aws s3 sync $(FRONTEND_DIR)/dist s3://$(S3_BUCKET) --delete
	@echo "✅ Frontend S3 배포 완료"
	@echo "🔄 CloudFront 캐시 무효화 중..."
	aws cloudfront create-invalidation \
		--distribution-id $(CLOUDFRONT_DISTRIBUTION_ID) \
		--paths "/*" \
		--query 'Invalidation.{Id:Id,Status:Status,CreateTime:CreateTime}' \
		--output table
	@echo "✅ CloudFront 캐시 무효화 완료"

deploy-backend: build-backend update-ssh-config
	@echo "🚀 Backend SSH 배포 중..."
	@echo "📦 원격 디렉토리 생성..."
	ssh $(SSH_HOST) "mkdir -p $(REMOTE_PATH)"
	@echo "📤 필수 파일 전송 중..."
	rsync -avz --progress \
		$(BACKEND_DIR)/dist/ \
		$(SSH_HOST):$(REMOTE_PATH)/dist/
	rsync -avz --progress \
		$(BACKEND_DIR)/package.json \
		$(BACKEND_DIR)/pnpm-lock.yaml \
		$(SSH_HOST):$(REMOTE_PATH)/
	rsync -avz --progress \
		$(BACKEND_DIR)/prisma/ \
		$(SSH_HOST):$(REMOTE_PATH)/prisma/
	@echo "✅ Backend SSH 배포 완료"
	@echo ""
	@echo "⚠️  서버에서 추가 작업이 필요합니다:"
	@echo "   make setup-server  (또는 수동으로 ssh $(SSH_HOST))"

# 서버 프로비저닝 (신규 Amazon Linux 인스턴스용)
provision-server:
	@echo "🔧 서버 프로비저닝 시작..."
	@echo "📦 시스템 패키지 업데이트..."
	ssh $(SSH_HOST) "sudo yum update -y"
	@echo "📦 개발 도구 설치..."
	ssh $(SSH_HOST) "sudo yum install -y git wget || true"
	@echo "📦 Node.js 설치 (nvm 사용)..."
	ssh $(SSH_HOST) 'curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash'
	@echo "⏳ NVM 환경 설정 및 Node.js 설치..."
	ssh $(SSH_HOST) 'export NVM_DIR="$$HOME/.nvm" && [ -s "$$NVM_DIR/nvm.sh" ] && . "$$NVM_DIR/nvm.sh" && nvm install --lts && nvm use --lts'
	@echo "📦 pnpm 설치..."
	ssh $(SSH_HOST) 'export NVM_DIR="$$HOME/.nvm" && [ -s "$$NVM_DIR/nvm.sh" ] && . "$$NVM_DIR/nvm.sh" && npm install -g pnpm'
	@echo "📦 PM2 설치..."
	ssh $(SSH_HOST) 'export NVM_DIR="$$HOME/.nvm" && [ -s "$$NVM_DIR/nvm.sh" ] && . "$$NVM_DIR/nvm.sh" && npm install -g pm2'
	@echo "📦 PM2 startup 설정..."
	ssh $(SSH_HOST) 'export NVM_DIR="$$HOME/.nvm" && [ -s "$$NVM_DIR/nvm.sh" ] && . "$$NVM_DIR/nvm.sh" && sudo env PATH=$$PATH:$$HOME/.nvm/versions/node/$$(node -v)/bin pm2 startup systemd -u ec2-user --hp /home/ec2-user'
	@echo "✅ 서버 프로비저닝 완료"

# 서버 초기 설정
setup-server: provision-server
	@echo "⚙️  서버 초기 설정 중..."
	@echo "📂 프로젝트 디렉토리 생성..."
	ssh $(SSH_HOST) "mkdir -p $(REMOTE_PATH)"
	@echo "📦 의존성 설치 중..."
	ssh $(SSH_HOST) 'export NVM_DIR="$$HOME/.nvm" && [ -s "$$NVM_DIR/nvm.sh" ] && . "$$NVM_DIR/nvm.sh" && cd $(REMOTE_PATH) && pnpm install'
	@echo "🗄️  Prisma 클라이언트 생성 중..."
	ssh $(SSH_HOST) 'export NVM_DIR="$$HOME/.nvm" && [ -s "$$NVM_DIR/nvm.sh" ] && . "$$NVM_DIR/nvm.sh" && cd $(REMOTE_PATH) && npx prisma generate'
	@echo "✅ 서버 초기 설정 완료"
	@echo ""
	@echo "⚠️  다음 작업을 수동으로 진행하세요:"
	@echo "   1. .env 파일 설정: make deploy-env (또는 수동으로 설정)"
	@echo "   2. DB 마이그레이션: ssh $(SSH_HOST) 'export NVM_DIR=\"\$$HOME/.nvm\" && [ -s \"\$$NVM_DIR/nvm.sh\" ] && . \"\$$NVM_DIR/nvm.sh\" && cd $(REMOTE_PATH) && npx prisma migrate deploy'"
	@echo "   3. 서버 시작: make server-start"

# 환경 파일 배포 (주의: 민감 정보 포함)
deploy-env:
	@echo "⚠️  환경 파일(.env)을 배포합니다..."
	@read -p "정말 진행하시겠습니까? [y/N]: " confirm; \
	if [ "$$confirm" = "y" ] || [ "$$confirm" = "Y" ]; then \
		scp $(BACKEND_DIR)/.env $(SSH_HOST):$(REMOTE_PATH)/.env; \
		echo "✅ .env 파일 배포 완료"; \
	else \
		echo "❌ 취소되었습니다"; \
	fi

# 서버 제어
server-start:
	@echo "🚀 서버 시작 중..."
	ssh $(SSH_HOST) 'export NVM_DIR="$$HOME/.nvm" && [ -s "$$NVM_DIR/nvm.sh" ] && . "$$NVM_DIR/nvm.sh" && cd $(REMOTE_PATH) && pm2 start dist/server.js --name team-expense-tracker'

server-stop:
	@echo "🛑 서버 중지 중..."
	ssh $(SSH_HOST) 'export NVM_DIR="$$HOME/.nvm" && [ -s "$$NVM_DIR/nvm.sh" ] && . "$$NVM_DIR/nvm.sh" && pm2 stop team-expense-tracker'

server-restart:
	@echo "🔄 서버 재시작 중..."
	ssh $(SSH_HOST) 'export NVM_DIR="$$HOME/.nvm" && [ -s "$$NVM_DIR/nvm.sh" ] && . "$$NVM_DIR/nvm.sh" && pm2 restart team-expense-tracker'

server-logs:
	@echo "📋 서버 로그 확인..."
	ssh $(SSH_HOST) 'export NVM_DIR="$$HOME/.nvm" && [ -s "$$NVM_DIR/nvm.sh" ] && . "$$NVM_DIR/nvm.sh" && pm2 logs team-expense-tracker'

server-status:
	@echo "📊 서버 상태 확인..."
	ssh $(SSH_HOST) 'export NVM_DIR="$$HOME/.nvm" && [ -s "$$NVM_DIR/nvm.sh" ] && . "$$NVM_DIR/nvm.sh" && pm2 status team-expense-tracker'

# 정리
clean:
	@echo "🧹 빌드 결과물 삭제 중..."
	rm -rf $(FRONTEND_DIR)/dist
	rm -rf $(BACKEND_DIR)/dist
	@echo "✅ 정리 완료"

# 빠른 재배포 (이미 빌드된 상태에서 배포만)
quick-deploy-frontend:
	@echo "⚡ Frontend 빠른 배포..."
	aws s3 sync $(FRONTEND_DIR)/dist s3://$(S3_BUCKET) --delete
	@echo "🔄 CloudFront 캐시 무효화 중..."
	aws cloudfront create-invalidation \
		--distribution-id $(CLOUDFRONT_DISTRIBUTION_ID) \
		--paths "/*" \
		--query 'Invalidation.{Id:Id,Status:Status,CreateTime:CreateTime}' \
		--output table
	@echo "✅ Frontend 빠른 배포 완료"

quick-deploy-backend:
	@echo "⚡ Backend 빠른 배포..."
	rsync -avz --progress \
		$(BACKEND_DIR)/dist/ \
		$(SSH_HOST):$(REMOTE_PATH)/dist/
	ssh $(SSH_HOST) 'export NVM_DIR="$$HOME/.nvm" && [ -s "$$NVM_DIR/nvm.sh" ] && . "$$NVM_DIR/nvm.sh" && cd $(REMOTE_PATH) && pm2 restart team-expense-tracker'

# 코드 품질 검사
lint:
	@echo "🔍 Frontend Lint 검사..."
	cd $(FRONTEND_DIR) && pnpm lint
	@echo "🔍 Backend Lint 검사..."
	cd $(BACKEND_DIR) && pnpm lint

format-check:
	@echo "📝 Frontend 포맷 검사..."
	cd $(FRONTEND_DIR) && pnpm format:check
	@echo "📝 Backend 포맷 검사..."
	cd $(BACKEND_DIR) && pnpm format:check

# 개발 서버 실행
dev:
	@echo "🔧 개발 서버 시작..."
	pnpm dev