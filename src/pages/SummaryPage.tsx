import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInterviewStore } from '../store/interviewStore';
import { SummaryCard } from '../components/SummaryCard';
import { INTERVIEW_TYPE_LABELS } from '../types';
import type { AIFeedback } from '../types';
import { getAIFeedback, getOverallReview } from '../services/awsApi';
import type { OverallReview } from '../services/awsApi';
import { sessionsApi } from '../services/api';

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : '#ef4444';
  return (
    <svg width={size} height={size} className="flex-shrink-0">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={8} />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={8}
        strokeDasharray={`${fill} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dasharray 1s ease' }}
      />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle"
        fontSize={size * 0.22} fontWeight="800" fill={color}>
        {score}
      </text>
    </svg>
  );
}

const READINESS_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  'Ready to Apply':               { color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
  'Almost There':                 { color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  'Needs More Practice':          { color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  'Significant Preparation Needed': { color: 'text-red-700', bg: 'bg-red-50',    border: 'border-red-200' },
};

export function SummaryPage() {
  const navigate = useNavigate();
  const { completedAnswers, totalElapsed, selectedType, reset, updateSessionScore } = useInterviewStore();

  // Per-question AI feedback — fetched in parallel
  const [feedbacks, setFeedbacks] = useState<(AIFeedback | null)[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(true);

  // Overall review
  const [overallReview, setOverallReview] = useState<OverallReview | null>(null);
  const [overallLoading, setOverallLoading] = useState(true);
  const [overallError, setOverallError] = useState('');

  const fetchOverallReview = useCallback(() => {
    setOverallError('');
    setOverallLoading(true);
    const qaList = completedAnswers.map(qa => ({
      question: qa.question.question,
      answer: qa.transcript,
    }));
    getOverallReview(qaList, INTERVIEW_TYPE_LABELS[selectedType])
      .then(r => { setOverallReview(r); setOverallLoading(false); })
      .catch(err => {
        setOverallError(err instanceof Error ? err.message : 'Could not generate overall review.');
        setOverallLoading(false);
      });
  }, [completedAnswers, selectedType]);

  const backendSavedRef = useRef(false);

  useEffect(() => {
    if (!completedAnswers.length) return;

    // Fire per-question feedbacks in batches of 3 to avoid rate limits, overall review in parallel
    setFeedbackLoading(true);
    fetchOverallReview();

    const runBatched = async () => {
      const results: (AIFeedback | null)[] = [];
      const BATCH = 3;
      for (let i = 0; i < completedAnswers.length; i += BATCH) {
        const slice = completedAnswers.slice(i, i + BATCH);
        const batch = await Promise.all(slice.map(qa =>
          qa.feedback
            ? Promise.resolve(qa.feedback as AIFeedback)
            : getAIFeedback(qa.question.question, qa.transcript).catch(() => null)
        ));
        results.push(...batch);
        // small gap between batches
        if (i + BATCH < completedAnswers.length) await new Promise(r => setTimeout(r, 1000));
      }
      return results;
    };

    runBatched().then(results => {
      setFeedbacks(results);
      setFeedbackLoading(false);
      updateSessionScore(results);

      // Save session to backend once (fire-and-forget)
      if (!backendSavedRef.current) {
        backendSavedRef.current = true;
        const scored = results.filter(Boolean);
        const overallScore = scored.length
          ? Math.round(scored.reduce((sum, f) => sum + (f!.grammarScore + f!.confidenceScore + f!.relevanceScore) / 3, 0) / scored.length)
          : 0;
        sessionsApi.save({
          visa_type: INTERVIEW_TYPE_LABELS[selectedType],
          answers: completedAnswers.map((qa, i) => ({
            question: qa.question.question,
            transcript: qa.transcript,
            feedback: results[i] ?? null,
          })),
          overall_score: overallScore,
          elapsed: totalElapsed,
        }).catch(() => {}); // silent — local store is source of truth
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!completedAnswers.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500 mb-4">No interview results found.</p>
          <button onClick={() => navigate('/')} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-500">
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  const handleTryAgain = () => { reset(); navigate('/'); };
  const answeredCount = completedAnswers.filter(a => a.transcript.trim().length > 0).length;

  const avgScore = feedbacks.filter(Boolean).length
    ? Math.round(
        feedbacks.filter(Boolean).reduce((sum, f) => {
          const fb = f!;
          return sum + (fb.grammarScore + fb.confidenceScore + fb.relevanceScore) / 3;
        }, 0) / feedbacks.filter(Boolean).length
      )
    : null;

  const readinessCfg = overallReview
    ? (READINESS_CONFIG[overallReview.readinessLevel] ?? READINESS_CONFIG['Needs More Practice'])
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-blue-700 rounded-lg flex items-center justify-center text-white font-bold text-sm">🛂</div>
            <span className="font-bold text-gray-900">PassMyVisa</span>
          </button>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="text-sm text-gray-500 hover:text-gray-700">← Home</button>
            <button
              onClick={handleTryAgain}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Try Again
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {/* Title */}
        <div className="mb-8 flex items-center gap-3">
          <span className="text-3xl">🎉</span>
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900">Interview Complete!</h1>
            <p className="text-gray-500 text-sm mt-1">
              {INTERVIEW_TYPE_LABELS[selectedType]} · {answeredCount}/{completedAnswers.length} answered · {formatTime(totalElapsed)}
            </p>
          </div>
        </div>

        {/* ── Overall AI Review ─────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-8">
          <div className="flex items-center gap-2 mb-5">
            <span className="text-xl">🤖</span>
            <h2 className="text-lg font-bold text-gray-900">Overall AI Review</h2>
            {(overallLoading || feedbackLoading) && (
              <span className="w-4 h-4 rounded-full border-2 border-blue-400 border-t-transparent animate-spin ml-1" />
            )}
          </div>

          {(overallLoading || feedbackLoading) && !overallReview && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 text-sm text-gray-400">
                <span className="w-4 h-4 rounded-full border-2 border-blue-400 border-t-transparent animate-spin flex-shrink-0" />
                {feedbackLoading ? 'Analysing all your answers…' : 'Generating overall review…'}
              </div>
              <div className="grid grid-cols-3 gap-3 mt-2">
                {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
              </div>
            </div>
          )}

          {overallError && (
            <div className="flex items-start gap-3">
              <p className="text-sm text-red-500 flex-1">{overallError}</p>
              <button
                onClick={fetchOverallReview}
                className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex-shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {overallReview && (
            <div className="flex flex-col gap-5">
              {/* Score + readiness */}
              <div className="flex items-center gap-6">
                <ScoreRing score={overallReview.overallScore} size={90} />
                <div className="flex-1">
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold mb-2 border ${readinessCfg?.bg} ${readinessCfg?.color} ${readinessCfg?.border}`}>
                    {overallReview.readinessLevel}
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{overallReview.summary}</p>
                </div>
              </div>

              {/* Strengths + improvements */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-green-700 uppercase tracking-wider mb-3">✅ Strengths</p>
                  <ul className="flex flex-col gap-2">
                    {overallReview.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-green-800">
                        <span className="w-4 h-4 rounded-full bg-green-200 text-green-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">{i+1}</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-orange-700 uppercase tracking-wider mb-3">⚠️ To Improve</p>
                  <ul className="flex flex-col gap-2">
                    {overallReview.improvements.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-orange-800">
                        <span className="w-4 h-4 rounded-full bg-orange-200 text-orange-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">{i+1}</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Recommendation */}
              <div className="bg-blue-700 rounded-xl p-4 text-white">
                <p className="text-xs font-bold text-blue-200 uppercase tracking-wider mb-1.5">🎯 Top Recommendation</p>
                <p className="text-sm leading-relaxed">{overallReview.recommendation}</p>
              </div>

              {/* Avg score from per-question feedback */}
              {avgScore !== null && (
                <div className="flex items-center gap-4 pt-3 border-t border-gray-100">
                  <div className="flex gap-3 flex-wrap">
                    {[
                      { label: 'Questions', value: completedAnswers.length, icon: '❓' },
                      { label: 'Answered', value: answeredCount, icon: '✅' },
                      { label: 'Avg Score', value: `${avgScore}/100`, icon: '📊' },
                      { label: 'Duration', value: formatTime(totalElapsed), icon: '⏱' },
                    ].map(stat => (
                      <div key={stat.label} className="flex items-center gap-1.5 bg-gray-50 rounded-xl px-3 py-2">
                        <span className="text-base">{stat.icon}</span>
                        <div>
                          <p className="text-xs font-bold text-gray-900">{stat.value}</p>
                          <p className="text-[10px] text-gray-400">{stat.label}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Per-question cards ───────────────────────── */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-5">Question-by-Question Feedback</h2>
          <div className="flex flex-col gap-4">
            {completedAnswers.map((qa, i) => (
              <SummaryCard
                key={qa.question.id}
                qa={qa}
                index={i}
                preloadedFeedback={feedbacks[i] ?? undefined}
                feedbackLoading={feedbackLoading}
                visaTypeLabel={INTERVIEW_TYPE_LABELS[selectedType]}
              />
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 text-center flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={handleTryAgain}
            className="px-8 py-4 bg-blue-700 hover:bg-blue-600 text-white font-bold text-base rounded-xl transition-all hover:shadow-lg hover:shadow-blue-200 inline-flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Practice Again
          </button>
          <button
            onClick={() => navigate('/progress')}
            className="px-8 py-4 bg-white border border-gray-200 text-gray-700 font-bold text-base rounded-xl transition-all hover:shadow-md inline-flex items-center gap-2"
          >
            📊 View My Progress
          </button>
        </div>
      </main>
    </div>
  );
}
