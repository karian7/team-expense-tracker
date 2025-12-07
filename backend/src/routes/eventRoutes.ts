import express, { Request, Response } from 'express';
import {
  createBudgetEvent,
  syncEvents,
  getEventsByMonth,
  calculateMonthlyBudget,
  getLatestSequence,
  getEventsByDateRange,
  getEventBySequence,
} from '../services/budgetEventService';
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

/**
 * GET /api/events/latest-sequence
 * 최신 sequence 번호 조회
 */
router.get('/latest-sequence', async (req: Request, res: Response) => {
  try {
    const sequence = await getLatestSequence();
    res.json({ success: true, data: { sequence } });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/events/month/:year/:month
 * 특정 월의 모든 이벤트 조회
 */
router.get('/month/:year/:month', async (req: Request, res: Response) => {
  try {
    const year = parseInt(req.params.year, 10);
    const month = parseInt(req.params.month, 10);
    const events = await getEventsByMonth(year, month);
    res.json({ success: true, data: events });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/events/budget/:year/:month
 * 특정 월의 예산 계산 (서버 사이드 집계)
 */
router.get('/budget/:year/:month', async (req: Request, res: Response) => {
  try {
    const year = parseInt(req.params.year, 10);
    const month = parseInt(req.params.month, 10);
    const budget = await calculateMonthlyBudget(year, month);
    res.json({ success: true, data: budget });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/events/range
 * 날짜 범위로 이벤트 조회
 */
router.get('/range', async (req: Request, res: Response) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(0);
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
    const events = await getEventsByDateRange(startDate, endDate);
    res.json({ success: true, data: events });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/events/:sequence
 * 특정 이벤트 조회
 */
router.get('/:sequence', async (req: Request, res: Response) => {
  try {
    const sequence = parseInt(req.params.sequence, 10);
    const event = await getEventBySequence(sequence);
    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }
    res.json({ success: true, data: event });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
