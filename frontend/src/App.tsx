import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import HomePage from './pages/HomePage';
import { syncService } from './services/sync/syncService';
import { budgetService } from './services/local/budgetService';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // 1. 먼저 동기화
        await syncService.sync();

        // 2. 현재 월 예산을 로컬에서 생성 (필요시)
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;

        const created = await budgetService.ensureMonthlyBudget(year, month);

        if (created) {
          console.log('Created default monthly budget locally. Syncing...');
          await syncService.sync();
        }
      } catch (error) {
        console.error('App initialization failed:', error);
      }
    };

    initializeApp();
  }, []);

  useEffect(() => {
    const timer = syncService.startAutoSync(5000);
    return () => {
      syncService.stopAutoSync(timer);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <HomePage />
    </QueryClientProvider>
  );
}

export default App;
