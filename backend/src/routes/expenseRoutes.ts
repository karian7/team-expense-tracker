import { Router } from 'express';
import {
  listExpenses,
  getExpense,
  createNewExpense,
  updateExistingExpense,
  deleteExistingExpense,
} from '../controllers/expenseController';

const router: Router = Router();

// GET /api/expenses
router.get('/', listExpenses);

// POST /api/expenses
router.post('/', createNewExpense);

// GET /api/expenses/:id
router.get('/:id', getExpense);

// PUT /api/expenses/:id
router.put('/:id', updateExistingExpense);

// DELETE /api/expenses/:id
router.delete('/:id', deleteExistingExpense);

export default router;
