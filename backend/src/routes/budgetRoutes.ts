import { Router } from 'express';
import {
  getCurrentBudget,
  getBudgetByMonth,
  updateBudgetBaseAmount,
  handleRollover,
} from '../controllers/budgetController';

const router: Router = Router();

// GET /api/monthly-budgets/current
router.get('/current', getCurrentBudget);

// POST /api/monthly-budgets/rollover
router.post('/rollover', handleRollover);

// GET /api/monthly-budgets/:year/:month
router.get('/:year/:month', getBudgetByMonth);

// PUT /api/monthly-budgets/:year/:month
router.put('/:year/:month', updateBudgetBaseAmount);

export default router;
