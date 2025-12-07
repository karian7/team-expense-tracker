import { Request, Response } from 'express';
import * as syncService from '../services/syncService';

/**
 * Pull: 서버 변경사항 전송
 */
export async function pullHandler(req: Request, res: Response) {
  try {
    const result = await syncService.pull(req.body);
    res.json(result);
  } catch (error) {
    console.error('Pull error:', error);
    res.status(500).json({ error: 'Pull failed' });
  }
}

/**
 * Push: 클라이언트 변경사항 수신
 */
export async function pushHandler(req: Request, res: Response) {
  try {
    const result = await syncService.push(req.body);
    res.json(result);
  } catch (error) {
    console.error('Push error:', error);
    res.status(500).json({ error: 'Push failed' });
  }
}
