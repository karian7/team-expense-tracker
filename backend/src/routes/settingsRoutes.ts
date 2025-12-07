import { Router } from 'express';
import {
  getSettings,
  updateSettings,
  setInitialBudgetController,
  resetAllDataController,
} from '../controllers/settingsController';

const router: Router = Router();

// GET /api/settings
router.get('/', getSettings);

// PUT /api/settings
router.put('/', updateSettings);

// POST /api/settings/initial-budget
router.post('/initial-budget', setInitialBudgetController);

// DELETE /api/settings/reset (테스트용)
router.delete('/reset', resetAllDataController);

export default router;
