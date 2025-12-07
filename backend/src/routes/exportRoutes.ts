import { Router } from 'express';
import { uploadCsv } from '../middleware/upload';
import { exportAll, importCsv, downloadTemplate } from '../controllers/exportController';

const router: Router = Router();

// GET /api/export/expenses
router.get('/expenses', exportAll);

// GET /api/export/template
router.get('/template', downloadTemplate);

// POST /api/import/expenses
router.post('/expenses', uploadCsv.single('file'), importCsv);

export default router;
