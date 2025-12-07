import { Request, Response, NextFunction } from 'express';
import {
  getCurrentMonthlyBudget,
  getOrCreateMonthlyBudget,
  updateMonthlyBudgetBaseAmount,
  rolloverMonth,
  getMonthlyReport,
  adjustCurrentMonthBudget,
} from '../services/budgetService';
import { ApiResponse, UpdateMonthlyBudgetRequest, AdjustCurrentBudgetRequest } from '../types';
import { AppError } from '../middleware/errorHandler';

/**
 * GET /api/monthly-budgets/current
 * 현재 월의 예산 조회
 */
export async function getCurrentBudget(
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) {
  try {
    const budget = await getCurrentMonthlyBudget();

    res.json({
      success: true,
      data: budget,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/monthly-budgets/:year/:month
 * 특정 월의 예산 조회
 */
export async function getBudgetByMonth(
  req: Request<{ year: string; month: string }>,
  res: Response<ApiResponse>,
  next: NextFunction
) {
  try {
    const year = parseInt(req.params.year);
    const month = parseInt(req.params.month);

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      throw new AppError('Invalid year or month', 400);
    }

    const budget = await getOrCreateMonthlyBudget(year, month);

    res.json({
      success: true,
      data: budget,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/monthly-budgets/:year/:month
 * 월 예산의 기본 금액 설정
 */
export async function updateBudgetBaseAmount(
  req: Request<{ year: string; month: string }, ApiResponse, UpdateMonthlyBudgetRequest>,
  res: Response<ApiResponse>,
  next: NextFunction
) {
  try {
    const year = parseInt(req.params.year);
    const month = parseInt(req.params.month);
    const { baseAmount } = req.body;

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      throw new AppError('Invalid year or month', 400);
    }

    if (baseAmount === undefined || isNaN(baseAmount) || baseAmount < 0) {
      throw new AppError('Invalid base amount', 400);
    }

    const budget = await updateMonthlyBudgetBaseAmount(year, month, baseAmount);

    res.json({
      success: true,
      data: budget,
      message: 'Budget base amount updated successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/monthly-budgets/rollover
 * 월 이월 처리
 */
export async function handleRollover(
  req: Request<
    Record<string, never>,
    ApiResponse,
    { fromYear: number; fromMonth: number; toYear: number; toMonth: number; newBaseAmount: number }
  >,
  res: Response<ApiResponse>,
  next: NextFunction
) {
  try {
    const { fromYear, fromMonth, toYear, toMonth, newBaseAmount } = req.body;

    if (
      !fromYear ||
      !fromMonth ||
      !toYear ||
      !toMonth ||
      fromMonth < 1 ||
      fromMonth > 12 ||
      toMonth < 1 ||
      toMonth > 12 ||
      newBaseAmount === undefined ||
      newBaseAmount < 0
    ) {
      throw new AppError('Invalid rollover parameters', 400);
    }

    const budget = await rolloverMonth(fromYear, fromMonth, toYear, toMonth, newBaseAmount);

    res.json({
      success: true,
      data: budget,
      message: 'Month rolled over successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/monthly-budgets/:year/:month/report
 * 월별 리포트 조회
 */
export async function getReport(
  req: Request<{ year: string; month: string }>,
  res: Response<ApiResponse>,
  next: NextFunction
) {
  try {
    const year = parseInt(req.params.year);
    const month = parseInt(req.params.month);

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      throw new AppError('Invalid year or month', 400);
    }

    const report = await getMonthlyReport(year, month);

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/monthly-budgets/current/adjust
 * 현재 월 예산 잔액 조정
 */
export async function adjustCurrentBudget(
  req: Request<Record<string, never>, ApiResponse, AdjustCurrentBudgetRequest>,
  res: Response<ApiResponse>,
  next: NextFunction
) {
  try {
    const { targetBalance, description } = req.body;

    if (targetBalance === undefined || isNaN(targetBalance) || targetBalance < 0) {
      throw new AppError('Invalid target balance', 400);
    }

    if (!description || description.trim().length === 0) {
      throw new AppError('Description is required', 400);
    }

    const budget = await adjustCurrentMonthBudget(targetBalance, description.trim());

    res.json({
      success: true,
      data: budget,
      message: 'Budget adjusted successfully',
    });
  } catch (error) {
    next(error);
  }
}
