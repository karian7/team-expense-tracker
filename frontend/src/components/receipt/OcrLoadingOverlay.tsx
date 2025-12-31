import { useState, useEffect } from 'react';

// 재미있는 로딩 메시지 30개
const LOADING_MESSAGES = [
  '영수증을 열심히 읽고 있어요...',
  '금액을 확인하고 있어요... 혹시 비싼 거 드셨나요?',
  'AI가 돋보기를 쓰고 분석 중...',
  '숫자들을 하나하나 세고 있어요...',
  '거의 다 됐어요! 조금만 기다려주세요',
  '맛있는 식사 하셨나요?',
  '영수증 글씨체가 예술이네요...',
  'AI가 열심히 일하는 중... 커피 한 잔 어때요?',
  '숫자들이 춤추고 있어요... 잡는 중!',
  '영수증의 비밀을 파헤치는 중...',
  '계산기 두드리는 중... 딸깍딸깍',
  '오늘 회식 어떠셨어요?',
  'AI 눈이 빠지게 읽는 중...',
  '이 영수증... 뭔가 맛있는 게 보여요!',
  '열심히 분석 중! 포기하지 않을게요',
  '숫자 인식 99%... 아 잠깐 98%...',
  '영수증 속 세상을 탐험하는 중...',
  'OCR 엔진 풀가동 중!',
  '잠시만요, 거의 다 읽었어요!',
  '이 글씨... 의사 선생님이 쓰신 건 아니죠?',
  'AI가 안경을 닦고 다시 보는 중...',
  '영수증 해독 미션 진행 중!',
  '카드값 걱정은 잠시 내려놓으세요~',
  '열심히 계산 중... 수학 시험 보는 기분!',
  '영수증 속 금액을 찾아서...',
  'AI 분석가가 출동했습니다!',
  '곧 결과가 나와요, 두근두근',
  '영수증 읽기 챔피언 AI 등장!',
  '데이터 추출 중... 비밀번호는 아니에요!',
  '마지막 점검 중... 완벽을 위해!',
];

// 분석 단계 정의
type AnalysisStep = 'uploading' | 'recognizing' | 'extracting';

interface StepInfo {
  label: string;
  description: string;
}

const STEPS: Record<AnalysisStep, StepInfo> = {
  uploading: { label: '이미지 전송', description: '서버로 이미지를 전송하고 있어요' },
  recognizing: { label: '텍스트 인식', description: 'AI가 영수증의 글자를 읽고 있어요' },
  extracting: { label: '정보 추출', description: '금액과 날짜를 찾고 있어요' },
};

const STEP_ORDER: AnalysisStep[] = ['uploading', 'recognizing', 'extracting'];

interface OcrLoadingOverlayProps {
  isVisible: boolean;
}

