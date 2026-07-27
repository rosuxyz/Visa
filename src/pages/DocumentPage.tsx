import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInterviewStore } from '../store/interviewStore';
import { extractFromFile } from '../services/documentParser';
import {
  generateQuestionsFromText,
  generateQuestionsFromImages,
  extractQuestionsFromText,
  extractQuestionsFromImages,
} from '../services/awsApi';
import type { Question } from '../types';

type Mode = 'generate' | 'import';
type UploadState = 'idle' | 'extracting' | 'generating' | 'done' | 'error';

const ACCEPTED_TYPES = [
  { label: 'PDF', icon: '📕', ext: '.pdf' },
  { label: 'Word', icon: '📘', ext: '.docx / .doc' },
  { label: 'Image', icon: '🖼️', ext: '.jpg / .png' },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function DocumentPage() {
  const navigate = useNavigate();
  const {
    setCustomQuestions,
    setSelectedType,
    saveQuestionSet,
    deleteQuestionSet,
    savedQuestionSets: _savedSets,
  } = useInterviewStore();
  const savedQuestionSets = _savedSets ?? [];

  const [mode, setMode] = useState<Mode>('generate');

  // Upload state — shared between both modes
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<UploadState>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Save dialog
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');

  const processFile = useCallback(async (f: File, currentMode: Mode) => {
    setFile(f);
    setState('extracting');
    setError('');
    setStatusMsg('Reading your document…');
    setQuestions([]);

    try {
      const result = await extractFromFile(f);

      const verb = currentMode === 'import' ? 'Importing questions from document…' : 'Generating personalised interview questions…';
      setStatusMsg(verb);
      setState('generating');

      let qs: Question[];

      if (currentMode === 'import') {
        qs = result.type === 'text'
          ? await extractQuestionsFromText(result.text, f.name)
          : await extractQuestionsFromImages(result.images, f.name);
      } else {
        qs = result.type === 'text'
          ? await generateQuestionsFromText(result.text, f.name)
          : await generateQuestionsFromImages(result.images, f.name);
      }

      if (!qs.length) throw new Error('No questions could be found in this document. Make sure it contains question text.');
      setQuestions(qs);
      setState('done');
      setStatusMsg('');
      // Auto-save to library immediately so questions are never lost
      const autoName = f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
      setSaveName(autoName);
      saveQuestionSet(autoName, qs, currentMode === 'import' ? 'imported' : 'generated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setState('error');
      setStatusMsg('');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) processFile(f, mode);
  }, [processFile, mode]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f, mode);
  };

  const handleStartInterview = () => {
    setCustomQuestions(questions);
    setSelectedType('document-custom');
    navigate('/interview');
  };

  const handleSaveSet = () => {
    if (!saveName.trim() || !questions.length) return;
    saveQuestionSet(saveName.trim(), questions, mode === 'import' ? 'imported' : 'generated');
    setShowSaveDialog(false);
  };

  const handleLoadSet = (setId: string) => {
    const set = savedQuestionSets.find(s => s.id === setId);
    if (!set) return;
    setCustomQuestions(set.questions);
    setSelectedType('document-custom');
    navigate('/interview');
  };

  const handleReset = () => {
    setFile(null);
    setState('idle');
    setQuestions([]);
    setError('');
    setStatusMsg('');
    setShowSaveDialog(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const isProcessing = state === 'extracting' || state === 'generating';

  const modeConfig = {
    generate: {
      badge: '🤖 AI Question Generator',
      badgeBg: 'bg-purple-100 text-purple-700',
      title: 'Generate Questions from Your Document',
      descBefore: 'Upload any visa-related document. AI reads it and generates ',
      descBold: 'personalised interview questions',
      descAfter: ' based on its specific details.',
      uploadLabel: 'Drop your visa document here',
      generatingLabel: 'Generating questions…',
      successLabel: 'questions generated!',
      successDesc: 'AI-generated based on your document',
      examples: ['📋 Visa offer letter', '🏦 Bank statement', '🎓 CAS letter', '💼 Offer letter', '🏠 Tenancy agreement'],
    },
    import: {
      badge: '📥 Import Questions Directly',
      badgeBg: 'bg-blue-100 text-blue-700',
      title: 'Import Questions from a PDF',
      descBefore: 'Upload a PDF that ',
      descBold: 'already contains interview questions',
      descAfter: '. They will be imported exactly as written — no AI generation.',
      uploadLabel: 'Drop your questions PDF here',
      generatingLabel: 'Importing questions…',
      successLabel: 'questions imported!',
      successDesc: 'Imported directly from your document',
      examples: ['📝 Question bank PDF', '📋 Practice question list', '🎓 Mock interview sheet', '📄 Tutor question handout'],
    },
  };

  const cfg = modeConfig[mode];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 flex flex-col">

      {/* ── Header ─────────────────────────────────────── */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-5 h-16 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
          >
            <div className="w-9 h-9 bg-blue-700 rounded-xl flex items-center justify-center text-lg">🛂</div>
            <div>
              <p className="font-extrabold text-gray-900 text-sm leading-none">PassMyVisa</p>
              <p className="text-[11px] text-gray-400 mt-0.5 leading-none hidden sm:block">Document Practice</p>
            </div>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/progress')}
              className="px-3 py-2 text-sm text-gray-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors font-medium"
            >
              📊 Progress
            </button>
            <button
              onClick={() => navigate('/')}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              ← Back
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-5 py-8">

        {/* ── Mode tabs ──────────────────────────────────── */}
        <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl mb-7">
          {([
            { key: 'generate', icon: '🤖', label: 'Generate from Document' },
            { key: 'import',   icon: '📥', label: 'Import Questions from PDF' },
          ] as { key: Mode; icon: string; label: string }[]).map(tab => (
            <button
              key={tab.key}
              onClick={() => { setMode(tab.key); handleReset(); }}
              className={[
                'flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm transition-all',
                mode === tab.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700',
              ].join(' ')}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ── Title ──────────────────────────────────────── */}
        <div className="mb-6 text-center">
          <div className={`inline-flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-full mb-4 ${cfg.badgeBg}`}>
            {cfg.badge}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-3">
            {cfg.title}
          </h1>
          <p className="text-gray-500 max-w-xl mx-auto leading-relaxed text-sm sm:text-base">
            {cfg.descBefore}<strong className="text-gray-700">{cfg.descBold}</strong>{cfg.descAfter}
          </p>
        </div>

        {/* ── Upload zone ────────────────────────────────── */}
        {state !== 'done' && (
          <div
            className={[
              'relative border-2 border-dashed rounded-2xl transition-all',
              isProcessing
                ? 'border-blue-400 bg-blue-50/50 cursor-default'
                : dragOver
                  ? 'border-purple-500 bg-purple-50 scale-[1.01]'
                  : state === 'error'
                    ? 'border-red-300 bg-red-50/40 cursor-pointer hover:border-red-400'
                    : 'border-gray-300 bg-white cursor-pointer hover:border-purple-400 hover:bg-purple-50/30',
            ].join(' ')}
            onDragOver={(e) => { if (!isProcessing) { e.preventDefault(); setDragOver(true); } }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !isProcessing && inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.webp"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Normal / drag-over state */}
            {!isProcessing && state !== 'error' && (
              <div className="p-10 text-center">
                <div className="text-5xl mb-4">{dragOver ? '📥' : mode === 'import' ? '📥' : '📂'}</div>
                <p className="text-lg font-bold text-gray-800 mb-1">
                  {dragOver ? 'Drop to analyse' : cfg.uploadLabel}
                </p>
                <p className="text-sm text-gray-400 mb-6">or click to browse your files</p>

                <div className="flex justify-center gap-3 mb-6">
                  {ACCEPTED_TYPES.map(t => (
                    <div key={t.label} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-full text-xs font-medium text-gray-600">
                      <span>{t.icon}</span>
                      <span>{t.label}</span>
                      <span className="text-gray-400">{t.ext}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap justify-center gap-2">
                  {cfg.examples.map(d => (
                    <span key={d} className="px-3 py-1 bg-purple-50 text-purple-600 text-xs rounded-full border border-purple-100">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Error state */}
            {!isProcessing && state === 'error' && (
              <div className="p-8 text-center">
                <div className="text-5xl mb-4">⚠️</div>
                <p className="text-base font-bold text-red-700 mb-2">Upload Failed</p>
                <p className="text-sm text-red-600 max-w-xs mx-auto mb-6 leading-relaxed">{error}</p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleReset(); }}
                    className="px-5 py-2.5 bg-white border border-gray-300 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
                    className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-xl transition-colors"
                  >
                    Try another file
                  </button>
                </div>
              </div>
            )}

            {/* Processing state */}
            {isProcessing && (
              <div className="p-10 text-center">
                <div className="flex items-center justify-center gap-0 mb-6">
                  {[
                    { label: 'Reading',    active: state === 'extracting', done: state === 'generating' },
                    { label: '',           divider: true },
                    { label: mode === 'import' ? 'Importing' : 'Generating', active: state === 'generating', done: false },
                  ].map((step, i) =>
                    (step as { divider?: boolean }).divider ? (
                      <div key={i} className="w-8 h-px bg-gray-300 mx-1" />
                    ) : (
                      <div key={i} className={[
                        'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all',
                        step.done ? 'bg-green-100 text-green-700' : step.active ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400',
                      ].join(' ')}>
                        {step.done
                          ? <span className="text-green-600">✓</span>
                          : step.active
                            ? <span className="w-3.5 h-3.5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin inline-block" />
                            : null
                        }
                        {step.label}
                      </div>
                    )
                  )}
                </div>
                <p className="font-semibold text-gray-800 mb-1">{statusMsg}</p>
                {file && (
                  <p className="text-xs text-gray-400 bg-gray-100 inline-block px-3 py-1 rounded-full mt-2">
                    {file.name} · {(file.size / 1024).toFixed(0)} KB
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-4">This usually takes 5–15 seconds…</p>
              </div>
            )}
          </div>
        )}

        {/* ── Results ────────────────────────────────────── */}
        {state === 'done' && questions.length > 0 && (
          <div>
            {/* Success banner */}
            <div className="bg-green-50 border border-green-200 rounded-2xl p-5 flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">✅</div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-green-800 text-base">{questions.length} {cfg.successLabel}</p>
                <p className="text-sm text-green-600 mt-0.5">
                  {cfg.successDesc} · <span className="font-medium">{file?.name}</span>
                </p>
              </div>
              <button
                onClick={handleReset}
                className="flex-shrink-0 text-xs text-green-700 hover:text-green-900 underline"
              >
                Upload different file
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 mb-4">
              <button
                onClick={handleStartInterview}
                className="flex-1 py-4 bg-blue-700 hover:bg-blue-600 active:scale-[0.99] text-white font-bold text-base rounded-2xl transition-all shadow-lg hover:shadow-blue-200 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                </svg>
                Start Practice Interview
              </button>
              <button
                onClick={() => setShowSaveDialog(true)}
                className="px-5 py-4 bg-white border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 text-gray-700 font-semibold text-sm rounded-2xl transition-all flex items-center gap-2"
              >
                💾 Save for Later
              </button>
            </div>
            <p className="text-xs text-center text-gray-400 mb-5">Camera + microphone will be requested on the next screen.</p>

            {/* Save dialog */}
            {showSaveDialog && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-5">
                <p className="font-bold text-blue-900 text-sm mb-3">💾 Save this question set</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={saveName}
                    onChange={e => setSaveName(e.target.value)}
                    placeholder="Name this question set…"
                    className="flex-1 px-3 py-2.5 rounded-xl border border-blue-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    onKeyDown={e => e.key === 'Enter' && handleSaveSet()}
                  />
                  <button
                    onClick={handleSaveSet}
                    disabled={!saveName.trim()}
                    className="px-5 py-2.5 bg-blue-700 disabled:bg-gray-300 hover:bg-blue-600 text-white text-sm font-bold rounded-xl transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setShowSaveDialog(false)}
                    className="px-4 py-2.5 bg-white border border-gray-200 text-gray-500 text-sm rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Questions list */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <p className="font-bold text-gray-900 text-sm">
                  {mode === 'import' ? 'Imported Questions' : 'Your Personalised Questions'}
                </p>
                <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2.5 py-1 rounded-full">
                  {questions.length} questions
                </span>
              </div>
              <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                {questions.map((q, i) => (
                  <div key={q.id} className="flex gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                    <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="inline-block text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full mb-1.5">
                        {q.category}
                      </span>
                      <p className="text-sm text-gray-800 leading-relaxed">{q.question}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Saved question sets ────────────────────────── */}
        {savedQuestionSets.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-800">💾 Saved Question Sets</h2>
              <span className="text-xs text-gray-400">{savedQuestionSets.length} saved</span>
            </div>
            <div className="flex flex-col gap-3">
              {savedQuestionSets.map(s => (
                <div key={s.id} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-lg flex-shrink-0">
                    {s.source === 'imported' ? '📥' : '🤖'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{s.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {s.questions.length} questions · {s.source === 'imported' ? 'Imported' : 'AI-generated'} · {formatDate(s.savedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleLoadSet(s.id)}
                      className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold rounded-xl transition-colors"
                    >
                      Practice
                    </button>
                    <button
                      onClick={() => deleteQuestionSet(s.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Info tiles (idle only) ──────────────────────── */}
        {state === 'idle' && savedQuestionSets.length === 0 && (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(mode === 'generate' ? [
              { icon: '🔒', title: 'Processed Locally', desc: 'PDF and Word text is extracted in your browser. Only the text content is sent to AI.' },
              { icon: '🎯', title: 'Hyper-Personalised', desc: 'AI reads your specific names, dates, figures, and institutions to craft targeted questions.' },
              { icon: '🛂', title: 'UKVI-Style', desc: 'Questions mirror the style and depth of real UK Entry Clearance Officer interviews.' },
            ] : [
              { icon: '📋', title: 'Exact Import', desc: 'Questions are extracted verbatim from your PDF — nothing is added, changed, or paraphrased.' },
              { icon: '💾', title: 'Save for Later', desc: 'After importing, save the question set so you can practice it again any time.' },
              { icon: '🔢', title: 'Up to 50 Questions', desc: 'Import question lists of up to 50 items from any PDF, Word document, or image.' },
            ]).map(tip => (
              <div key={tip.title} className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="text-2xl mb-2">{tip.icon}</div>
                <p className="font-bold text-gray-800 text-sm mb-1">{tip.title}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{tip.desc}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
