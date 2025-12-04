import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { budgetApi } from '../services/api';
import type { AuthorBreakdown } from '../types';
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
    queryKey: ['monthlyReport', year, month],
    queryFn: () => budgetApi.getReport(year, month),
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
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-6xl w-full max-h-[90vh] overflow-y-auto">
          <div className="text-center py-12">로딩 중...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-6xl w-full max-h-[90vh] overflow-y-auto">
          <div className="text-center py-12 text-red-600">리포트를 불러오는데 실패했습니다.</div>
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
      <div className="bg-white rounded-lg p-6 max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">월별 리포트</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700" aria-label="닫기">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Month Selector */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <button
            onClick={handlePreviousMonth}
            className="p-2 hover:bg-gray-100 rounded-full"
            aria-label="이전 달"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <h3 className="text-xl font-semibold">
            {year}년 {month}월
          </h3>
          <button
            onClick={handleNextMonth}
            className="p-2 hover:bg-gray-100 rounded-full"
            aria-label="다음 달"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Budget Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="card">
            <div className="text-sm text-gray-600 mb-1">총 예산</div>
            <div className="text-2xl font-bold text-gray-900">
              ₩{formatCurrency(budget.totalBudget)}
            </div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600 mb-1">총 사용액</div>
            <div className="text-2xl font-bold text-blue-600">
              ₩{formatCurrency(budget.totalSpent)}
            </div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600 mb-1">잔액</div>
            <div
              className={`text-2xl font-bold ${budget.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}
            >
              ₩{formatCurrency(budget.balance)}
            </div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600 mb-1">사용률</div>
            <div className="text-2xl font-bold text-purple-600">{usagePercentage.toFixed(1)}%</div>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="card">
            <div className="text-sm text-gray-600 mb-1">총 지출 건수</div>
            <div className="text-xl font-semibold text-gray-900">{statistics.expenseCount}건</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600 mb-1">평균 지출액</div>
            <div className="text-xl font-semibold text-gray-900">
              ₩
              {formatCurrency(
                statistics.expenseCount > 0 ? statistics.totalExpenses / statistics.expenseCount : 0
              )}
            </div>
          </div>
        </div>

        {/* Charts */}
        {statistics.expenseCount > 0 ? (
          <div className="space-y-8">
            {/* Daily Breakdown Chart */}
            {statistics.dailyBreakdown.length > 0 && (
              <div className="card">
                <h3 className="text-lg font-semibold mb-4">일별 지출 내역</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={statistics.dailyBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={formatDate} />
                    <YAxis />
                    <Tooltip
                      formatter={(value: number) => `₩${formatCurrency(value)}`}
                      labelFormatter={formatDate}
                    />
                    <Legend />
                    <Bar dataKey="amount" fill="#3b82f6" name="지출액" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Author Breakdown Chart */}
            {statistics.authorBreakdown.length > 0 && (
              <div className="card">
                <h3 className="text-lg font-semibold mb-4">작성자별 지출 내역</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={statistics.authorBreakdown}
                        dataKey="amount"
                        nameKey="authorName"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={(entry: AuthorBreakdown) =>
                          `${entry.authorName}: ${((entry.amount / statistics.totalExpenses) * 100).toFixed(1)}%`
                        }
                      >
                        {statistics.authorBreakdown.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `₩${formatCurrency(value)}`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {statistics.authorBreakdown.map((author, index) => (
                      <div
                        key={author.authorName}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="font-medium">{author.authorName}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">₩{formatCurrency(author.amount)}</div>
                          <div className="text-sm text-gray-600">{author.count}건</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Top Expenses */}
            {statistics.topExpenses.length > 0 && (
              <div className="card">
                <h3 className="text-lg font-semibold mb-4">상위 지출 내역 (Top 5)</h3>
                <div className="space-y-3">
                  {statistics.topExpenses.map((expense, index) => (
                    <div
                      key={expense.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full font-semibold">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium">{expense.storeName || '상호명 없음'}</div>
                          <div className="text-sm text-gray-600">
                            {expense.authorName} ·{' '}
                            {new Date(expense.expenseDate).toLocaleDateString('ko-KR')}
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
          <div className="card text-center py-12 text-gray-500">
            이번 달에는 아직 지출 내역이 없습니다.
          </div>
        )}

        {/* Close Button */}
        <div className="mt-6">
          <button onClick={onClose} className="btn-secondary w-full">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
