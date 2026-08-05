import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInterviewStore } from '../store/interviewStore';
import type { RevisionQuestion } from '../store/interviewStore';
import { getSampleAnswer } from '../services/awsApi';
import { INTERVIEW_TYPE_LABELS } from '../types';
import { PREPARE_FIELDS } from './PreparePage';

function buildContext(details: Record<string, string>) {
  return PREPARE_FIELDS
    .filter(f => details[f.key]?.trim())
    .map(f => `${f.label}: ${details[f.key].trim()}`)
    .join('\n');
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Purpose:      { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200' },
  Education:    { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  Finances:     { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200' },
  Sponsor:      { bg: 'bg-teal-50',   text: 'text-teal-700',   border: 'border-teal-200' },
  Accommodation:{ bg: 'bg-cyan-50',   text: 'text-cyan-700',   border: 'border-cyan-200' },
  Ties:         { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  'Future Plans':{ bg: 'bg-purple-50',text: 'text-purple-700', border: 'border-purple-200' },
  History:      { bg: 'bg-pink-50',   text: 'text-pink-700',   border: 'border-pink-200' },
  Credibility:  { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200' },
};
const DEFAULT_CAT = { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };

function RevisionCard({ item }: { item: RevisionQuestion }) {
  const navigate = useNavigate();
  const { removeFromRevision, updateRevisionNote, selectedType, userDetailsByType } = useInterviewStore();
  const savedDetails = (userDetailsByType['visa'] ?? {}) as Record<string, string>;

  const [note, setNote] = useState(item.note);
  const [editingNote, setEditingNote] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [modelAnswer, setModelAnswer] = useState('');
  const [modelLoading, setModelLoading] = useState(false);
  const [modelError, setModelError] = useState('');

  const cat = CATEGORY_COLORS[item.question.category] ?? DEFAULT_CAT;

  const saveNote = () => {
    updateRevisionNote(item.id, note);
    setEditingNote(false);
  };

  const loadModelAnswer = async () => {
    if (modelAnswer) { setExpanded(v => !v); return; }
    setModelLoading(true);
    setModelError('');
    try {
      const ctx = buildContext(savedDetails);
      const ans = await getSampleAnswer(item.question.question, INTERVIEW_TYPE_LABELS[selectedType], ctx);
      setModelAnswer(ans);
      setExpanded(true);
    } catch {
      setModelError('Could not generate. Try again.');
    } finally {
      setModelLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 px-5 py-4 bg-gray-50/60 border-b border-gray-100">
        <span className={`flex-shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full border mt-0.5 ${cat.bg} ${cat.text} ${cat.border}`}>
          {item.question.category}
        </span>
        <p className="flex-1 text-sm font-semibold text-gray-900 leading-snug">{item.question.question}</p>
        <button
          onClick={() => removeFromRevision(item.id)}
          className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
          title="Remove from revision"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="px-5 py-4 flex flex-col gap-3">
        {/* Session badge */}
        <p className="text-[10px] text-gray-400">
          Added in Session {item.sessionNum || 1} · {new Date(item.addedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>

        {/* Note */}
        {editingNote ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Write your own notes on how to answer this…"
              rows={3}
              className="w-full px-3 py-2 rounded-xl border border-amber-200 text-sm text-gray-800 resize-none focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-100 bg-amber-50/50"
            />
            <div className="flex gap-2">
              <button onClick={saveNote}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold rounded-lg transition-all">
                Save Note
              </button>
              <button onClick={() => { setNote(item.note); setEditingNote(false); }}
                className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-semibold rounded-lg transition-all">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => setEditingNote(true)}
            className="min-h-[40px] rounded-xl border border-dashed border-gray-200 px-3 py-2.5 cursor-text hover:border-amber-300 hover:bg-amber-50/30 transition-all"
          >
            {item.note ? (
              <p className="text-sm text-gray-700 leading-relaxed">{item.note}</p>
            ) : (
              <p className="text-sm text-gray-400 italic">Click to add your revision notes…</p>
            )}
          </div>
        )}

        {/* Model answer */}
        {modelError && <p className="text-xs text-red-500">{modelError}</p>}

        {expanded && modelAnswer && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1.5">
              ✨ Model Answer · AI generated from your profile
            </p>
            <p className="text-sm text-emerald-900 leading-relaxed">{modelAnswer}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={loadModelAnswer}
            disabled={modelLoading}
            className={[
              'flex-1 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5',
              expanded
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100',
            ].join(' ')}
          >
            {modelLoading
              ? <><span className="w-3.5 h-3.5 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />Generating…</>
              : expanded ? '▲ Hide answer' : '✨ Show model answer'}
          </button>
          <button
            onClick={() => navigate('/interview')}
            className="px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 rounded-xl text-xs font-semibold transition-all"
          >
            Practice now
          </button>
        </div>
      </div>
    </div>
  );
}

export function RevisionPage() {
  const navigate = useNavigate();
  const { revisionList } = useInterviewStore();
  const [filterCat, setFilterCat] = useState<string>('All');

  const categories = ['All', ...Array.from(new Set(revisionList.map(r => r.question.category)))];
  const filtered = filterCat === 'All' ? revisionList : revisionList.filter(r => r.question.category === filterCat);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50/30 to-slate-100 flex flex-col">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-5 h-16 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="w-9 h-9 bg-blue-700 rounded-xl flex items-center justify-center text-lg">🛂</div>
            <div>
              <p className="font-extrabold text-gray-900 leading-none text-sm">PassMyVisa</p>
              <p className="text-[11px] text-gray-400 leading-none mt-0.5">Revision List</p>
            </div>
          </button>
          <div className="flex items-center gap-2">
            {revisionList.length > 0 && (
              <span className="text-xs font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-full">
                {revisionList.length} questions
              </span>
            )}
            <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-5 py-10">

        {/* Title */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">📚</span>
            <h1 className="text-3xl font-extrabold text-gray-900">Revision List</h1>
          </div>
          <p className="text-gray-500 text-sm">
            Questions you've flagged for revision. Add your own notes and generate model answers to practise.
          </p>
        </div>

        {revisionList.length === 0 ? (
          /* Empty state */
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-16 text-center">
            <div className="text-6xl mb-5">📖</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Nothing here yet</h2>
            <p className="text-gray-500 text-sm max-w-sm mx-auto mb-8">
              During an interview, click the bookmark icon on any question to add it to your revision list.
            </p>
            <button onClick={() => navigate('/prepare')}
              className="px-6 py-3 bg-blue-700 hover:bg-blue-600 text-white font-bold text-sm rounded-xl transition-all shadow-md">
              Go to Interview Prep
            </button>
          </div>
        ) : (
          <>
            {/* Category filter */}
            {categories.length > 2 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setFilterCat(cat)}
                    className={[
                      'px-3 py-1.5 rounded-full text-xs font-bold transition-all border',
                      filterCat === cat
                        ? 'bg-blue-700 text-white border-blue-700 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600',
                    ].join(' ')}
                  >
                    {cat}
                    {cat !== 'All' && (
                      <span className="ml-1 opacity-60">
                        ({revisionList.filter(r => r.question.category === cat).length})
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-4">
              {filtered.map(item => (
                <RevisionCard key={item.id} item={item} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
