import { useEffect, useRef, useState } from 'react';
import type { Question, AIFeedback } from '../types';
import { getSampleAnswer, getAIFeedback } from '../services/awsApi';
import { INTERVIEW_TYPE_LABELS } from '../types';
import { useInterviewStore } from '../store/interviewStore';
import { PREPARE_FIELDS } from '../pages/PreparePage';

function BookmarkButton({ question }: { question: Question }) {
  const { addToRevision, revisionList } = useInterviewStore();
  const isAdded = revisionList.some(r => r.question.question === question.question);
  return (
    <button
      onClick={() => { if (!isAdded) addToRevision(question); }}
      title={isAdded ? 'Already in revision list' : 'Add to revision list'}
      className={[
        'flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all',
        isAdded
          ? 'bg-amber-100 text-amber-600 border border-amber-300 cursor-default'
          : 'bg-gray-700 text-gray-400 hover:bg-amber-900/40 hover:text-amber-400 border border-gray-600 hover:border-amber-700',
      ].join(' ')}
    >
      <svg className="w-3.5 h-3.5" fill={isAdded ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
      </svg>
    </button>
  );
}

interface Props {
  question: Question | null;
  questions: Question[];
  currentIndex: number;
  total: number;
  currentTranscript: string;
  onStopMic: () => void;
  onRetake: () => void;
  onRepeat: () => void;
  onNext: () => void;
  isLastQuestion: boolean;
  onEnd: () => void;
  isSpeaking: boolean;
}

function buildContextString(values: Record<string, string>): string {
  return PREPARE_FIELDS
    .filter(f => values[f.key]?.trim())
    .map(f => `${f.label}: ${values[f.key].trim()}`)
    .join('\n');
}

function ScoreBar({ label, score, color, icon }: { label: string; score: number; color: string; icon: string }) {
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!barRef.current) return;
    barRef.current.style.width = '0%';
    const id = setTimeout(() => { if (barRef.current) barRef.current.style.width = `${score}%`; }, 80);
    return () => clearTimeout(id);
  }, [score]);
  const scoreColor = score >= 80 ? 'text-green-400' : score >= 60 ? 'text-yellow-400' : 'text-red-400';
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm w-4 flex-shrink-0">{icon}</span>
      <div className="flex-1">
        <div className="flex justify-between text-[11px] mb-1">
          <span className="text-gray-400 font-medium">{label}</span>
          <span className={`font-bold tabular-nums ${scoreColor}`}>{score}/100</span>
        </div>
        <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div ref={barRef} className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ background: color, width: '0%' }} />
        </div>
      </div>
    </div>
  );
}

