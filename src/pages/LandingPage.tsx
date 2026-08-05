import { useNavigate } from 'react-router-dom';
import { useInterviewStore } from '../store/interviewStore';

export function LandingPage() {
  const navigate = useNavigate();
  const { sessions, customQuestions } = useInterviewStore();

  const handleStart = () => {
    if (customQuestions.length > 0) {
      navigate('/interview');
    } else {
      navigate('/prepare');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex flex-col">
      {/* ── Navbar ────────────────────────────────────────── */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2.5 flex-shrink-0 hover:opacity-80 transition-opacity"
          >
            <div className="w-9 h-9 bg-blue-700 rounded-xl flex items-center justify-center text-lg shadow-sm">🛂</div>
            <div>
              <p className="font-extrabold text-gray-900 leading-none text-sm">PassMyVisa</p>
              <p className="text-[11px] text-gray-400 leading-none mt-0.5 hidden sm:block">AI Interview Practice</p>
            </div>
          </button>

          <nav className="flex items-center gap-1">
            <button
              onClick={() => navigate('/progress')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-gray-600 hover:text-blue-700 hover:bg-blue-50 transition-all"
            >
              <span>📊</span>
              <span className="hidden sm:inline">Progress</span>
              {sessions.length > 0 && (
                <span className="bg-blue-700 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {sessions.length > 9 ? '9+' : sessions.length}
                </span>
              )}
            </button>
            <button
              onClick={() => navigate('/profile')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-gray-600 hover:text-green-700 hover:bg-green-50 transition-all"
            >
              <span>👤</span>
              <span className="hidden sm:inline">Profile</span>
            </button>
            <button
              onClick={() => navigate('/revision')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-gray-600 hover:text-amber-700 hover:bg-amber-50 transition-all"
            >
              <span>📚</span>
              <span className="hidden sm:inline">Revision</span>
            </button>
            <button
              onClick={() => navigate('/captions')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-gray-600 hover:text-purple-700 hover:bg-purple-50 transition-all"
            >
              <span>🎤</span>
              <span className="hidden sm:inline">Captions</span>
            </button>
          </nav>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center px-5 py-10 sm:py-16">
        <div className="max-w-2xl w-full text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-full mb-5 shadow-sm">
            🛂 UKVI-Style Mock Interviews · Instant AI Feedback
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight mb-4">
            Ace Your <span className="text-blue-700">Visa</span><br className="hidden sm:block" /> Interview
          </h1>
          <p className="text-base sm:text-lg text-gray-500 max-w-lg mx-auto leading-relaxed">
            Answer real UKVI questions on camera. Get instant AI scores on grammar, confidence, and relevance — and detailed coaching tips.
          </p>
        </div>

        {/* ── Action cards ──────────────────────────────── */}
        <div className="w-full max-w-md flex flex-col gap-5">

          {/* Start interview card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
              <p className="text-sm font-bold text-gray-800">Start Practising</p>
              <p className="text-xs text-gray-400 mt-0.5">Camera + mic needed</p>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <button
                onClick={handleStart}
                className="w-full py-4 bg-blue-700 hover:bg-blue-600 active:scale-[0.98] text-white font-bold text-base rounded-xl transition-all shadow-md hover:shadow-blue-200 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                </svg>
                Start Interview
              </button>

              <ul className="text-xs text-gray-400 flex flex-col gap-1 px-1">
                <li className="flex items-center gap-1.5"><span className="text-green-500">✓</span> 10 visa interview questions</li>
                <li className="flex items-center gap-1.5"><span className="text-green-500">✓</span> Live speech captions</li>
                <li className="flex items-center gap-1.5"><span className="text-green-500">✓</span> AI score + coaching tips</li>
                <li className="flex items-center gap-1.5"><span className="text-green-500">✓</span> No recordings stored</li>
              </ul>
            </div>
          </div>

          {/* Progress card if sessions exist */}
          {sessions.length > 0 && (
            <button
              onClick={() => navigate('/progress')}
              className="bg-white rounded-2xl border border-green-200 hover:bg-green-50 transition-all p-4 text-left group"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">📈</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800 group-hover:text-green-700 transition-colors">
                    {sessions.length} session{sessions.length !== 1 ? 's' : ''} completed
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">View scores & session history →</p>
                </div>
              </div>
            </button>
          )}
        </div>

        {/* ── How it works ──────────────────────────────── */}
        <div className="max-w-3xl w-full mt-14">
          <h2 className="text-center text-lg font-bold text-gray-700 mb-6">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[
              { step: '1', icon: '📋', title: 'Enter your details', desc: 'Tell us your course, university, and plans once — AI generates questions just for you.' },
              { step: '2', icon: '🎤', title: 'Answer on camera',  desc: 'Questions are read aloud. Speak your answers naturally.' },
              { step: '3', icon: '🤖', title: 'Get AI feedback',   desc: 'Instant scores for grammar, confidence, and relevance.' },
              { step: '4', icon: '📊', title: 'Track your growth', desc: 'Review session history and see your improvement over time.' },
            ].map(s => (
              <div key={s.step} className="bg-white rounded-2xl border border-gray-200 p-5 text-center hover:shadow-sm transition-shadow">
                <div className="w-7 h-7 bg-blue-700 text-white text-xs font-bold rounded-full flex items-center justify-center mx-auto mb-3">
                  {s.step}
                </div>
                <div className="text-2xl mb-2">{s.icon}</div>
                <p className="text-sm font-bold text-gray-800 mb-1">{s.title}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="py-5 text-center text-xs text-gray-400 border-t border-gray-200">
        © 2025 PassMyVisa — AI-powered visa interview preparation
      </footer>
    </div>
  );
}
