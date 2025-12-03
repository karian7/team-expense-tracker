import { Router } from 'express';
import { uploadCsv } from '../middleware/upload';
import {
  exportExpenses,
  importExpenses,
  downloadTemplate,
} from '../controllers/exportController';

const router = Router();

// GET /api/export/expenses
router.get('/expenses', exportExpenses);

// GET /api/export/template
router.get('/template', downloadTemplate);

// POST /api/import/expenses
router.post('/expenses', uploadCsv.single('file'), importExpenses);

export default router;
