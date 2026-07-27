import { useEffect, useRef, useState } from 'react';
import type { QuestionAnswer, AIFeedback } from '../types';
import { getSampleAnswer } from '../services/awsApi';

interface Props {
  qa: QuestionAnswer;
  index: number;
  preloadedFeedback?: AIFeedback;
  feedbackLoading?: boolean;
  visaTypeLabel: string;
}

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (barRef.current) {
      barRef.current.style.width = '0%';
      const id = setTimeout(() => {
        if (barRef.current) barRef.current.style.width = `${score}%`;
      }, 100);
      return () => clearTimeout(id);
    }
  }, [score]);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-500">{label}</span>
        <span className="font-semibold text-gray-700">{score}/100</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          ref={barRef}
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ background: color, width: '0%' }}
        />
      </div>
    </div>
  );
}

export function SummaryCard({ qa, index, preloadedFeedback, feedbackLoading, visaTypeLabel }: Props) {
  const feedback = preloadedFeedback ?? qa.feedback ?? null;
  const loading = feedbackLoading && !feedback;

  const [sampleAnswer, setSampleAnswer] = useState<string | null>(null);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [sampleError, setSampleError] = useState('');
  const [sampleVisible, setSampleVisible] = useState(false);

  const handleShowSample = async () => {
    if (sampleAnswer) { setSampleVisible(v => !v); return; }
    setSampleLoading(true);
    setSampleError('');
    try {
      const answer = await getSampleAnswer(qa.question.question, visaTypeLabel, '');
      setSampleAnswer(answer);
      setSampleVisible(true);
    } catch {
      setSampleError('Could not generate sample answer. Try again.');
    } finally {
      setSampleLoading(false);
    }
  };

  const overall = feedback
    ? Math.round((feedback.grammarScore + feedback.confidenceScore + feedback.relevanceScore) / 3)
    : null;

  const scoreColor = (s: number) =>
    s >= 80 ? '#22c55e' : s >= 60 ? '#eab308' : '#ef4444';

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-100">
        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 leading-snug">{qa.question.question}</p>
          <p className="text-xs text-gray-400 mt-0.5">{qa.question.category}</p>
        </div>
        {overall !== null && (
          <span
            className="flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-bold text-white"
            style={{ background: scoreColor(overall) }}
          >
            {overall}
          </span>
        )}
        {loading && (
          <span className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
        )}
      </div>

      <div className="px-6 py-5 flex flex-col gap-4">
        {/* Your answer */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Your Answer</p>
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            {qa.transcript ? (
              <p className="text-sm text-gray-700 leading-relaxed">{qa.transcript}</p>
            ) : (
              <p className="text-sm text-gray-400 italic">No response recorded.</p>
            )}
          </div>
        </div>

        {/* AI feedback scores */}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span className="w-4 h-4 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
            Analysing response…
          </div>
        )}

        {feedback && !loading && (
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">AI Feedback</p>
            <ScoreBar label="Grammar"    score={feedback.grammarScore}    color="#3b82f6" />
            <ScoreBar label="Confidence" score={feedback.confidenceScore} color="#8b5cf6" />
            <ScoreBar label="Relevance"  score={feedback.relevanceScore}  color="#22c55e" />
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
              <p className="text-xs font-semibold text-blue-600 mb-1.5">Coaching Tip</p>
              <p className="text-sm text-blue-800 leading-relaxed">{feedback.feedback}</p>
            </div>
          </div>
        )}

        {/* Sample answer section */}
        <div className="border-t border-gray-100 pt-4">
          <button
            onClick={handleShowSample}
            disabled={sampleLoading}
            className={[
              'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all w-full justify-center',
              sampleVisible
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                : 'bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-60',
            ].join(' ')}
          >
            {sampleLoading ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Generating sample answer…
              </>
            ) : sampleVisible ? (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
                Hide Sample Answer
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Show AI Sample Answer
              </>
            )}
          </button>

          {sampleError && (
            <p className="text-xs text-red-500 mt-2 text-center">{sampleError}</p>
          )}

          {sampleVisible && sampleAnswer && (
            <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-emerald-600 text-base">✨</span>
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Model Answer</p>
                <span className="ml-auto text-[10px] text-emerald-500 bg-emerald-100 px-2 py-0.5 rounded-full">AI generated</span>
              </div>
              <p className="text-sm text-emerald-900 leading-relaxed">{sampleAnswer}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
