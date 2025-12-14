import axios from 'axios';
import type {
  ApiResponse,
  ReceiptUploadResponse,
  AppSettings,
  BudgetEvent,
  CreateBudgetEventPayload,
} from '../types';

const inferBackendOrigin = () => {
  const { protocol, hostname, port } = window.location;
  const targetPort = port && port !== '80' && port !== '443' ? '3001' : port || '3001';
  return `${protocol}//${hostname}:${targetPort}`;
};

export const API_ORIGIN = (import.meta.env.VITE_API_URL ?? inferBackendOrigin()).replace(/\/$/, '');

const apiClient = axios.create({
  baseURL: `${API_ORIGIN}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Event API (Event Sourcing)
export const eventApi = {
  sync: async (sinceSequence: number = 0) => {
    const { data } = await apiClient.get(`/events/sync?since=${sinceSequence}`);
    return data.data as { lastSequence: number; events: BudgetEvent[] };
  },

  createEvent: async (event: CreateBudgetEventPayload) => {
    const { data } = await apiClient.post('/events', event);
    return data.data;
  },

  bulkSync: async (events: CreateBudgetEventPayload[]) => {
    const { data } = await apiClient.post('/events/bulk-sync', events);
    return data.data as { count: number; events: BudgetEvent[] };
  },
};

// Receipt API
export const receiptApi = {
  upload: async (file: File): Promise<ReceiptUploadResponse> => {
    const formData = new FormData();
    formData.append('receipt', file);

    const { data } = await apiClient.post<ApiResponse<ReceiptUploadResponse>>(
      '/receipts/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return data.data!;
  },

  parse: async (imageBlob: string): Promise<ReceiptUploadResponse> => {
    const { data } = await apiClient.post<ApiResponse<ReceiptUploadResponse>>('/receipts/parse', {
      imageBlob,
    });
    return data.data!;
  },
};

// Settings API
export const settingsApi = {
  get: async (): Promise<AppSettings> => {
    const { data } = await apiClient.get<ApiResponse<AppSettings>>('/settings');
    return data.data!;
  },

  getDefaultMonthlyBudget: async (): Promise<number> => {
    const { data } = await apiClient.get<ApiResponse<AppSettings>>('/settings');
    return data.data?.defaultMonthlyBudget ?? 0;
  },

  update: async (settings: Partial<AppSettings>): Promise<AppSettings> => {
    const { data } = await apiClient.put<ApiResponse<AppSettings>>('/settings', settings);
    return data.data!;
  },

  setInitialBudget: async (initialBudget: number): Promise<AppSettings> => {
    const { data } = await apiClient.post<ApiResponse<AppSettings>>('/settings/initial-budget', {
      initialBudget,
    });
    return data.data!;
  },

  getNeedsFullSync: async (): Promise<boolean> => {
    const { data } =
      await apiClient.get<ApiResponse<{ needsFullSync: boolean }>>('/settings/needsFullSync');
    return data.data?.needsFullSync ?? false;
  },

  updateNeedsFullSync: async (needsFullSync: boolean): Promise<void> => {
    await apiClient.patch('/settings/needsFullSync', { needsFullSync });
  },
};

export default apiClient;
