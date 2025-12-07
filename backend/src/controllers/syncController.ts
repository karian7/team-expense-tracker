import { Request, Response } from 'express';
import { ApiResponse } from '../types';

export async function pullData(_req: Request, res: Response<ApiResponse>) {
  res.status(501).json({ success: false, error: 'Sync not yet implemented for event sourcing' });
}

export async function pushData(_req: Request, res: Response<ApiResponse>) {
  res.status(501).json({ success: false, error: 'Sync not yet implemented for event sourcing' });
}
