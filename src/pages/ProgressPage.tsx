import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInterviewStore } from '../store/interviewStore';
import { INTERVIEW_TYPE_LABELS } from '../types';
import type { SessionRecord } from '../types';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function scoreColor(score: number): string {
  if (score >= 80) return '#16a34a';
  if (score >= 60) return '#ca8a04';
  return '#dc2626';
}

function scoreBg(score: number): string {
  if (score >= 80) return 'bg-green-100 text-green-700';
  if (score >= 60) return 'bg-yellow-100 text-yellow-700';
  return 'bg-red-100 text-red-700';
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Strong';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Needs Work';
}

function MiniSparkline({ sessions }: { sessions: SessionRecord[] }) {
  if (sessions.length < 2) return null;
  const scores = sessions.slice().reverse().map(s => s.overallScore);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  const W = 120, H = 36, PAD = 4;
  const pts = scores.map((s, i) => {
    const x = PAD + (i / (scores.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((s - min) / range) * (H - PAD * 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={W} height={H} className="block">
      <polyline points={pts} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round" />
      {scores.map((s, i) => {
        const x = PAD + (i / (scores.length - 1)) * (W - PAD * 2);
        const y = H - PAD - ((s - min) / range) * (H - PAD * 2);
        return <circle key={i} cx={x} cy={y} r="3" fill="#3b82f6" />;
      })}
    </svg>
  );
}

function SessionCard({ session, rank }: { session: SessionRecord; rank: number }) {
  const [open, setOpen] = useState(false);
  const answered = session.answers.filter(a => a.transcript.trim()).length;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="w-9 h-9 rounded-full bg-blue-700 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
          #{rank}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {INTERVIEW_TYPE_LABELS[session.interviewType] ?? session.interviewType}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {formatDate(session.date)} · {answered}/{session.answers.length} answered · {formatTime(session.totalElapsed)}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${scoreBg(session.overallScore)}`}>
            {session.overallScore > 0 ? `${session.overallScore}/100` : 'No score'}
          </span>
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-5 pb-5">
          <div className="mt-4 space-y-4">
            {session.answers.map((qa, i) => {
              const fb = qa.feedback;
              const avg = fb ? Math.round((fb.grammarScore + fb.confidenceScore + fb.relevanceScore) / 3) : null;
              return (
                <div key={i} className="text-sm">
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 text-xs leading-snug">{qa.question.question}</p>
                      {qa.transcript ? (
                        <p className="text-gray-500 text-xs mt-1 italic leading-relaxed line-clamp-2">"{qa.transcript}"</p>
                      ) : (
                        <p className="text-gray-400 text-xs mt-1 italic">No answer recorded</p>
                      )}
                      {fb && (
                        <div className="mt-2 flex items-center gap-3 flex-wrap">
                          {[
                            { label: 'Grammar', score: fb.grammarScore },
                            { label: 'Confidence', score: fb.confidenceScore },
                            { label: 'Relevance', score: fb.relevanceScore },
                          ].map(s => (
                            <span key={s.label} className="flex items-center gap-1 text-xs text-gray-500">
                              <span className="font-semibold" style={{ color: scoreColor(s.score) }}>{s.score}</span>
                              <span>{s.label}</span>
                            </span>
                          ))}
                          {avg !== null && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${scoreBg(avg)}`}>
                              {scoreLabel(avg)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function ProgressPage() {
  const navigate = useNavigate();
  const { sessions, clearHistory } = useInterviewStore();

  const [showConfirmClear, setShowConfirmClear] = useState(false);

  if (sessions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col">
        <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
            >
              <div className="w-8 h-8 bg-blue-700 rounded-lg flex items-center justify-center text-white font-bold text-sm">🛂</div>
              <span className="font-bold text-gray-900">PassMyVisa</span>
            </button>
            <button onClick={() => navigate('/')} className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
              ← Back
            </button>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="text-center">
            <div className="text-6xl mb-4">📊</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No Sessions Yet</h2>
            <p className="text-gray-500 mb-6">Complete your first mock interview to start tracking your progress.</p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-blue-700 text-white font-semibold rounded-xl hover:bg-blue-600 transition-colors"
            >
              Start First Interview
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Stats ────────────────────────────────────────────────────────────────
  const totalSessions = sessions.length;
  const scoredSessions = sessions.filter(s => s.overallScore > 0);
  const avgScore = scoredSessions.length
    ? Math.round(scoredSessions.reduce((sum, s) => sum + s.overallScore, 0) / scoredSessions.length)
    : 0;
  const bestScore = scoredSessions.length
    ? Math.max(...scoredSessions.map(s => s.overallScore))
    : 0;
  const totalTime = sessions.reduce((sum, s) => sum + s.totalElapsed, 0);
  const totalAnswered = sessions.reduce((sum, s) =>
    sum + s.answers.filter(a => a.transcript.trim()).length, 0);

  // Trend: last 5 sessions average vs previous 5
  const last5 = scoredSessions.slice(0, 5);
  const prev5 = scoredSessions.slice(5, 10);
  const last5Avg = last5.length ? Math.round(last5.reduce((s, r) => s + r.overallScore, 0) / last5.length) : 0;
  const prev5Avg = prev5.length ? Math.round(prev5.reduce((s, r) => s + r.overallScore, 0) / prev5.length) : 0;
  const trend = prev5Avg > 0 ? last5Avg - prev5Avg : null;

  // Per-category averages across all sessions
  const categoryScores: Record<string, number[]> = {};
  sessions.forEach(session => {
    session.answers.forEach(qa => {
      if (!qa.feedback) return;
      const cat = qa.question.category;
      const avg = (qa.feedback.grammarScore + qa.feedback.confidenceScore + qa.feedback.relevanceScore) / 3;
      if (!categoryScores[cat]) categoryScores[cat] = [];
      categoryScores[cat].push(avg);
    });
  });

  const categoryAvgs = Object.entries(categoryScores)
    .map(([cat, scores]) => ({ cat, avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) }))
    .sort((a, b) => a.avg - b.avg);

  const weakest = categoryAvgs.slice(0, 3);
  const strongest = categoryAvgs.slice(-3).reverse();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-700 rounded-lg flex items-center justify-center text-white font-bold text-sm">🛂</div>
            <span className="font-bold text-gray-900">PassMyVisa</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
              ← Back
            </button>
            <button
              onClick={() => navigate('/interview')}
              className="px-4 py-2 bg-blue-700 text-white text-sm font-semibold rounded-lg hover:bg-blue-600 transition-colors"
            >
              Practice Now
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-10">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900">My Progress</h1>
          <p className="text-gray-500 mt-1">Track your UK visa interview performance over time.</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Sessions', value: totalSessions, icon: '🎯', suffix: '' },
            { label: 'Avg Score', value: avgScore, icon: '📊', suffix: '/100' },
            { label: 'Best Score', value: bestScore, icon: '🏆', suffix: '/100' },
            { label: 'Time Practised', value: formatTime(totalTime), icon: '⏱', suffix: '' },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm text-center">
              <div className="text-2xl mb-1.5">{stat.icon}</div>
              <div className="text-2xl font-extrabold text-gray-900">{stat.value}{stat.suffix}</div>
              <div className="text-xs text-gray-400 mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Trend + sparkline */}
        {scoredSessions.length >= 2 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-8 flex items-center gap-6">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-500 mb-1">Score Trend</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-gray-900">{last5Avg}/100</span>
                {trend !== null && (
                  <span className={`text-sm font-semibold ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)} pts
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Average across last {last5.length} session{last5.length !== 1 ? 's' : ''}.
                {trend !== null && ` ${trend >= 0 ? 'Improving' : 'Declining'} vs previous ${prev5.length}.`}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Total questions answered: <span className="font-semibold text-gray-700">{totalAnswered}</span>
              </p>
            </div>
            <div className="flex-shrink-0">
              <MiniSparkline sessions={scoredSessions} />
            </div>
          </div>
        )}

        {/* Strengths / Weaknesses */}
        {categoryAvgs.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {/* Weakest areas */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <span>⚠️</span> Areas to Improve
              </h3>
              {weakest.map(c => (
                <div key={c.cat} className="flex items-center gap-3 mb-2.5">
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600 font-medium">{c.cat}</span>
                      <span className="font-semibold" style={{ color: scoreColor(c.avg) }}>{c.avg}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${c.avg}%`, background: scoreColor(c.avg) }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Strongest areas */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <span>💪</span> Your Strengths
              </h3>
              {strongest.map(c => (
                <div key={c.cat} className="flex items-center gap-3 mb-2.5">
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600 font-medium">{c.cat}</span>
                      <span className="font-semibold" style={{ color: scoreColor(c.avg) }}>{c.avg}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${c.avg}%`, background: scoreColor(c.avg) }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* UK Readiness Banner */}
        <div className="bg-gradient-to-r from-blue-700 to-blue-800 rounded-2xl p-6 mb-8 text-white">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">🛂</span>
            <h3 className="font-bold text-lg">UK Visa Interview Readiness</h3>
          </div>
          <div className="flex items-center gap-4">
            <div
              className="text-5xl font-extrabold"
              style={{ color: avgScore >= 70 ? '#4ade80' : avgScore >= 50 ? '#fbbf24' : '#f87171' }}
            >
              {avgScore}
            </div>
            <div>
              <p className="font-semibold text-white">
                {avgScore >= 80 ? 'Interview Ready 🎉' : avgScore >= 60 ? 'Almost Ready 📈' : 'Needs More Practice 💪'}
              </p>
              <p className="text-blue-200 text-sm mt-0.5">
                {avgScore >= 80
                  ? 'Your answers are clear, confident, and relevant. Keep it up!'
                  : avgScore >= 60
                  ? 'Good progress — focus on specificity and reducing filler words.'
                  : 'Keep practising with different visa types to build confidence.'}
              </p>
            </div>
          </div>
        </div>

        {/* Session history */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Session History</h2>
            {sessions.length > 0 && (
              <button
                onClick={() => setShowConfirmClear(true)}
                className="text-xs text-red-400 hover:text-red-600 transition-colors"
              >
                Clear history
              </button>
            )}
          </div>
          {showConfirmClear && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
              <p className="text-sm text-red-700 font-medium">Delete all {sessions.length} sessions permanently?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { clearHistory(); setShowConfirmClear(false); }}
                  className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-500 transition-colors"
                >
                  Delete All
                </button>
                <button
                  onClick={() => setShowConfirmClear(false)}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          <div className="flex flex-col gap-3">
            {sessions.map((session, i) => (
              <SessionCard key={session.id} session={session} rank={i + 1} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
