import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useInterviewStore } from '../store/interviewStore';
import { filesApi, sessionsApi, leaderboardApi, authApi } from '../services/api';
import type { UploadedFile, SessionRecord, SessionStats, LeaderboardEntry } from '../services/api';
import { PREPARE_FIELDS } from './PreparePage';

function formatTime(s: number) {
  const m = Math.floor(s / 60); const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
function scoreColor(s: number) {
  return s >= 80 ? 'text-green-500' : s >= 60 ? 'text-yellow-500' : 'text-red-500';
}
function scoreBg(s: number) {
  return s >= 80 ? 'bg-green-100 text-green-700' : s >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
}

const DOC_TYPE_LABELS: Record<string, string> = {
  sop: 'Statement of Purpose', transcript: 'Transcript', offer_letter: 'Offer Letter', other: 'Other',
};
const DOC_TYPE_ICONS: Record<string, string> = {
  sop: '📝', transcript: '🎓', offer_letter: '📨', other: '📄',
};

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout, setAuth } = useAuthStore();
  const { userDetailsByType, setUserDetails, setCustomQuestions } = useInterviewStore();

  // My Details tab state
  const savedVisa = (userDetailsByType['visa'] ?? {}) as Record<string, string>;
  const [detailValues, setDetailValues] = useState<Record<string, string>>(savedVisa);
  const [detailsSaved, setDetailsSaved] = useState(false);
  const setDetailValue = (key: string, val: string) => setDetailValues(prev => ({ ...prev, [key]: val }));
  const handleSaveDetails = () => {
    setUserDetails('visa', detailValues);
    setCustomQuestions([]); // force re-generation on next interview start
    setDetailsSaved(true);
    setTimeout(() => setDetailsSaved(false), 2500);
  };

  const [tab, setTab] = useState<'overview' | 'files' | 'sessions' | 'leaderboard' | 'details'>('overview');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit name
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user?.name ?? '');
  const [nameSaving, setNameSaving] = useState(false);

  // File upload
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingDocType, setPendingDocType] = useState<string>('other');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      filesApi.list().then(setFiles).catch(() => {}),
      sessionsApi.list().then(setSessions).catch(() => {}),
      sessionsApi.stats().then(setStats).catch(() => {}),
      leaderboardApi.get().then(setLeaderboard).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const handleSaveName = async () => {
    if (!nameInput.trim()) return;
    setNameSaving(true);
    try {
      const updated = await authApi.updateMe({ name: nameInput.trim() });
      setAuth(localStorage.getItem('vr_token')!, updated);
    } catch { /* ignore */ }
    setEditingName(false);
    setNameSaving(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files;
    if (!picked?.length) return;
    setUploadError('');
    setUploading(true);
    const form = new FormData();
    Array.from(picked).forEach(f => form.append('files', f));
    Array.from(picked).forEach(() => form.append('doc_types', pendingDocType));
    try {
      const added = await filesApi.upload(form);
      setFiles(prev => [...added, ...prev]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteFile = async (id: string) => {
    await filesApi.delete(id).catch(() => {});
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const myRank = leaderboard.find(e => e.isMe);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-blue-700 rounded-lg flex items-center justify-center text-white font-bold text-sm">🛂</div>
            <span className="font-bold text-gray-900">PassMyVisa</span>
          </button>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="text-sm text-gray-500 hover:text-gray-700">← Home</button>
            <button onClick={() => { logout(); navigate('/login'); }}
              className="px-3 py-1.5 text-sm text-red-500 hover:text-red-700 font-medium border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* Profile hero */}
        <div className="bg-gradient-to-r from-blue-700 to-blue-900 rounded-2xl p-7 mb-8 text-white flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-4xl flex-shrink-0">
            {user?.name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-white/20 border border-white/30 text-white text-lg font-bold placeholder-white/50 focus:outline-none"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                />
                <button onClick={handleSaveName} disabled={nameSaving}
                  className="px-3 py-1.5 bg-white text-blue-700 text-sm font-bold rounded-lg">
                  {nameSaving ? '…' : 'Save'}
                </button>
                <button onClick={() => setEditingName(false)} className="text-white/60 hover:text-white text-sm">Cancel</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold">{user?.name}</h1>
                <button onClick={() => { setNameInput(user?.name ?? ''); setEditingName(true); }}
                  className="opacity-60 hover:opacity-100 transition-opacity">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              </div>
            )}
            <p className="text-blue-200 text-sm mt-0.5">{user?.email}</p>
            {myRank && (
              <p className="text-blue-100 text-sm mt-2 font-semibold">
                🏆 Rank #{myRank.rank} on Leaderboard · Avg Score {myRank.avg_score}/100
              </p>
            )}
          </div>
          <div className="flex gap-3 flex-wrap flex-shrink-0">
            {[
              { label: 'Sessions', value: stats?.total_sessions ?? 0 },
              { label: 'Best Score', value: stats?.best_score ? `${stats.best_score}/100` : '—' },
              { label: 'Time', value: stats?.total_time ? formatTime(stats.total_time) : '—' },
            ].map(s => (
              <div key={s.label} className="bg-white/10 rounded-xl px-4 py-3 text-center">
                <p className="text-xl font-extrabold">{s.value}</p>
                <p className="text-xs text-blue-200">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 mb-6 overflow-x-auto">
          {([
            { key: 'overview',     label: '📊 Overview' },
            { key: 'details',      label: '📋 My Details' },
            { key: 'files',        label: '📁 My Files' },
            { key: 'sessions',     label: '🎯 History' },
            { key: 'leaderboard',  label: '🏆 Leaderboard' },
          ] as { key: typeof tab; label: string }[]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={[
                'flex-1 min-w-[100px] py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap',
                tab === t.key ? 'bg-blue-600 text-white shadow' : 'text-gray-500 hover:text-gray-800',
              ].join(' ')}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <span className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          </div>
        ) : (
          <>
            {/* ── OVERVIEW ── */}
            {tab === 'overview' && (
              <div className="flex flex-col gap-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { icon: '🎯', label: 'Total Sessions', value: stats?.total_sessions ?? 0 },
                    { icon: '📊', label: 'Avg Score', value: stats?.avg_score ? `${stats.avg_score}/100` : '—' },
                    { icon: '🏆', label: 'Best Score', value: stats?.best_score ? `${stats.best_score}/100` : '—' },
                    { icon: '⏱', label: 'Time Practised', value: stats?.total_time ? formatTime(stats.total_time) : '—' },
                  ].map(s => (
                    <div key={s.label} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm text-center">
                      <div className="text-2xl mb-1.5">{s.icon}</div>
                      <div className="text-2xl font-extrabold text-gray-900">{s.value}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                  <h3 className="font-bold text-gray-900 mb-4">Recent Sessions</h3>
                  {sessions.length === 0 ? (
                    <p className="text-gray-400 text-sm">No sessions yet — complete your first interview!</p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {sessions.slice(0, 5).map(s => (
                        <div key={s.id} className="flex items-center gap-4 py-2.5 border-b border-gray-100 last:border-0">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">{s.visa_type}</p>
                            <p className="text-xs text-gray-400">{formatDate(s.completed_at)} · {formatTime(s.elapsed)}</p>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${scoreBg(s.overall_score)}`}>
                            {s.overall_score > 0 ? `${s.overall_score}/100` : 'No score'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── MY DETAILS ── */}
            {tab === 'details' && (
              <div className="flex flex-col gap-6">
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4">
                  <p className="text-sm text-blue-800 font-medium">
                    ✏️ Edit your application details here. Saving will clear your current questions — new personalised questions will be generated when you next start an interview.
                  </p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Fields marked * are required</p>
                  </div>
                  <div className="p-5 flex flex-col gap-4">
                    {PREPARE_FIELDS.map(f => (
                      <div key={f.key} className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-gray-700">
                          {f.label}{f.required && <span className="text-blue-600 ml-0.5">*</span>}
                        </label>
                        <input
                          type="text"
                          value={detailValues[f.key] ?? ''}
                          onChange={e => setDetailValue(f.key, e.target.value)}
                          placeholder={f.placeholder}
                          className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-colors"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  onClick={handleSaveDetails}
                  className="w-full py-4 bg-blue-700 hover:bg-blue-600 active:scale-[0.98] text-white font-bold text-base rounded-xl transition-all shadow-lg hover:shadow-blue-200 flex items-center justify-center gap-2"
                >
                  {detailsSaved ? (
                    <><span className="text-green-300">✓</span> Saved! New questions will be generated on next interview.</>
                  ) : (
                    <>Save Details & Regenerate Questions</>
                  )}
                </button>
              </div>
            )}

            {/* ── FILES ── */}
            {tab === 'files' && (
              <div className="flex flex-col gap-5">
                {/* Upload box */}
                <div className="bg-white rounded-2xl border-2 border-dashed border-blue-200 p-6">
                  <h3 className="font-bold text-gray-900 mb-4">Upload Documents</h3>
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Document Type</label>
                      <select
                        value={pendingDocType}
                        onChange={e => setPendingDocType(e.target.value)}
                        className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-800 focus:outline-none focus:border-blue-500"
                      >
                        <option value="sop">Statement of Purpose</option>
                        <option value="transcript">Transcript</option>
                        <option value="offer_letter">Offer Letter</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="pt-5">
                      <label className={[
                        'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all',
                        uploading ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white',
                      ].join(' ')}>
                        {uploading ? (
                          <><span className="w-4 h-4 rounded-full border-2 border-gray-300 border-t-blue-500 animate-spin" />Uploading…</>
                        ) : (
                          <>📤 Choose Files</>
                        )}
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          accept=".pdf,.docx,.doc,.jpg,.jpeg,.png"
                          className="hidden"
                          disabled={uploading}
                          onChange={handleFileUpload}
                        />
                      </label>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">Supported: PDF, DOCX, DOC, JPG, PNG · Max 20 MB each</p>
                  {uploadError && <p className="text-sm text-red-500 mt-2">{uploadError}</p>}
                </div>

                {/* File list */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-bold text-gray-900">Your Files ({files.length})</h3>
                  </div>
                  {files.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                      <div className="text-4xl mb-2">📂</div>
                      <p className="text-sm">No files uploaded yet</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {files.map(f => (
                        <div key={f.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                          <span className="text-2xl flex-shrink-0">{DOC_TYPE_ICONS[f.doc_type] ?? '📄'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">{f.original_name}</p>
                            <p className="text-xs text-gray-400">
                              {DOC_TYPE_LABELS[f.doc_type]} · {formatBytes(f.size_bytes)} · {formatDate(f.uploaded_at)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <a
                              href={filesApi.downloadUrl(f.id)}
                              download={f.original_name}
                              className="p-2 rounded-lg bg-gray-100 hover:bg-blue-50 text-gray-500 hover:text-blue-600 transition-colors"
                              title="Download"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                            </a>
                            <button
                              onClick={() => handleDeleteFile(f.id)}
                              className="p-2 rounded-lg bg-gray-100 hover:bg-red-50 text-gray-500 hover:text-red-500 transition-colors"
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
                  )}
                </div>
              </div>
            )}

            {/* ── SESSIONS ── */}
            {tab === 'sessions' && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="font-bold text-gray-900">Session History ({sessions.length})</h3>
                </div>
                {sessions.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">
                    <div className="text-4xl mb-2">🎯</div>
                    <p className="text-sm">No sessions yet. Complete a mock interview to see your history.</p>
                    <button onClick={() => navigate('/')} className="mt-4 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-500 transition-colors">
                      Start Interview
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {sessions.map((s, i) => (
                      <div key={s.id} className="flex items-center gap-4 px-5 py-4">
                        <div className="w-8 h-8 rounded-full bg-blue-700 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                          #{i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800">{s.visa_type}</p>
                          <p className="text-xs text-gray-400">
                            {formatDate(s.completed_at)} · {formatTime(s.elapsed)} · {(s.answers as unknown[]).length} questions
                            {s.deck_name && <> · <span className="text-blue-600">"{s.deck_name}"</span></>}
                          </p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0 ${scoreBg(s.overall_score)}`}>
                          {s.overall_score > 0 ? `${s.overall_score}/100` : 'No score'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── LEADERBOARD ── */}
            {tab === 'leaderboard' && (
              <div className="flex flex-col gap-4">
                <div className="bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl p-5 text-white">
                  <h3 className="font-bold text-lg mb-1">🏆 Global Leaderboard</h3>
                  <p className="text-yellow-100 text-sm">Top users ranked by average interview score</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  {leaderboard.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                      <p className="text-sm">No ranked users yet. Complete at least one interview to appear here.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {leaderboard.map(entry => (
                        <div key={entry.id} className={[
                          'flex items-center gap-4 px-5 py-4 transition-colors',
                          entry.isMe ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'hover:bg-gray-50',
                        ].join(' ')}>
                          <div className={[
                            'w-9 h-9 rounded-full flex items-center justify-center font-extrabold text-sm flex-shrink-0',
                            entry.rank === 1 ? 'bg-yellow-400 text-yellow-900' :
                            entry.rank === 2 ? 'bg-gray-300 text-gray-700' :
                            entry.rank === 3 ? 'bg-orange-300 text-orange-900' :
                            'bg-gray-100 text-gray-600',
                          ].join(' ')}>
                            {entry.rank <= 3 ? ['🥇','🥈','🥉'][entry.rank - 1] : `#${entry.rank}`}
                          </div>
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-lg font-bold text-blue-700 flex-shrink-0">
                            {entry.name[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {entry.name} {entry.isMe && <span className="text-blue-600 text-xs">(You)</span>}
                            </p>
                            <p className="text-xs text-gray-400">
                              {entry.total_sessions} session{entry.total_sessions !== 1 ? 's' : ''} · Best {entry.best_score}/100
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className={`text-lg font-extrabold ${scoreColor(entry.avg_score)}`}>
                              {entry.avg_score}
                            </p>
                            <p className="text-xs text-gray-400">avg score</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
