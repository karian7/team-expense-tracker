import { Router } from 'express';
import { getSettings, updateSettings } from '../controllers/settingsController';

const router = Router();

// GET /api/settings
router.get('/', getSettings);

// PUT /api/settings
router.put('/', updateSettings);

export default router;
