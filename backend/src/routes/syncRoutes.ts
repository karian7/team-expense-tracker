import express from 'express';
import * as syncController from '../controllers/syncController';

const router: express.Router = express.Router();

router.post('/pull', syncController.pullData);
router.post('/push', syncController.pushData);

export default router;