export function QuestionPanel({
  question, questions, currentIndex, total,
  currentTranscript, onStopMic, onRetake,
  onRepeat, onNext, isLastQuestion, onEnd, isSpeaking,
}: Props) {
  const { selectedType, userDetailsByType, setUserDetails } = useInterviewStore();
  const visaLabel = INTERVIEW_TYPE_LABELS[selectedType];
  const savedDetails = (userDetailsByType['visa'] ?? userDetailsByType[selectedType] ?? {}) as Record<string, string>;
  const hasSavedDetails = PREPARE_FIELDS.some(f => savedDetails[f.key]?.trim());

  const questionRef = useRef<HTMLDivElement>(null);

  // ── Review mode state ──────────────────────────────────────────
  const [reviewing, setReviewing] = useState(false);
  const [reviewTranscript, setReviewTranscript] = useState('');
  const [feedback, setFeedback] = useState<AIFeedback | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');

  // ── Sample answer state ────────────────────────────────────────
  const [sampleAnswers, setSampleAnswers] = useState<Record<number, string>>({});
  const [generating, setGenerating] = useState(false);
  const [showSamples, setShowSamples] = useState(false);
  const [sampleError, setSampleError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, string>>(savedDetails);
  const [formSubmitted, setFormSubmitted] = useState(false);

  // Reset review + sample when question changes
  useEffect(() => {
    setReviewing(false);
    setReviewTranscript('');
    setFeedback(null);
    setFeedbackLoading(false);
    setFeedbackError('');
    setShowSamples(false);
    setSampleError('');

    if (questionRef.current) {
      questionRef.current.classList.remove('question-enter');
      void questionRef.current.offsetWidth;
      questionRef.current.classList.add('question-enter');
    }
  }, [currentIndex]);

  if (!question) return null;

  const progress = ((currentIndex + 1) / total) * 100;
  const isFirst = currentIndex === 0;

  // ── Enter review mode ──────────────────────────────────────────
  const enterReview = () => {
    const captured = currentTranscript.trim();
    onStopMic();
    setReviewTranscript(captured);
    setReviewing(true);
    setFeedback(null);
    setFeedbackError('');
    setShowSamples(false);

    if (!captured) return;

    setFeedbackLoading(true);
    getAIFeedback(question.question, captured)
      .then(fb => setFeedback(fb))
      .catch(err => setFeedbackError(err instanceof Error ? err.message : 'Could not analyse answer.'))
      .finally(() => setFeedbackLoading(false));
  };

  // ── Re-take same question ──────────────────────────────────────
  const handleRetake = () => {
    setReviewing(false);
    setReviewTranscript('');
    setFeedback(null);
    setFeedbackLoading(false);
    setFeedbackError('');
    setShowSamples(false);
    setSampleError('');
    onRetake(); // resets transcript + restarts mic in parent
  };

  // ── Confirm and advance ────────────────────────────────────────
  const handleConfirm = () => {
    if (isLastQuestion) {
      onEnd();
    } else {
      onNext();
    }
  };

  // ── Sample answer helpers ──────────────────────────────────────
  const startGenerating = (userContext: string) => {
    setGenerating(true);
    setShowSamples(true);
    setShowForm(false);
    setSampleError('');
    getSampleAnswer(questions[currentIndex].question, visaLabel, userContext)
      .then(ans => setSampleAnswers(prev => ({ ...prev, [currentIndex]: ans })))
      .catch((err: unknown) => {
        setSampleError(err instanceof Error ? err.message : 'Could not generate. Try again.');
        setShowSamples(false);
        setFormSubmitted(false);
      })
      .finally(() => setGenerating(false));
  };

  useEffect(() => {
    if (formSubmitted && showSamples && sampleAnswers[currentIndex] === undefined && !generating) {
      startGenerating(buildContextString(savedDetails));
    }
  }, [currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSampleButtonClick = () => {
    const currentSample = sampleAnswers[currentIndex];
    if (formSubmitted && currentSample !== undefined) { setShowSamples(v => !v); return; }
    if (formSubmitted) { startGenerating(buildContextString(savedDetails)); return; }
    if (hasSavedDetails) {
      setFormValues(savedDetails);
      setFormSubmitted(true);
      startGenerating(buildContextString(savedDetails));
      return;
    }
    setShowForm(v => !v);
  };

  const currentSample = sampleAnswers[currentIndex];
  const coh = feedback?.coherenceScore ?? feedback?.relevanceScore ?? 0;
  const overall = feedback
    ? Math.round((feedback.grammarScore + feedback.confidenceScore + feedback.relevanceScore + coh) / 4)
    : null;

  return (
    <div className="flex flex-col h-full gap-0">

      {/* ── Scrollable content ─────────────────────────── */}
      <div className="flex-1 overflow-y-auto dark-scroll flex flex-col gap-3 pb-3 pr-1">

        {/* Progress header */}
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs font-bold text-blue-400 uppercase tracking-wider">
            Question {currentIndex + 1} <span className="text-gray-600 font-normal">of {total}</span>
          </p>
          <span className="text-[11px] font-semibold px-2.5 py-1 bg-gray-700/60 text-gray-300 rounded-full border border-gray-700">
            {question.category}
          </span>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1">
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} className={[
              'h-1.5 rounded-full flex-1 transition-all duration-500',
              i < currentIndex ? 'bg-green-500' : i === currentIndex ? (reviewing ? 'bg-yellow-500' : 'bg-blue-500') : 'bg-gray-700',
            ].join(' ')} />
          ))}
        </div>

        {/* Question card */}
        <div ref={questionRef}
          className="question-enter bg-gray-800/60 rounded-2xl border border-gray-700/60 p-5 flex flex-col gap-3">
          <div className="flex items-start gap-2">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
              {currentIndex + 1}
            </div>
            <p className="text-white text-base leading-relaxed font-medium flex-1">{question.question}</p>
            <BookmarkButton question={question} />
          </div>
          {!reviewing && (
            <div className="flex items-center gap-2 pt-2 border-t border-gray-700/50">
              {isSpeaking ? (
                <><span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
                  <p className="text-blue-300 text-xs">Reading question — mic paused</p></>
              ) : (
                <><div className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
                  <p className="text-gray-400 text-xs">Mic is live — speak your answer</p></>
              )}
            </div>
          )}
        </div>

        {/* ── REVIEW PANEL ──────────────────────────────── */}
        {reviewing && (
          <div className="flex flex-col gap-3">

            {/* Step 1 — Your answer */}
            <div className="bg-gray-800/70 rounded-2xl border border-gray-700/40 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-700/30 border-b border-gray-700/40">
                <span className="text-sm">🎤</span>
                <p className="text-xs font-bold text-gray-300 uppercase tracking-wider">Your Answer</p>
              </div>
              <div className="px-4 py-3">
                {reviewTranscript ? (
                  <p className="text-sm text-gray-200 leading-relaxed">{reviewTranscript}</p>
                ) : (
                  <p className="text-sm text-red-400 italic">No answer recorded for this question.</p>
                )}
              </div>
            </div>

            {/* Step 2 — AI Scores */}
            <div className="bg-gray-800/70 rounded-2xl border border-gray-700/40 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-700/30 border-b border-gray-700/40">
                <span className="text-sm">🤖</span>
                <p className="text-xs font-bold text-gray-300 uppercase tracking-wider">ECO Analysis</p>
                {feedbackLoading && (
                  <span className="ml-auto flex items-center gap-1.5 text-[11px] text-blue-400">
                    <span className="w-3 h-3 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                    Analysing…
                  </span>
                )}
                {feedback?.verdict && (
                  <span className={[
                    'ml-auto text-[11px] font-bold px-2.5 py-0.5 rounded-full border',
                    feedback.verdict === 'Pass'       ? 'bg-green-900/40 text-green-400 border-green-700/40' :
                    feedback.verdict === 'Borderline' ? 'bg-yellow-900/40 text-yellow-400 border-yellow-700/40' :
                                                        'bg-red-900/40 text-red-400 border-red-700/40',
                  ].join(' ')}>
                    {feedback.verdict === 'Pass' ? '✓ Pass' : feedback.verdict === 'Borderline' ? '⚠ Borderline' : '✗ Fail'}
                  </span>
                )}
                {overall !== null && !feedback?.verdict && (
                  <span className={[
                    'ml-auto text-xs font-bold px-2.5 py-0.5 rounded-full',
                    overall >= 80 ? 'bg-green-900/50 text-green-400' :
                    overall >= 60 ? 'bg-yellow-900/50 text-yellow-400' :
                    overall >= 40 ? 'bg-orange-900/50 text-orange-400' :
                                    'bg-red-900/50 text-red-400',
                  ].join(' ')}>
                    {overall}/100
                  </span>
                )}
              </div>

              <div className="px-4 py-3 flex flex-col gap-3">
                {feedbackLoading && !feedback && (
                  <div className="flex flex-col gap-2.5">
                    {[1,2,3,4].map(i => (
                      <div key={i} className="h-5 bg-gray-700/50 rounded-lg animate-pulse" style={{ width: `${65 + i * 8}%` }} />
                    ))}
                    <div className="h-12 bg-gray-700/30 rounded-xl animate-pulse mt-1" />
                  </div>
                )}

                {feedbackError && (
                  <p className="text-xs text-red-400">{feedbackError}</p>
                )}

                {!reviewTranscript && !feedbackLoading && (
                  <p className="text-xs text-gray-500 italic">No answer to score.</p>
                )}

                {feedback && (
                  <div className="flex flex-col gap-3">
                    {/* Score bars */}
                    <div className="flex flex-col gap-2">
                      <ScoreBar label="Clarity"    score={feedback.grammarScore}    color="#64748b" icon="💬" />
                      <ScoreBar label="Confidence" score={feedback.confidenceScore} color="#8b5cf6" icon="💪" />
                      <ScoreBar label="Relevance"  score={feedback.relevanceScore}  color="#22c55e" icon="🎯" />
                      <ScoreBar label="Coherence"  score={coh}                      color="#f59e0b" icon="🔗" />
                    </div>

                    {/* Strengths */}
                    {feedback.strengths && feedback.strengths.length > 0 && (
                      <div className="bg-green-900/20 border border-green-700/30 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-green-400 uppercase tracking-wider mb-1.5">✓ What worked</p>
                        {feedback.strengths.map((s, i) => (
                          <p key={i} className="text-xs text-green-300 leading-relaxed">{s}</p>
                        ))}
                      </div>
                    )}

                    {/* Weaknesses */}
                    {feedback.weaknesses && feedback.weaknesses.length > 0 && (
                      <div className="bg-red-900/20 border border-red-700/30 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1.5">✗ Fix this</p>
                        {feedback.weaknesses.map((w, i) => (
                          <p key={i} className="text-xs text-red-300 leading-relaxed">{w}</p>
                        ))}
                      </div>
                    )}

                    {/* Missed points */}
                    {feedback.missedPoints && feedback.missedPoints.length > 0 && (
                      <div className="bg-orange-900/20 border border-orange-700/30 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-orange-400 uppercase tracking-wider mb-1.5">⚠ Missing from your answer</p>
                        {feedback.missedPoints.map((m, i) => (
                          <p key={i} className="text-xs text-orange-300 leading-relaxed">{m}</p>
                        ))}
                      </div>
                    )}

                    {/* Rewrite suggestion */}
                    {feedback.rewriteSuggestion && (
                      <div className="bg-blue-900/20 border border-blue-700/30 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1.5">💬 Try saying this instead</p>
                        <p className="text-xs text-blue-200 leading-relaxed italic">"{feedback.rewriteSuggestion}"</p>
                      </div>
                    )}

                    {/* Overall coaching */}
                    <div className="bg-gray-700/30 border border-gray-600/30 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">💡 Coach's Note</p>
                      <p className="text-xs text-gray-300 leading-relaxed">{feedback.feedback}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Model answer (review mode) — AI-generated from user profile, no comparison */}
            {showSamples && (
              <div className="bg-gray-800/60 rounded-xl border border-emerald-700/30 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-900/20 border-b border-emerald-700/20">
                  <span className="text-emerald-400 text-sm">✨</span>
                  <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Model Answer</p>
                  <span className="ml-auto text-[10px] text-emerald-600 bg-emerald-900/40 px-2 py-0.5 rounded-full border border-emerald-700/30">
                    AI generated · based on your profile
                  </span>
                </div>
                <div className="px-4 py-3">
                  {currentSample !== undefined ? (
                    <p className="text-sm text-emerald-200 leading-relaxed">{currentSample}</p>
                  ) : (
                    <div className="h-8 flex items-center gap-1">
                      {[0,1,2].map(i => (
                        <span key={i} className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {sampleError && (
              <p className="text-xs text-red-400 px-1">{sampleError}</p>
            )}
          </div>
        )}

        {/* Sample answer — shown before review if user requests it */}
        {!reviewing && showSamples && (
          <div className="bg-gray-800/60 rounded-xl border border-emerald-700/30 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-900/20 border-b border-emerald-700/20">
              <span className="text-emerald-400 text-sm">✨</span>
              <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Sample Answer</p>
              {currentSample === undefined ? (
                <span className="ml-auto flex items-center gap-1.5 text-[11px] text-gray-400">
                  <span className="w-3 h-3 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
                  Generating…
                </span>
              ) : (
                <button onClick={() => { setFormSubmitted(false); setSampleAnswers({}); setShowSamples(false); setShowForm(true); }}
                  className="ml-auto text-[11px] text-gray-500 hover:text-emerald-400 transition-colors">
                  Edit details
                </button>
              )}
            </div>
            <div className="px-4 py-3">
              {currentSample !== undefined ? (
                <p className="text-sm text-emerald-200 leading-relaxed">{currentSample}</p>
              ) : (
                <div className="h-10 flex items-center">
                  <div className="flex gap-1">
                    {[0,1,2].map(i => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Details form (pre-review) */}
        {!reviewing && showForm && !formSubmitted && (
          <div className="bg-gray-800/70 rounded-2xl border border-gray-600/40 p-4 flex flex-col gap-3">
            <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Your Details</p>
            {PREPARE_FIELDS.map(f => (
              <div key={f.key} className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-gray-300">{f.label}{f.required && <span className="text-emerald-400 ml-0.5">*</span>}</label>
                <input type="text" value={formValues[f.key] ?? ''}
                  onChange={e => setFormValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="px-3 py-2 rounded-xl bg-gray-900 border border-gray-600 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <button onClick={() => { setUserDetails('visa', formValues); setFormSubmitted(true); startGenerating(buildContextString(formValues)); }}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl transition-colors">
                Generate Sample Answers
              </button>
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-xl transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Fixed bottom actions ───────────────────────── */}
      <div className="flex flex-col gap-2 pt-3 border-t border-gray-800">

        {!reviewing ? (
          <>
            {sampleError && (
              <div className="bg-red-900/30 border border-red-700/40 rounded-xl px-4 py-3 text-xs text-red-300">
                ⚠️ {sampleError}
              </div>
            )}

            {/* Sample answer button — only before review */}
            <button
              onClick={handleSampleButtonClick}
              disabled={generating}
              className={[
                'w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2',
                (showSamples || showForm)
                  ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-700/40 hover:bg-emerald-900/50'
                  : 'bg-gray-700/60 hover:bg-gray-700 text-gray-300 border border-gray-600/40',
                generating ? 'opacity-60 cursor-not-allowed' : '',
              ].join(' ')}
            >
              {generating ? (
                <><span className="w-4 h-4 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />Generating…</>
              ) : (showSamples || showForm) && formSubmitted ? (
                <>{showSamples ? '▲ Hide Sample Answer' : '▼ Show Sample Answer'}</>
              ) : (
                <>✨ Show Sample Answer</>
              )}
            </button>

            {/* Submit answer button */}
            <button
              onClick={enterReview}
              disabled={isSpeaking}
              className={[
                'w-full py-4 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] text-white font-bold text-base rounded-xl transition-all flex items-center justify-center gap-2',
                isLastQuestion
                  ? 'bg-green-600 hover:bg-green-500 shadow-lg shadow-green-900/30'
                  : 'bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-900/30',
              ].join(' ')}
            >
              {isLastQuestion ? (
                <><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>Submit &amp; Get Feedback</>
              ) : (
                <>Submit Answer
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg></>
              )}
            </button>

            {/* Secondary row */}
            <div className="flex items-center gap-2">
              <button onClick={onRepeat}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 active:scale-[0.97] text-gray-200 text-sm font-medium rounded-xl transition-all flex-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53L6.75 15.75H4.5a1.5 1.5 0 01-1.5-1.5v-4.5a1.5 1.5 0 011.5-1.5h2.25z" />
                </svg>
                Hear again
              </button>
              {!isFirst && !isLastQuestion && (
                <button onClick={onEnd}
                  className="px-4 py-2.5 bg-gray-800 hover:bg-red-900/40 text-gray-500 hover:text-red-400 text-sm font-medium rounded-xl transition-all border border-gray-700 hover:border-red-700">
                  End early
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Review mode actions */}

            {/* Model answer toggle */}
            <button
              onClick={handleSampleButtonClick}
              disabled={generating || feedbackLoading}
              className={[
                'w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2',
                showSamples
                  ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-700/40 hover:bg-emerald-900/50'
                  : 'bg-gray-700/60 hover:bg-gray-700 text-gray-300 border border-gray-600/40',
                (generating || feedbackLoading) ? 'opacity-60 cursor-not-allowed' : '',
              ].join(' ')}
            >
              {generating
                ? <><span className="w-4 h-4 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />Generating…</>
                : showSamples ? '▲ Hide Model Answer' : '✨ Show Model Answer'}
            </button>

            {/* Re-take + Continue row */}
            <div className="flex gap-2">
              {/* Re-take button */}
              <button
                onClick={handleRetake}
                className="flex items-center justify-center gap-2 px-4 py-3.5 bg-gray-700 hover:bg-amber-900/40 text-gray-300 hover:text-amber-300 text-sm font-semibold rounded-xl transition-all border border-gray-600 hover:border-amber-700/60 flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                Re-take
              </button>

              {/* Continue button */}
              <button
                onClick={handleConfirm}
                disabled={feedbackLoading}
                className={[
                  'flex-1 py-3.5 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2',
                  isLastQuestion
                    ? 'bg-green-600 hover:bg-green-500 shadow-lg shadow-green-900/30'
                    : 'bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-900/30',
                ].join(' ')}
              >
                {feedbackLoading ? (
                  <><span className="w-4 h-4 rounded-full border-2 border-white/50 border-t-white animate-spin" />Scoring…</>
                ) : isLastQuestion ? (
                  <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>Finish &amp; See Results</>
                ) : (
                  <>Next Question
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg></>
                )}
              </button>
            </div>
          </>
        )}

        <p className="text-center text-[11px] text-gray-600">{Math.round(progress)}% complete</p>
      </div>
    </div>
  );
}
