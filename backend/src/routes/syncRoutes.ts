import express from 'express';
import * as syncController from '../controllers/syncController';

const router = express.Router();

router.post('/pull', syncController.pullHandler);
router.post('/push', syncController.pushHandler);

export default router;
