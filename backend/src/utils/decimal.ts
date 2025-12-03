import { Decimal } from '@prisma/client/runtime/library';

/**
 * Prisma Decimal을 number로 변환
 */
export function decimalToNumber(decimal: Decimal | number): number {
  if (typeof decimal === 'number') return decimal;
  return parseFloat(decimal.toString());
}

/**
 * 객체 내의 모든 Decimal 필드를 number로 변환
 */
export function convertDecimalsToNumbers<T extends Record<string, any>>(obj: T): any {
  const result: any = {};

  for (const key in obj) {
    const value = obj[key];

    if (value instanceof Decimal) {
      result[key] = decimalToNumber(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map(item =>
        typeof item === 'object' && item !== null
          ? convertDecimalsToNumbers(item)
          : item
      );
    } else if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
      result[key] = convertDecimalsToNumbers(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}
