import { Expense } from '@prisma/client';
import { format } from 'date-fns';

/**
 * Expense 배열을 CSV 문자열로 변환 (백업용)
 * ID를 포함하여 복원 시 동일한 ID로 복원 가능
 */
export function expensesToCsv(expenses: Expense[]): string {
  // CSV 헤더 (영수증 URL 제외)
  const headers = [
    'ID',
    '작성자',
    '금액',
    '사용날짜',
    '상호명',
  ];

  // CSV 행
  const rows = expenses.map((expense) => [
    expense.id,
    escapeCsvValue(expense.authorName),
    expense.amount.toString(),
    format(new Date(expense.expenseDate), 'yyyy-MM-dd'),
    escapeCsvValue(expense.storeName || ''),
  ]);

  // CSV 생성
  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

  return csvContent;
}

/**
 * CSV 값 이스케이프 (쉼표, 따옴표 처리)
 */
function escapeCsvValue(value: string): string {
  if (!value) return '';

  // 쉼표, 따옴표, 개행이 포함되어 있으면 따옴표로 감싸기
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    // 따옴표를 두 개로 변환
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

/**
 * CSV 문자열을 파싱하여 Expense 데이터로 변환 (복원용)
 */
export interface CsvExpenseRow {
  id?: string; // ID가 있으면 update, 없으면 create
  authorName: string;
  amount: number;
  expenseDate: string;
  storeName?: string;
}

export function parseCsvToExpenses(csvContent: string): CsvExpenseRow[] {
  const lines = csvContent.split('\n').filter((line) => line.trim());

  if (lines.length < 2) {
    throw new Error('CSV 파일이 비어있거나 헤더만 있습니다.');
  }

  // 헤더 제거
  const dataLines = lines.slice(1);

  const expenses: CsvExpenseRow[] = [];

  for (let i = 0; i < dataLines.length; i++) {
    try {
      const values = parseCsvLine(dataLines[i]);

      // ID 포함 형식: ID, 작성자, 금액, 날짜, 상호명 (5개)
      // ID 미포함 형식: 작성자, 금액, 날짜, 상호명 (4개)

      let id: string | undefined;
      let authorName: string;
      let amountStr: string;
      let dateStr: string;
      let storeName: string | undefined;

      if (values.length >= 5) {
        // ID 포함 형식
        [id, authorName, amountStr, dateStr, storeName] = values;
      } else if (values.length >= 3) {
        // ID 미포함 형식 (구 버전 호환)
        [authorName, amountStr, dateStr, storeName] = values;
      } else {
        console.warn(`Line ${i + 2}: 필수 컬럼이 부족합니다. 건너뜁니다.`);
        continue;
      }

      const amount = parseFloat(amountStr);
      if (isNaN(amount) || amount <= 0) {
        console.warn(`Line ${i + 2}: 유효하지 않은 금액입니다. 건너뜁니다.`);
        continue;
      }

      expenses.push({
        id: id?.trim() || undefined,
        authorName: authorName.trim(),
        amount,
        expenseDate: dateStr.trim(),
        storeName: storeName?.trim() || undefined,
      });
    } catch (error) {
      console.warn(`Line ${i + 2}: 파싱 실패 -`, error);
      continue;
    }
  }

  return expenses;
}

/**
 * CSV 한 줄을 파싱 (따옴표 처리)
 */
function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // 연속된 따옴표는 하나의 따옴표로
        current += '"';
        i++; // 다음 따옴표 건너뛰기
      } else {
        // 따옴표 토글
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // 쉼표로 구분 (따옴표 밖에서만)
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  // 마지막 값 추가
  values.push(current);

  return values;
}

/**
 * CSV 템플릿 생성 (백업/복원용)
 */
export function generateCsvTemplate(): string {
  const headers = ['ID', '작성자', '금액', '사용날짜(YYYY-MM-DD)', '상호명'];
  const example = ['expense-id-123', '홍길동', '50000', '2024-12-03', '맛있는식당'];

  return [headers.join(','), example.join(',')].join('\n');
}
