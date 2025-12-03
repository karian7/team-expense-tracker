import { useMutation } from '@tanstack/react-query';
import { receiptApi } from '../services/api';

export function useUploadReceipt() {
  return useMutation({
    mutationFn: (file: File) => receiptApi.upload(file),
  });
}

export function useParseReceipt() {
  return useMutation({
    mutationFn: (imageUrl: string) => receiptApi.parse(imageUrl),
  });
}
