import { format, parseISO } from 'date-fns';

/**
 * 숫자를 한국 원화 형식으로 포맷
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
  }).format(amount);
}

/**
 * 숫자를 쉼표로 구분된 문자열로 포맷
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('ko-KR').format(num);
}

/**
 * ISO 날짜 문자열을 읽기 쉬운 형식으로 포맷
 */
export function formatDate(dateString: string, formatStr: string = 'yyyy-MM-dd'): string {
  try {
    const date = parseISO(dateString);
    return format(date, formatStr);
  } catch {
    return dateString;
  }
}

/**
 * 날짜를 "M월 d일" 형식으로 포맷
 */
export function formatDateKorean(dateString: string): string {
  try {
    const date = parseISO(dateString);
    return format(date, 'M월 d일');
  } catch {
    return dateString;
  }
}

/**
 * 날짜와 시간을 포함한 포맷
 */
export function formatDateTime(dateString: string): string {
  try {
    const date = parseISO(dateString);
    return format(date, 'yyyy-MM-dd HH:mm');
  } catch {
    return dateString;
  }
}

/**
 * 현재 날짜를 YYYY-MM-DD 형식으로 반환
 */
export function getCurrentDate(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/**
 * 월을 "YYYY년 M월" 형식으로 포맷
 */
export function formatYearMonth(year: number, month: number): string {
  return `${year}년 ${month}월`;
}
