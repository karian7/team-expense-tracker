import { useMutation } from '@tanstack/react-query';
import { receiptApi } from '../services/api';

export function useUploadReceipt() {
  return useMutation({
    mutationFn: (file: File) => receiptApi.upload(file),
  });
}
