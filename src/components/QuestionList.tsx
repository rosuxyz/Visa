import type { Question, QuestionAnswer } from '../types';

interface Props {
  questions: Question[];
  currentIndex: number;
  answers: QuestionAnswer[];
}

export function QuestionList({ questions, currentIndex, answers }: Props) {
  return (
    <div className="flex flex-col gap-1 overflow-y-auto dark-scroll max-h-56 pr-1">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 px-1">All Questions</p>
      {questions.map((q, i) => {
        const isDone = i < currentIndex || (answers[i] && i !== currentIndex);
        const isCurrent = i === currentIndex;

        return (
          <div
            key={q.id}
            className={[
              'flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-xs transition-colors',
              isCurrent ? 'bg-blue-600/20 border border-blue-500/30' :
              isDone    ? 'bg-gray-800/40 border border-transparent' :
                          'border border-transparent opacity-50',
            ].join(' ')}
          >
            {/* Status icon */}
            <span className={[
              'mt-0.5 w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold',
              isCurrent ? 'bg-blue-500 text-white' :
              isDone    ? 'bg-green-500 text-white' :
                          'bg-gray-700 text-gray-400',
            ].join(' ')}>
              {isDone ? (
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                i + 1
              )}
            </span>

            {/* Question text */}
            <div className="flex-1 min-w-0">
              <p className={[
                'leading-snug truncate',
                isCurrent ? 'text-blue-200 font-medium' :
                isDone    ? 'text-gray-400' :
                            'text-gray-500',
              ].join(' ')}>
                {q.question}
              </p>
              {isDone && answers[i]?.transcript && (
                <p className="text-gray-600 truncate mt-0.5">
                  ✓ Answered
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
