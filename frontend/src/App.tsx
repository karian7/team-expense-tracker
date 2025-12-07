import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import HomePage from './pages/HomePage';
import { syncService } from './services/sync/syncService';
import { budgetApi } from './services/api';
import { eventService } from './services/local/eventService';
import { settingsService } from './services/local/settingsService';
import { BUDGET_EVENT_CONSTANTS } from './constants/budgetEvents';

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

        // 2. 현재 월 예산 반영 여부 확인
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;

        // 로컬 DB에서 이번 달 "기본 월별 예산" 이벤트 확인
        const events = await eventService.getEventsByMonth(year, month);
        const hasBudgetEvent = events.some(
          (e) =>
            e.eventType === 'BUDGET_IN' &&
            e.authorName === BUDGET_EVENT_CONSTANTS.SYSTEM_AUTHOR &&
            e.description === BUDGET_EVENT_CONSTANTS.MONTHLY_BUDGET_DESCRIPTION
        );

        // 설정된 기본 예산 확인
        const defaultBudget = await settingsService.getDefaultMonthlyBudget();

        // 예산이 설정되어 있고, 이번 달에 반영되지 않았으면 백엔드에 요청
        if (defaultBudget > 0 && !hasBudgetEvent) {
          console.log('Ensuring current month budget...');
          await budgetApi.ensureCurrent();
          // 다시 동기화하여 새 이벤트 가져오기
          await syncService.sync();
        }
      } catch (error) {
        console.error('App initialization failed:', error);
      }
    };

    initializeApp();
  }, []);

  useEffect(() => {
    const timer = syncService.startAutoSync(60000);
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
