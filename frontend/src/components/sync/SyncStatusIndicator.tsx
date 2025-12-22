import { useLiveQuery } from 'dexie-react-hooks';
import toast from 'react-hot-toast';
import { db } from '../../services/db/database';

export default function SyncStatusIndicator() {
  const syncStatus = useLiveQuery(() => db.syncStatus.get('lastSync'), []);
  const pendingCount = useLiveQuery(() => db.pendingEvents.count(), []) ?? 0;

  // 에러가 있거나 pending이 있을 때만 표시
  const hasError = syncStatus?.lastErrorTime !== null && syncStatus?.lastErrorTime !== undefined;
  const hasPending = pendingCount > 0;

  if (!hasError && !hasPending) {
    return null;
  }

  // 상태에 따른 메시지 생성
  const getStatusMessage = () => {
    if (hasError) {
      return `동기화 오류: ${syncStatus?.lastErrorMessage || '알 수 없는 오류'}`;
    }
    return `동기화 대기 중: ${pendingCount}건`;
  };

  const statusMessage = getStatusMessage();

  // 클릭 시 상세 정보 표시
  const handleClick = () => {
    if (hasError) {
      const errorMessage = syncStatus?.lastErrorMessage || '알 수 없는 오류';
      const errorTime = syncStatus?.lastErrorTime
        ? new Date(syncStatus.lastErrorTime).toLocaleString('ko-KR')
        : '알 수 없음';

      toast.error(`동기화 오류\n\n${errorMessage}\n\n발생 시간: ${errorTime}`, {
        duration: 5000,
        icon: '⚠️',
      });
    } else if (hasPending) {
      toast(
        `동기화 대기 중\n\n${pendingCount}건의 이벤트가 서버 동기화를 기다리고 있습니다.\n\n자동으로 동기화됩니다.`,
        {
          duration: 4000,
          icon: '🔄',
        }
      );
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors relative"
        title={statusMessage}
        aria-label={statusMessage}
        type="button"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-6 w-6 ${hasError ? 'text-red-500' : 'text-yellow-500'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          {hasError ? (
            // Error icon
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          ) : (
            // Sync pending icon
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          )}
        </svg>
        {/* Badge */}
        {hasPending && (
          <span
            className={`absolute -top-1 -right-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-xs font-bold ${
              hasError ? 'bg-red-500 text-white' : 'bg-yellow-500 text-white'
            }`}
            aria-label={`${pendingCount}건 대기 중`}
          >
            {pendingCount > 99 ? '99+' : pendingCount}
          </span>
        )}
      </button>
    </div>
  );
}
