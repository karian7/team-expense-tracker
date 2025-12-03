import { Request, Response, NextFunction } from 'express';
import {
  getAppSettings,
  setDefaultMonthlyBudget,
} from '../services/settingsService';
import { ApiResponse, UpdateSettingsRequest } from '../types';
import { AppError } from '../middleware/errorHandler';

/**
 * GET /api/settings
 * 앱 설정 조회
 */
export async function getSettings(
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) {
  try {
    const settings = await getAppSettings();

    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/settings
 * 앱 설정 업데이트
 */
export async function updateSettings(
  req: Request<any, any, UpdateSettingsRequest>,
  res: Response<ApiResponse>,
  next: NextFunction
) {
  try {
    const { defaultMonthlyBudget } = req.body;

    if (defaultMonthlyBudget !== undefined) {
      if (isNaN(defaultMonthlyBudget) || defaultMonthlyBudget < 0) {
        throw new AppError('Invalid default monthly budget amount', 400);
      }

      await setDefaultMonthlyBudget(defaultMonthlyBudget);
    }

    const settings = await getAppSettings();

    res.json({
      success: true,
      data: settings,
      message: 'Settings updated successfully',
    });
  } catch (error) {
    next(error);
  }
}
