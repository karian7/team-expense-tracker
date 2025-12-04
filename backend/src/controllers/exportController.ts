import { Request, Response, NextFunction } from 'express';
import {
  exportAllExpensesToCsv,
  exportExpensesByPeriodToCsv,
  importExpensesFromCsv,
} from '../services/exportService';
import { generateCsvTemplate } from '../utils/csv';
import { ApiResponse } from '../types';
import { AppError } from '../middleware/errorHandler';

/**
 * GET /api/export/expenses
 * 모든 사용 내역을 CSV로 export
 */
export async function exportExpenses(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { startDate, endDate } = req.query;

    let csvContent: string;

    if (startDate && endDate) {
      // 기간 지정 export
      csvContent = await exportExpensesByPeriodToCsv(
        new Date(startDate as string),
        new Date(endDate as string)
      );
    } else {
      // 전체 export
      csvContent = await exportAllExpensesToCsv();
    }

    // CSV 파일로 다운로드
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="expenses_${new Date().toISOString().split('T')[0]}.csv"`
    );

    res.send(`\uFEFF${csvContent}`);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/import/expenses
 * CSV 파일을 업로드하여 사용 내역 import
 */
export async function importExpenses(
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) {
  try {
    if (!req.file) {
      throw new AppError('No CSV file uploaded', 400);
    }

    const csvContent = req.file.buffer.toString('utf-8');

    const result = await importExpensesFromCsv(csvContent);

    res.json({
      success: true,
      data: result,
      message: `Import completed: ${result.success} succeeded, ${result.failed} failed`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/export/template
 * CSV import 템플릿 다운로드
 */
export async function downloadTemplate(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const template = generateCsvTemplate();

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="expense_import_template.csv"'
    );

    res.send(`\uFEFF${template}`);
  } catch (error) {
    next(error);
  }
}
