import { Router } from 'express';
import { upload } from '../middleware/upload';
import { uploadReceipt, parseReceipt, getOcrProvider } from '../controllers/receiptController';

const router = Router();

// GET /api/receipts/ocr-provider
router.get('/ocr-provider', getOcrProvider);

// POST /api/receipts/upload
router.post('/upload', upload.single('receipt'), uploadReceipt);

// POST /api/receipts/parse
router.post('/parse', parseReceipt);

export default router;
