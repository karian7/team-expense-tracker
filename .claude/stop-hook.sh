#!/bin/bash

# Stop hook: 코드 품질 검증 및 자동 수정
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
  echo -e "${YELLOW}Lint issues found. Attempting to fix...${NC}" >&2
  pnpm lint:fix
  echo -e "${RED}Lint issues were fixed. Please review the changes.${NC}" >&2
  exit 2  # Claude에게 피드백 전달
fi

# 2. Prettier 체크
echo "Checking formatting..." >&2
if ! pnpm format:check 2>&1; then
  echo -e "${YELLOW}Formatting issues found. Fixing...${NC}" >&2
  pnpm format
  echo -e "${RED}Files were formatted. Please review the changes.${NC}" >&2
  exit 2  # Claude에게 피드백 전달
fi

# 3. TypeScript 체크
echo "Checking types..." >&2
if ! pnpm typecheck 2>&1; then
  echo -e "${RED}Type errors found. Please fix them before stopping.${NC}" >&2
  echo -e "${YELLOW}Run: pnpm typecheck${NC}" >&2
  exit 2  # Claude에게 피드백 전달
fi

echo -e "${GREEN}All checks passed!${NC}" >&2
exit 0
