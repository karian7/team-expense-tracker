import { Request, Response, NextFunction } from 'express';
import {
  createExpense,
  getExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
} from '../services/expenseService';
import { ApiResponse, CreateExpenseRequest, UpdateExpenseRequest, ExpenseQueryParams } from '../types';
import { AppError } from '../middleware/errorHandler';

/**
 * GET /api/expenses
 * 사용 내역 목록 조회
 */
export async function listExpenses(
  req: Request<any, any, any, ExpenseQueryParams>,
  res: Response<ApiResponse>,
  next: NextFunction
) {
  try {
    const { year, month, authorName, startDate, endDate, limit, offset } = req.query;

    const params: any = {};

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
    const expense = await getExpenseById(id);

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
  req: Request<any, any, CreateExpenseRequest>,
  res: Response<ApiResponse>,
  next: NextFunction
) {
  try {
    const { authorName, amount, expenseDate, storeName, receiptImageUrl, ocrRawData } = req.body;

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

    if (!receiptImageUrl || !receiptImageUrl.trim()) {
      throw new AppError('Receipt image URL is required', 400);
    }

    const expense = await createExpense({
      authorName: authorName.trim(),
      amount,
      expenseDate,
      storeName: storeName?.trim(),
      receiptImageUrl,
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
 * 사용 내역 수정
 */
export async function updateExistingExpense(
  req: Request<{ id: string }, any, UpdateExpenseRequest>,
  res: Response<ApiResponse>,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    const { authorName, amount, expenseDate, storeName } = req.body;

    const updateData: UpdateExpenseRequest = {};

    if (authorName !== undefined) {
      if (!authorName.trim()) {
        throw new AppError('Author name cannot be empty', 400);
      }
      updateData.authorName = authorName.trim();
    }

    if (amount !== undefined) {
      if (isNaN(amount) || amount <= 0) {
        throw new AppError('Valid amount is required', 400);
      }
      updateData.amount = amount;
    }

    if (expenseDate !== undefined) {
      updateData.expenseDate = expenseDate;
    }

    if (storeName !== undefined) {
      updateData.storeName = storeName?.trim();
    }

    const expense = await updateExpense(id, updateData);

    res.json({
      success: true,
      data: expense,
      message: 'Expense updated successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/expenses/:id
 * 사용 내역 삭제
 */
export async function deleteExistingExpense(
  req: Request<{ id: string }>,
  res: Response<ApiResponse>,
  next: NextFunction
) {
  try {
    const { id } = req.params;

    await deleteExpense(id);

    res.json({
      success: true,
      message: 'Expense deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}
