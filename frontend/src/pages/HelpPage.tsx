interface HelpPageProps {
  onClose: () => void;
}

export default function HelpPage({ onClose }: HelpPageProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-sm w-full shadow-2xl overflow-hidden animate-fade-in-up">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h2 className="text-lg font-bold text-gray-900">홈 화면에 추가하기</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* iOS Instructions */}
          <div className="space-y-3">
            <h3 className="font-bold text-gray-900 flex items-center gap-2 text-base">
              <span className="text-xl">🍎</span> iOS (iPhone/iPad)
            </h3>
            <ol className="text-sm text-gray-600 space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
              <li className="flex gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-900 shadow-sm">1</span>
                <span>
                  Safari 하단의 <span className="inline-flex items-center justify-center px-1.5 py-0.5 bg-gray-200 rounded text-blue-600 mx-1 align-middle">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v9m0 0l4-4m-4 4l-4-4" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12v6a2 2 0 002 2h8a2 2 0 002-2v-6" />
                    </svg>
                  </span>
                  공유 버튼을 누르세요.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-900 shadow-sm">2</span>
                <span>
                  메뉴를 아래로 스크롤하여 <span className="font-bold text-gray-900">'홈 화면에 추가'</span>를 선택하세요.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-900 shadow-sm">3</span>
                <span>
                  우측 상단의 <span className="font-bold text-blue-600">'추가'</span> 버튼을 누르세요.
                </span>
              </li>
            </ol>
          </div>

          {/* Android Instructions */}
          <div className="space-y-3">
            <h3 className="font-bold text-gray-900 flex items-center gap-2 text-base">
              <span className="text-xl">🤖</span> Android (Chrome)
            </h3>
            <ol className="text-sm text-gray-600 space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
              <li className="flex gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-900 shadow-sm">1</span>
                <span>
                  Chrome 상단의 <span className="inline-flex items-center justify-center px-1.5 py-0.5 bg-gray-200 rounded text-gray-600 mx-1 align-middle font-bold text-xs">⋮</span> 메뉴 버튼을 누르세요.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-900 shadow-sm">2</span>
                <span>
                  <span className="font-bold text-gray-900">'앱 설치'</span> 또는 <span className="font-bold text-gray-900">'홈 화면에 추가'</span>를 선택하세요.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-900 shadow-sm">3</span>
                <span>
                  안내에 따라 설치를 완료하세요.
                </span>
              </li>
            </ol>
          </div>

          <div className="text-center">
            <p className="text-xs text-gray-400 bg-gray-50 inline-block px-3 py-1 rounded-full">
              ✨ 홈 화면에 추가하면 앱처럼 더 빠르게 실행할 수 있습니다
            </p>
          </div>
        </div>

        {/* Footer Action */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={onClose}
            className="w-full py-3 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl shadow-sm hover:bg-gray-50 active:scale-[0.98] transition-all"
          >
            확인했어요
          </button>
        </div>
      </div>
    </div>
  );
}
