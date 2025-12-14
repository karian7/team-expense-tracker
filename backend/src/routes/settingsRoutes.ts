import { Router } from 'express';
import {
  getSettings,
  updateSettings,
  setInitialBudgetController,
  getNeedsFullSyncController,
  updateNeedsFullSyncController,
} from '../controllers/settingsController';

const router: Router = Router();

// GET /api/settings
router.get('/', getSettings);

// PUT /api/settings
router.put('/', updateSettings);

// POST /api/settings/initial-budget
router.post('/initial-budget', setInitialBudgetController);

// GET /api/settings/needsFullSync
router.get('/needsFullSync', getNeedsFullSyncController);

// PATCH /api/settings/needsFullSync
router.patch('/needsFullSync', updateNeedsFullSyncController);

export default router;
