import { useEffect, useRef, useState } from 'react';
import type { Question } from '../types';
import { getSampleAnswer } from '../services/awsApi';
import { INTERVIEW_TYPE_LABELS } from '../types';
import { useInterviewStore } from '../store/interviewStore';
import { PREPARE_FIELDS } from '../pages/PreparePage';

interface Props {
  question: Question | null;
  questions: Question[];
  currentIndex: number;
  total: number;
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

export function QuestionPanel({
  question, questions, currentIndex, total,
  onRepeat, onNext, isLastQuestion, onEnd, isSpeaking,
}: Props) {
  const { selectedType, userDetailsByType, setUserDetails } = useInterviewStore();
  const visaLabel = INTERVIEW_TYPE_LABELS[selectedType];

  // Always use the globally-saved 'visa' details (set on the prepare page)
  const savedDetails = (userDetailsByType['visa'] ?? userDetailsByType[selectedType] ?? {}) as Record<string, string>;
  const hasSavedDetails = PREPARE_FIELDS.some(f => savedDetails[f.key]?.trim());

  const questionRef = useRef<HTMLDivElement>(null);

  // Sample answers keyed by question index
  const [sampleAnswers, setSampleAnswers] = useState<Record<number, string>>({});
  const [generating, setGenerating] = useState(false);
  const [showSamples, setShowSamples] = useState(false);
  const [sampleError, setSampleError] = useState('');

  // Details form state — pre-fill with saved values
  const [showForm, setShowForm] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, string>>(savedDetails);
  const [formSubmitted, setFormSubmitted] = useState(false);

  useEffect(() => {
    if (questionRef.current) {
      questionRef.current.classList.remove('question-enter');
      void questionRef.current.offsetWidth;
      questionRef.current.classList.add('question-enter');
    }
  }, [currentIndex]);

  if (!question) return null;

  const progress = ((currentIndex + 1) / total) * 100;
  const isFirst = currentIndex === 0;

  const startGenerating = (userContext: string) => {
    setGenerating(true);
    setShowSamples(true);
    setShowForm(false);
    setSampleError('');

    // Only generate the current question — avoids firing 17 parallel Groq calls
    getSampleAnswer(questions[currentIndex].question, visaLabel, userContext)
      .then(ans => setSampleAnswers(prev => ({ ...prev, [currentIndex]: ans })))
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Could not generate. Please try again.';
        setSampleError(msg);
        setShowSamples(false);
        setFormSubmitted(false);
      })
      .finally(() => setGenerating(false));
  };

  // Auto-fetch sample for new question when user has already submitted details
  useEffect(() => {
    if (formSubmitted && showSamples && sampleAnswers[currentIndex] === undefined && !generating) {
      const context = buildContextString(savedDetails);
      startGenerating(context);
    }
  }, [currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSampleButtonClick = () => {
    // Sample already generated for this question — toggle visibility
    if (formSubmitted && currentSample !== undefined) {
      setShowSamples(v => !v);
      return;
    }
    // Details submitted, but no sample yet for this question — fetch it
    if (formSubmitted) {
      const context = buildContextString(savedDetails);
      startGenerating(context);
      return;
    }
    // Saved details exist — skip form and generate immediately
    if (hasSavedDetails) {
      const context = buildContextString(savedDetails);
      setFormValues(savedDetails);
      setFormSubmitted(true);
      startGenerating(context);
      return;
    }
    // No saved details — show the form
    setShowForm(v => !v);
  };

  const handleFormSubmit = () => {
    // Persist details globally so the form is skipped next time
    setUserDetails('visa', formValues);
    const context = buildContextString(formValues);
    setFormSubmitted(true);
    startGenerating(context);
  };

  const currentSample = sampleAnswers[currentIndex];

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
              i < currentIndex ? 'bg-green-500' : i === currentIndex ? 'bg-blue-500' : 'bg-gray-700',
            ].join(' ')} />
          ))}
        </div>

        {/* Question card */}
        <div
          ref={questionRef}
          className="question-enter bg-gray-800/60 rounded-2xl border border-gray-700/60 p-5 flex flex-col gap-3"
        >
          <div className="flex items-start gap-2">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
              {currentIndex + 1}
            </div>
            <p className="text-white text-base leading-relaxed font-medium">{question.question}</p>
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-gray-700/50">
            {isSpeaking ? (
              <>
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
                <p className="text-blue-300 text-xs">Reading question — mic paused</p>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
                <p className="text-gray-400 text-xs">Mic is live — speak your answer</p>
              </>
            )}
          </div>
        </div>

        {/* Details form — shown before first generation */}
        {showForm && !formSubmitted && (
          <div className="bg-gray-800/70 rounded-2xl border border-gray-600/40 p-4 flex flex-col gap-3">
            <div>
              <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-0.5">Your Details</p>
              <p className="text-[11px] text-gray-400">
                {hasSavedDetails
                  ? 'Your saved details are pre-filled. Update anything that has changed.'
                  : 'Fill in your specifics so sample answers are personalised to you.'}
              </p>
            </div>
            {PREPARE_FIELDS.map(f => (
              <div key={f.key} className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-gray-300">{f.label}{f.required && <span className="text-emerald-400 ml-0.5">*</span>}</label>
                <input
                  type="text"
                  value={formValues[f.key] ?? ''}
                  onChange={e => setFormValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="px-3 py-2 rounded-xl bg-gray-900 border border-gray-600 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleFormSubmit}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl transition-colors"
              >
                Generate Sample Answers
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-xl transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Sample answer for current question */}
        {showSamples && (
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
                <button
                  onClick={() => {
                    setFormSubmitted(false);
                    setSampleAnswers({});
                    setShowSamples(false);
                    setShowForm(true);
                  }}
                  className="ml-auto text-[11px] text-gray-500 hover:text-emerald-400 transition-colors"
                >
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
      </div>

      {/* ── Fixed bottom actions ───────────────────────── */}
      <div className="flex flex-col gap-2 pt-3 border-t border-gray-800">

        {/* Sample answer error */}
        {sampleError && (
          <div className="bg-red-900/30 border border-red-700/40 rounded-xl px-4 py-3 text-xs text-red-300 leading-relaxed">
            ⚠️ {sampleError}
          </div>
        )}

        {/* Sample answers button */}
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
            <>
              <span className="w-4 h-4 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
              Generating…
            </>
          ) : (showSamples || showForm) && formSubmitted ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
              {showSamples ? 'Hide Sample Answer' : 'Show Sample Answer'}
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Show Sample Answer
            </>
          )}
        </button>

        {/* Primary action */}
        {isLastQuestion ? (
          <button
            onClick={onEnd}
            disabled={isSpeaking}
            className="w-full py-4 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] text-white font-bold text-base rounded-xl transition-all shadow-lg shadow-green-900/30 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            Finish Interview &amp; Get Feedback
          </button>
        ) : (
          <button
            onClick={onNext}
            disabled={isSpeaking}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] text-white font-bold text-base rounded-xl transition-all shadow-md shadow-blue-900/30 flex items-center justify-center gap-2"
          >
            Next Question
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
        )}

        {/* Secondary row */}
        <div className="flex items-center gap-2">
          <button
            onClick={onRepeat}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 active:scale-[0.97] text-gray-200 text-sm font-medium rounded-xl transition-all flex-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53L6.75 15.75H4.5a1.5 1.5 0 01-1.5-1.5v-4.5a1.5 1.5 0 011.5-1.5h2.25z" />
            </svg>
            Hear again
          </button>
          {!isFirst && !isLastQuestion && (
            <button
              onClick={onEnd}
              className="px-4 py-2.5 bg-gray-800 hover:bg-red-900/40 text-gray-500 hover:text-red-400 text-sm font-medium rounded-xl transition-all border border-gray-700 hover:border-red-700"
            >
              End early
            </button>
          )}
        </div>

        <p className="text-center text-[11px] text-gray-600">{Math.round(progress)}% complete</p>
      </div>
    </div>
  );
}
