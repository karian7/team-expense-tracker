import { Router } from 'express';
import {
  getCurrentBudget,
  getBudgetByMonth,
  updateBudgetBaseAmount,
  handleRollover,
  getReport,
  adjustCurrentBudget,
  ensureCurrentMonthBudgetController,
} from '../controllers/budgetController';

const router: Router = Router();

// GET /api/monthly-budgets/current
router.get('/current', getCurrentBudget);

// POST /api/monthly-budgets/ensure-current
router.post('/ensure-current', ensureCurrentMonthBudgetController);

// POST /api/monthly-budgets/current/adjust
router.post('/current/adjust', adjustCurrentBudget);

// POST /api/monthly-budgets/rollover
router.post('/rollover', handleRollover);

// GET /api/monthly-budgets/:year/:month/report
router.get('/:year/:month/report', getReport);

// GET /api/monthly-budgets/:year/:month
router.get('/:year/:month', getBudgetByMonth);

// PUT /api/monthly-budgets/:year/:month
router.put('/:year/:month', updateBudgetBaseAmount);

export default router;
