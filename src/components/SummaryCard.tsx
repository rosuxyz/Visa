import { useEffect, useRef, useState } from 'react';
import type { QuestionAnswer, AIFeedback } from '../types';
import { getSampleAnswer } from '../services/awsApi';
import { useInterviewStore } from '../store/interviewStore';
import { PREPARE_FIELDS } from '../pages/PreparePage';

interface Props {
  qa: QuestionAnswer;
  index: number;
  /** undefined = not yet started, null = failed, AIFeedback = done */
  feedback: AIFeedback | null | undefined;
  /** true while this specific question is being analysed right now */
  isAnalysing: boolean;
  visaTypeLabel: string;
}

function ScoreBar({ label, score, color, icon }: { label: string; score: number; color: string; icon: string }) {
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!barRef.current) return;
    barRef.current.style.width = '0%';
    const id = setTimeout(() => { if (barRef.current) barRef.current.style.width = `${score}%`; }, 120);
    return () => clearTimeout(id);
  }, [score]);

  const label_color = score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-500';

  return (
    <div className="flex items-center gap-3">
      <span className="text-base w-5 flex-shrink-0">{icon}</span>
      <div className="flex-1">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-500 font-medium">{label}</span>
          <span className={`font-bold tabular-nums ${label_color}`}>{score}/100</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            ref={barRef}
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ background: color, width: '0%' }}
          />
        </div>
      </div>
    </div>
  );
}

