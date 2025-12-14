import { Router } from 'express';
import { upload } from '../middleware/upload';
import { uploadReceipt } from '../controllers/receiptController';

const router: Router = Router();

// POST /api/receipts/upload
router.post('/upload', upload.single('receipt'), uploadReceipt);

export default router;