export default function OcrLoadingOverlay({ isVisible }: OcrLoadingOverlayProps) {
  const [currentMessage, setCurrentMessage] = useState(0);
  const [currentStep, setCurrentStep] = useState<AnalysisStep>('uploading');
  const [elapsedTime, setElapsedTime] = useState(0);

  // 메시지 순환 (2.5초마다) - 컴포넌트 마운트 시 시작
  useEffect(() => {
    const messageInterval = setInterval(() => {
      setCurrentMessage((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2500);

    return () => clearInterval(messageInterval);
  }, []);

  // 단계 진행 시뮬레이션 (실제 API 상태와 연동하면 더 좋음)
  useEffect(() => {
    const stepTimings = [
      { step: 'recognizing' as AnalysisStep, delay: 1500 },
      { step: 'extracting' as AnalysisStep, delay: 4000 },
    ];

    const timers = stepTimings.map(({ step, delay }) =>
      setTimeout(() => setCurrentStep(step), delay)
    );

    return () => timers.forEach(clearTimeout);
  }, []);

  // 경과 시간 측정
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  if (!isVisible) return null;

  const currentStepIndex = STEP_ORDER.indexOf(currentStep);

  return (
    <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center z-10">
      {/* 스캔 라인 애니메이션 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="scan-line absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary-500 to-transparent opacity-70" />
      </div>

      {/* 메인 컨텐츠 */}
      <div className="relative z-10 flex flex-col items-center w-full px-6 py-4">
        {/* 영수증 아이콘 애니메이션 */}
        <div className="relative mb-4">
          <div className="receipt-icon w-16 h-20 bg-white rounded-lg shadow-lg border-2 border-primary-200 flex items-center justify-center">
            <div className="space-y-1">
              <div className="w-8 h-1 bg-primary-300 rounded animate-pulse" />
              <div className="w-6 h-1 bg-primary-200 rounded animate-pulse delay-75" />
              <div className="w-8 h-1 bg-primary-300 rounded animate-pulse delay-150" />
              <div className="w-5 h-1 bg-primary-200 rounded animate-pulse delay-200" />
            </div>
          </div>
          {/* 확대경 애니메이션 */}
          <div className="magnifier absolute -right-2 -bottom-2 w-8 h-8 text-primary-600">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
        </div>

        {/* 단계 표시 */}
        <div className="w-full mb-4">
          {/* 진행 바와 원형 버튼을 포함하는 컨테이너 */}
          <div className="relative flex justify-between items-center mb-3 px-4">
            {/* 진행 바 배경 (원형 버튼 뒤에 배치) */}
            <div className="absolute top-1/2 left-8 right-8 h-1 bg-gray-200 rounded-full -translate-y-1/2" />
            <div
              className="absolute top-1/2 left-8 h-1 bg-primary-500 rounded-full -translate-y-1/2 transition-all duration-500"
              style={{
                width: `calc(${(currentStepIndex / (STEP_ORDER.length - 1)) * 100}% * (100% - 64px) / 100%)`,
              }}
            />

            {STEP_ORDER.map((step, index) => {
              const isCompleted = index < currentStepIndex;
              const isCurrent = index === currentStepIndex;

              return (
                <div
                  key={step}
                  className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                    isCompleted
                      ? 'bg-green-500 text-white'
                      : isCurrent
                        ? 'bg-primary-500 text-white ring-4 ring-primary-200'
                        : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {isCompleted ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
              );
            })}
          </div>

          {/* 라벨 텍스트 (별도 줄) */}
          <div className="flex justify-between px-2">
            {STEP_ORDER.map((step, index) => {
              const isCurrent = index === currentStepIndex;
              return (
                <span
                  key={step}
                  className={`text-xs text-center flex-1 whitespace-nowrap ${
                    isCurrent ? 'text-primary-600 font-medium' : 'text-gray-500'
                  }`}
                >
                  {STEPS[step].label}
                </span>
              );
            })}
          </div>
        </div>

        {/* 현재 단계 설명 */}
        <p className="text-sm text-gray-600 text-center mb-3">{STEPS[currentStep].description}</p>

        {/* 재미있는 메시지 */}
        <div className="w-full min-h-[48px] flex items-center justify-center">
          <p className="text-primary-600 font-medium text-center text-sm leading-relaxed animate-fade-in">
            {LOADING_MESSAGES[currentMessage]}
          </p>
        </div>

        {/* 경과 시간 */}
        <p className="text-xs text-gray-400 mt-2">
          {elapsedTime}초 경과 {elapsedTime > 10 && '(조금만 더 기다려주세요!)'}
        </p>
      </div>

      {/* CSS 애니메이션 스타일 */}
      <style>{`
        @keyframes scan {
          0% {
            top: 0;
            opacity: 0;
          }
          10% {
            opacity: 0.7;
          }
          90% {
            opacity: 0.7;
          }
          100% {
            top: 100%;
            opacity: 0;
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-5px);
          }
        }

        @keyframes wobble {
          0%, 100% {
            transform: rotate(-5deg);
          }
          50% {
            transform: rotate(5deg);
          }
        }

        .scan-line {
          animation: scan 2s ease-in-out infinite;
        }

        .receipt-icon {
          animation: float 2s ease-in-out infinite;
        }

        .magnifier {
          animation: wobble 1s ease-in-out infinite;
        }

        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(5px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