function OverallBadge({ score }: { score: number }) {
  const cfg =
    score >= 80 ? { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', label: 'Strong' } :
    score >= 60 ? { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200', label: 'Good' } :
    score >= 40 ? { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', label: 'Fair' } :
                  { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', label: 'Weak' };
  return (
    <span className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {score}/100 · {cfg.label}
    </span>
  );
}

export function SummaryCard({ qa, index, feedback, isAnalysing, visaTypeLabel }: Props) {
  const { userDetailsByType } = useInterviewStore();
  const savedDetails = (userDetailsByType['visa'] ?? {}) as Record<string, string>;
  const userContext = PREPARE_FIELDS
    .filter(f => savedDetails[f.key]?.trim())
    .map(f => `${f.label}: ${savedDetails[f.key].trim()}`)
    .join('\n');

  const [sampleAnswer, setSampleAnswer] = useState<string | null>(null);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [sampleError, setSampleError] = useState('');
  const [sampleVisible, setSampleVisible] = useState(false);

  const handleShowSample = async () => {
    if (sampleAnswer) { setSampleVisible(v => !v); return; }
    setSampleLoading(true);
    setSampleError('');
    try {
      const answer = await getSampleAnswer(qa.question.question, visaTypeLabel, userContext);
      setSampleAnswer(answer);
      setSampleVisible(true);
    } catch {
      setSampleError('Could not generate sample answer. Try again.');
    } finally {
      setSampleLoading(false);
    }
  };

  const coh = feedback?.coherenceScore ?? feedback?.relevanceScore ?? 0;
  const overall = feedback
    ? Math.round((feedback.grammarScore + feedback.confidenceScore + feedback.relevanceScore + coh) / 4)
    : null;

  // pending = analysis hasn't started yet for this card
  const pending = feedback === undefined && !isAnalysing;

  return (
    <div className={[
      'bg-white rounded-2xl border overflow-hidden shadow-sm transition-all',
      isAnalysing ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200',
    ].join(' ')}>

      {/* ── Header: question ── */}
      <div className="flex items-start gap-4 px-6 py-4 border-b border-gray-100 bg-gray-50/60">
        <div className="w-8 h-8 rounded-full bg-blue-700 text-white flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 leading-snug">{qa.question.question}</p>
          <span className="inline-block mt-1.5 text-[11px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
            {qa.question.category}
          </span>
        </div>
        {overall !== null && <OverallBadge score={overall} />}
        {isAnalysing && (
          <span className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin mt-1" />
        )}
      </div>

      <div className="px-6 py-5 flex flex-col gap-5">

        {/* ── Step 1: Your recorded answer ── */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">🎤</span>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Your Recorded Answer</p>
          </div>
          <div className={[
            'rounded-xl p-4 border',
            qa.transcript
              ? 'bg-gray-50 border-gray-200'
              : 'bg-red-50 border-red-100',
          ].join(' ')}>
            {qa.transcript ? (
              <p className="text-sm text-gray-800 leading-relaxed">{qa.transcript}</p>
            ) : (
              <p className="text-sm text-red-400 italic">No response was recorded for this question.</p>
            )}
          </div>
        </div>

        {/* ── Step 2: AI Analysis ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🤖</span>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">AI Analysis</p>
          </div>

          {pending && (
            <div className="flex items-center gap-2.5 text-sm text-gray-400 bg-gray-50 rounded-xl p-4 border border-gray-100">
              <span className="text-gray-300">⏳</span>
              Waiting to be analysed…
            </div>
          )}

          {isAnalysing && (
            <div className="flex items-center gap-2.5 text-sm text-blue-600 bg-blue-50 rounded-xl p-4 border border-blue-100">
              <span className="w-4 h-4 rounded-full border-2 border-blue-400 border-t-transparent animate-spin flex-shrink-0" />
              Analysing your answer…
            </div>
          )}

          {feedback === null && !isAnalysing && (
            <div className="flex items-center gap-2.5 text-sm text-red-500 bg-red-50 rounded-xl p-4 border border-red-100">
              <span>⚠️</span>
              Analysis failed — could not score this answer.
            </div>
          )}

          {feedback && !isAnalysing && (
            <div className="flex flex-col gap-3">
              {/* Verdict badge */}
              {feedback.verdict && (
                <div className={[
                  'flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-bold',
                  feedback.verdict === 'Pass'       ? 'bg-green-50 text-green-700 border-green-200' :
                  feedback.verdict === 'Borderline' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                      'bg-red-50 text-red-700 border-red-200',
                ].join(' ')}>
                  <span>{feedback.verdict === 'Pass' ? '✓' : feedback.verdict === 'Borderline' ? '⚠' : '✗'}</span>
                  <span>ECO Verdict: {feedback.verdict}</span>
                </div>
              )}

              {/* Score bars */}
              <div className="grid grid-cols-2 gap-3">
                <ScoreBar label="Clarity"    score={feedback.grammarScore}    color="#64748b" icon="💬" />
                <ScoreBar label="Confidence" score={feedback.confidenceScore} color="#8b5cf6" icon="💪" />
                <ScoreBar label="Relevance"  score={feedback.relevanceScore}  color="#22c55e" icon="🎯" />
                <ScoreBar label="Coherence"  score={coh}                      color="#f59e0b" icon="🔗" />
              </div>

              {/* Strengths */}
              {feedback.strengths && feedback.strengths.length > 0 && (
                <div className="bg-green-50 rounded-xl p-3 border border-green-200">
                  <p className="text-[10px] font-bold text-green-700 uppercase tracking-wider mb-1.5">✓ What worked</p>
                  {feedback.strengths.map((s, i) => (
                    <p key={i} className="text-xs text-green-800 leading-relaxed">{s}</p>
                  ))}
                </div>
              )}

              {/* Weaknesses */}
              {feedback.weaknesses && feedback.weaknesses.length > 0 && (
                <div className="bg-red-50 rounded-xl p-3 border border-red-200">
                  <p className="text-[10px] font-bold text-red-700 uppercase tracking-wider mb-1.5">✗ Fix this</p>
                  {feedback.weaknesses.map((w, i) => (
                    <p key={i} className="text-xs text-red-800 leading-relaxed">{w}</p>
                  ))}
                </div>
              )}

              {/* Missed points */}
              {feedback.missedPoints && feedback.missedPoints.length > 0 && (
                <div className="bg-orange-50 rounded-xl p-3 border border-orange-200">
                  <p className="text-[10px] font-bold text-orange-700 uppercase tracking-wider mb-1.5">⚠ Missing from your answer</p>
                  {feedback.missedPoints.map((m, i) => (
                    <p key={i} className="text-xs text-orange-800 leading-relaxed">{m}</p>
                  ))}
                </div>
              )}

              {/* Rewrite suggestion */}
              {feedback.rewriteSuggestion && (
                <div className="bg-blue-50 rounded-xl p-3 border border-blue-200">
                  <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-1.5">💬 Try saying this instead</p>
                  <p className="text-xs text-blue-900 leading-relaxed italic">"{feedback.rewriteSuggestion}"</p>
                </div>
              )}

              {/* Coach note */}
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 mt-1">
                <p className="text-xs font-bold text-gray-500 mb-1.5 flex items-center gap-1.5">
                  <span>💡</span> Coach's Note
                </p>
                <p className="text-sm text-gray-700 leading-relaxed">{feedback.feedback}</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Step 3: Model Answer — only available once this question's feedback is done ── */}
        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">✨</span>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Model Answer</p>
            {(pending || isAnalysing) && (
              <span className="ml-auto text-[11px] text-gray-400 italic">Available after analysis</span>
            )}
          </div>

          {/* Show button only once feedback is done (either success or fail) */}
          {!pending && !isAnalysing && (
            <>
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
                    Generating model answer…
                  </>
                ) : sampleVisible ? (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                    Hide Model Answer
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Show Model Answer
                  </>
                )}
              </button>

              {sampleError && (
                <p className="text-xs text-red-500 mt-2 text-center">{sampleError}</p>
              )}

              {sampleVisible && sampleAnswer && (
                <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">How a strong answer sounds</span>
                    <span className="ml-auto text-[10px] text-emerald-500 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">AI generated</span>
                  </div>
                  <p className="text-sm text-emerald-900 leading-relaxed">{sampleAnswer}</p>
                  <p className="text-[10px] text-emerald-600 mt-3 border-t border-emerald-100 pt-2">
                    AI generated · based on your profile details
                  </p>
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}
