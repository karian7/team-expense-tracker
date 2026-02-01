.PHONY: help build build-frontend build-backend deploy deploy-frontend deploy-backend deploy-all clean

# 환경 변수
S3_BUCKET := team-expense-tracker-fe
CLOUDFRONT_DISTRIBUTION_ID := E2FU12DEM4MJNW
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
	@echo "  make deploy-backend     - Backend를 Lambda에 배포 (SAM)"
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

deploy-frontend: build-frontend
	@echo "☁️  Frontend S3 배포 중..."
	# index.html은 캐시 방지 (항상 최신 버전 제공)
	aws s3 cp $(FRONTEND_DIR)/dist/index.html s3://$(S3_BUCKET)/index.html \
		--cache-control "no-cache, no-store, must-revalidate"
	# 정적 자원은 해싱되므로 장기 캐싱 가능
	aws s3 sync $(FRONTEND_DIR)/dist s3://$(S3_BUCKET) --delete \
		--exclude "index.html" \
		--cache-control "public, max-age=31536000, immutable"
	@echo "✅ Frontend S3 배포 완료"
	@echo "🔄 CloudFront 캐시 무효화 중..."
	aws cloudfront create-invalidation \
		--distribution-id $(CLOUDFRONT_DISTRIBUTION_ID) \
		--paths "/*" \
		--query 'Invalidation.{Id:Id,Status:Status,CreateTime:CreateTime}' \
		--output table
	@echo "✅ CloudFront 캐시 무효화 완료"

deploy-backend: build-backend
	@echo "🚀 Backend Lambda 배포 중 (SAM)..."
	cd $(BACKEND_DIR) && sam build
	cd $(BACKEND_DIR) && sam deploy
	@echo "✅ Backend Lambda 배포 완료"

# 정리
clean:
	@echo "🧹 빌드 결과물 삭제 중..."
	rm -rf $(FRONTEND_DIR)/dist
	rm -rf $(BACKEND_DIR)/dist
	rm -rf $(BACKEND_DIR)/.aws-sam
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