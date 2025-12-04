import { Decimal } from '@prisma/client/runtime/library';

/**
 * Prisma Decimal을 number로 변환
 */
export function decimalToNumber(decimal: Decimal | number): number {
  if (typeof decimal === 'number') {
    return decimal;
  }
  return parseFloat(decimal.toString());
}

const isDecimal = (value: unknown): value is Decimal => Decimal.isDecimal(value);

const convertValue = (value: unknown): unknown => {
  if (isDecimal(value)) {
    return decimalToNumber(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => convertValue(item));
  }

  if (value instanceof Date) {
    return value;
  }

  if (value && typeof value === 'object') {
    return convertDecimalsToNumbers(value as Record<string, unknown>);
  }

  return value;
};

/**
 * 객체 내의 모든 Decimal 필드를 number로 변환
 */
export function convertDecimalsToNumbers<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(obj)) {
    result[key] = convertValue(obj[key]);
  }

  return result as T;
}
