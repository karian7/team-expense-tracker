import { Request, Response } from 'express';
import { ApiResponse } from '../types';

export async function exportAll(_req: Request, res: Response<ApiResponse>) {
  res.status(501).json({ success: false, error: 'Export not yet implemented for event sourcing' });
}

export async function exportByPeriod(_req: Request, res: Response<ApiResponse>) {
  res.status(501).json({ success: false, error: 'Export not yet implemented for event sourcing' });
}

export async function importCsv(_req: Request, res: Response<ApiResponse>) {
  res.status(501).json({ success: false, error: 'Import not yet implemented for event sourcing' });
}

export async function downloadTemplate(_req: Request, res: Response) {
  res
    .status(501)
    .json({ success: false, error: 'Template not yet implemented for event sourcing' });
}
