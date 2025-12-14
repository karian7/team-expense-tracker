import { Router } from 'express';
import { upload } from '../middleware/upload';
import { uploadReceipt, parseReceipt } from '../controllers/receiptController';

const router: Router = Router();

// POST /api/receipts/upload
router.post('/upload', upload.single('receipt'), uploadReceipt);

// POST /api/receipts/parse
router.post('/parse', parseReceipt);

export default router;
