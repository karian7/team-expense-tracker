import { Router } from 'express';
import { getSettings, updateSettings, setInitialBudgetController } from '../controllers/settingsController';

const router = Router();

// GET /api/settings
router.get('/', getSettings);

// PUT /api/settings
router.put('/', updateSettings);

// POST /api/settings/initial-budget
router.post('/initial-budget', setInitialBudgetController);

export default router;
