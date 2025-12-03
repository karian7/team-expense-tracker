/**
 * 현재 연도와 월을 반환
 */
export function getCurrentYearMonth(): { year: number; month: number } {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1, // JavaScript month is 0-indexed
  };
}

/**
 * 이전 달의 연도와 월을 반환
 */
export function getPreviousYearMonth(year: number, month: number): { year: number; month: number } {
  if (month === 1) {
    return { year: year - 1, month: 12 };
  }
  return { year, month: month - 1 };
}

/**
 * 다음 달의 연도와 월을 반환
 */
export function getNextYearMonth(year: number, month: number): { year: number; month: number } {
  if (month === 12) {
    return { year: year + 1, month: 1 };
  }
  return { year, month: month + 1 };
}

/**
 * 날짜 문자열이 특정 월에 속하는지 확인
 */
export function isDateInMonth(dateStr: string, year: number, month: number): boolean {
  const date = new Date(dateStr);
  return date.getFullYear() === year && date.getMonth() + 1 === month;
}

/**
 * ISO 날짜 문자열에서 연도와 월 추출
 */
export function extractYearMonth(dateStr: string): { year: number; month: number } {
  const date = new Date(dateStr);
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
  };
}
