import express, { Request, Response } from 'express';
import { createBudgetEvent, syncEvents } from '../services/budgetEventService';
import { CreateBudgetEventRequest } from '../types';

const router: express.Router = express.Router();

/**
 * POST /api/events
 * 새 이벤트 생성 (Append-Only)
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const data = req.body as CreateBudgetEventRequest;

    const event = await createBudgetEvent(data);

    res.status(201).json({
      success: true,
      data: event,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/events/sync?since=123
 * 동기화 API - 특정 sequence 이후의 이벤트 조회
 */
router.get('/sync', async (req: Request, res: Response) => {
  try {
    const sinceSequence = req.query.since ? parseInt(req.query.since as string, 10) : 0;
    const result = await syncEvents(sinceSequence);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
