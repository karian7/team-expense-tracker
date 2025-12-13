import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportService } from '../services/local/reportService';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { AuthorBreakdown } from '../types';

interface MonthlyReportPageProps {
  onClose: () => void;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function MonthlyReportPage({ onClose }: MonthlyReportPageProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const {
    data: report,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['localMonthlyReport', year, month],
    queryFn: () => reportService.getMonthlyReport(year, month),
  });

  const handlePreviousMonth = () => {
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else {
      setMonth(month - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(month + 1);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="glass-panel p-8 max-w-6xl w-full max-h-[90vh] overflow-y-auto border border-white/20">
          <div className="text-center py-12 text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neon-blue mx-auto mb-4"></div>
            로딩 중... 🔄
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="glass-panel p-8 max-w-6xl w-full max-h-[90vh] overflow-y-auto border border-red-500/30">
          <div className="text-center py-12 text-red-400">리포트를 불러오는데 실패했습니다. 😢</div>
          <button onClick={onClose} className="btn-secondary w-full mt-4">
            닫기
          </button>
        </div>
      </div>
    );
  }

  if (!report) {
    return null;
  }

  const { budget, statistics } = report;
  const usagePercentage =
    budget.totalBudget > 0 ? (budget.totalSpent / budget.totalBudget) * 100 : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-50 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10 rounded-t-xl">
          <div className="px-6 h-14 flex items-center justify-between">
            <h1 className="text-lg font-bold text-gray-900">월별 리포트</h1>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-900">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </header>

        <main className="px-6 py-6 space-y-6">
          {/* Month Selector */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 flex items-center justify-between">
            <button
              onClick={handlePreviousMonth}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="이전 달"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <h2 className="text-lg font-bold text-gray-900">
              {year}년 {month}월
            </h2>
            <button
              onClick={handleNextMonth}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="다음 달"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>

          {/* Budget Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
              <p className="text-sm text-gray-500 mb-1">총 예산</p>
              <p className="text-xl font-bold text-gray-900">
                ₩{formatCurrency(budget.totalBudget)}
              </p>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
              <p className="text-sm text-gray-500 mb-1">총 사용액</p>
              <p className="text-xl font-bold text-indigo-600">
                ₩{formatCurrency(budget.totalSpent)}
              </p>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
              <p className="text-sm text-gray-500 mb-1">잔액</p>
              <p
                className={`text-xl font-bold ${budget.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}
              >
                ₩{formatCurrency(budget.balance)}
              </p>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
              <p className="text-sm text-gray-500 mb-1">사용률</p>
              <p className="text-xl font-bold text-purple-600">{usagePercentage.toFixed(1)}%</p>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
              <p className="text-sm text-gray-500 mb-1">총 지출 건수</p>
              <p className="text-xl font-semibold text-gray-900">{statistics.expenseCount}건</p>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
              <p className="text-sm text-gray-500 mb-1">평균 지출액</p>
              <p className="text-xl font-semibold text-gray-900">
                ₩
                {formatCurrency(
                  statistics.expenseCount > 0
                    ? statistics.totalExpenses / statistics.expenseCount
                    : 0
                )}
              </p>
            </div>
          </div>

          {/* Charts */}
          {statistics.expenseCount > 0 ? (
            <div className="space-y-6">
              {/* Daily Breakdown Chart */}
              {statistics.dailyBreakdown.length > 0 && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-6">일별 지출 내역</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={statistics.dailyBreakdown}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={formatDate} stroke="#6b7280" />
                      <YAxis stroke="#6b7280" />
                      <Tooltip
                        formatter={(value: number) => `₩${formatCurrency(value)}`}
                        labelFormatter={formatDate}
                        contentStyle={{
                          backgroundColor: '#fff',
                          borderRadius: '8px',
                          border: '1px solid #e5e7eb',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                          color: '#111827',
                        }}
                        itemStyle={{ color: '#111827' }}
                      />
                      <Legend />
                      <Bar dataKey="amount" fill="#6366f1" name="지출액" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Author Breakdown Chart */}
              {statistics.authorBreakdown.length > 0 && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-6">작성자별 지출 내역</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={statistics.authorBreakdown as unknown as Record<string, unknown>[]}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="amount"
                          nameKey="authorName"
                        >
                          {statistics.authorBreakdown.map((_: AuthorBreakdown, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => `₩${formatCurrency(value)}`}
                          contentStyle={{
                            backgroundColor: '#fff',
                            borderRadius: '8px',
                            border: '1px solid #e5e7eb',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            color: '#111827',
                          }}
                          itemStyle={{ color: '#111827' }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                      {statistics.authorBreakdown.map((author: AuthorBreakdown, index: number) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            ></div>
                            <span className="text-gray-900 font-medium">{author.authorName}</span>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-gray-900">
                              ₩{formatCurrency(author.amount)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {((author.amount / statistics.totalExpenses) * 100).toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Top Expenses */}
              {statistics.topExpenses.length > 0 && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-6">
                    상위 지출 내역 (Top 5) 🏆
                  </h3>
                  <div className="space-y-3">
                    {statistics.topExpenses.map((expense, index) => (
                      <div
                        key={expense.sequence}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex items-center justify-center w-8 h-8 bg-primary-50 text-primary-600 rounded-full font-bold text-sm">
                            {index + 1}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">
                              {expense.storeName || '상호명 없음'}
                            </div>
                            <div className="text-sm text-gray-500">
                              {expense.authorName} ·{' '}
                              {new Date(expense.eventDate).toLocaleDateString('ko-KR')}
                            </div>
                          </div>
                        </div>
                        <div className="text-lg font-bold text-gray-900">
                          ₩{formatCurrency(expense.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200 border-dashed">
              <p className="text-lg font-medium text-gray-900">지출 내역이 없습니다.</p>
              <p className="mt-1 text-sm text-gray-500">이번 달에는 아직 지출이 없네요!</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
