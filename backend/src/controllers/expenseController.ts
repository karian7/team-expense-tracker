import { Request, Response, NextFunction } from 'express';
import {
  createExpense,
  getExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
} from '../services/legacyExpenseService';
import { ApiResponse, ExpenseQueryParams } from '../types';
import { AppError } from '../middleware/errorHandler';

/**
 * GET /api/expenses
 * 사용 내역 목록 조회
 */
export async function listExpenses(
  req: Request<Record<string, never>, ApiResponse, Record<string, never>, ExpenseQueryParams>,
  res: Response<ApiResponse>,
  next: NextFunction
) {
  try {
    const { year, month, authorName, startDate, endDate, limit, offset } = req.query;

    const params: {
      year?: number;
      month?: number;
      authorName?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    } = {};

    if (year) params.year = parseInt(year);
    if (month) params.month = parseInt(month);
    if (authorName) params.authorName = authorName;
    if (startDate) params.startDate = new Date(startDate);
    if (endDate) params.endDate = new Date(endDate);
    if (limit) params.limit = parseInt(limit);
    if (offset) params.offset = parseInt(offset);

    const expenses = await getExpenses(params);

    res.json({
      success: true,
      data: expenses,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/expenses/:id
 * 특정 사용 내역 조회
 */
export async function getExpense(
  req: Request<{ id: string }>,
  res: Response<ApiResponse>,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    const sequence = parseInt(id, 10);

    if (isNaN(sequence)) {
      throw new AppError('Invalid expense ID', 400);
    }

    const expense = await getExpenseById(sequence);

    if (!expense) {
      throw new AppError('Expense not found', 404);
    }

    res.json({
      success: true,
      data: expense,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/expenses
 * 사용 내역 생성
 */
export async function createNewExpense(
  req: Request<
    Record<string, never>,
    ApiResponse,
    {
      authorName: string;
      amount: number;
      expenseDate: string;
      storeName?: string;
      receiptImage?: string;
      ocrRawData?: Record<string, unknown>;
    }
  >,
  res: Response<ApiResponse>,
  next: NextFunction
) {
  try {
    const { authorName, amount, expenseDate, storeName, receiptImage, ocrRawData } = req.body;

    // Validation
    if (!authorName || !authorName.trim()) {
      throw new AppError('Author name is required', 400);
    }

    if (!amount || isNaN(amount) || amount <= 0) {
      throw new AppError('Valid amount is required', 400);
    }

    if (!expenseDate) {
      throw new AppError('Expense date is required', 400);
    }

    if (!receiptImage || !receiptImage.trim()) {
      throw new AppError('Receipt image is required', 400);
    }

    const expense = await createExpense({
      authorName: authorName.trim(),
      amount,
      expenseDate,
      storeName: storeName?.trim(),
      receiptImage,
      ocrRawData,
    });

    res.status(201).json({
      success: true,
      data: expense,
      message: 'Expense created successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/expenses/:id
 * 사용 내역 수정 (Event Sourcing에서는 지원하지 않음)
 */
export async function updateExistingExpense(
  req: Request<
    { id: string },
    ApiResponse,
    {
      authorName?: string;
      amount?: number;
      expenseDate?: string;
      storeName?: string;
    }
  >,
  res: Response<ApiResponse>,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    const sequence = parseInt(id, 10);

    if (isNaN(sequence)) {
      throw new AppError('Invalid expense ID', 400);
    }

    const expense = await updateExpense();

    res.json({
      success: true,
      data: expense,
      message: 'Update not supported in event sourcing',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/expenses/:id
 * 사용 내역 삭제 (Event Sourcing에서는 지원하지 않음)
 */
export async function deleteExistingExpense(
  req: Request<{ id: string }, ApiResponse, Record<string, never>, { actorName?: string }>,
  res: Response<ApiResponse>,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    const sequence = parseInt(id, 10);

    if (isNaN(sequence)) {
      throw new AppError('Invalid expense ID', 400);
    }

    const actorName = typeof req.query.actorName === 'string' ? req.query.actorName : undefined;
    const reversalEvent = await deleteExpense(sequence, actorName);

    res.json({
      success: true,
      data: reversalEvent,
      message: 'Expense deletion event created',
    });
  } catch (error) {
    next(error);
  }
}
