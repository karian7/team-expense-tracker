#!/bin/bash

# Stop hook: 코드 품질 검증 (리포트만, 자동 수정 없음)
# Exit 2를 반환하면 Claude Code가 자동으로 오류를 감지하고 수정합니다.

cd "$(dirname "$0")/.." || exit 1

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "Running pre-stop validation..." >&2

# 1. Lint 체크
echo "Checking lint..." >&2
if ! pnpm lint 2>&1; then
  echo -e "${RED}Lint issues found. Run: pnpm lint:fix${NC}" >&2
  exit 2
fi

# 2. Prettier 체크
echo "Checking formatting..." >&2
if ! pnpm format:check 2>&1; then
  echo -e "${RED}Formatting issues found. Run: pnpm format${NC}" >&2
  exit 2
fi

# 3. TypeScript 체크
echo "Checking types..." >&2
if ! pnpm typecheck 2>&1; then
  echo -e "${RED}Type errors found. Run: pnpm typecheck${NC}" >&2
  exit 2
fi

echo -e "${GREEN}All checks passed!${NC}" >&2
exit 0
