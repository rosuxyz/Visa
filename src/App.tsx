import { Component, useEffect } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { LandingPage }   from './pages/LandingPage';
import { InterviewPage } from './pages/InterviewPage';
import { SummaryPage }   from './pages/SummaryPage';
import { ProgressPage }  from './pages/ProgressPage';
import { DocumentPage }  from './pages/DocumentPage';
import { PreparePage }   from './pages/PreparePage';
import { LoginPage }     from './pages/LoginPage';
import { ProfilePage }   from './pages/ProfilePage';
import { useAuthStore }  from './store/authStore';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      const err = this.state.error as Error;
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
          <div className="max-w-md text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h1>
            <p className="text-sm text-red-600 bg-red-50 rounded-xl p-4 mb-6 font-mono text-left break-all">
              {err.message}
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => { localStorage.removeItem('passmyvisa-storage'); window.location.href = '/'; }}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-xl">
                Clear data &amp; restart
              </button>
              <button onClick={() => window.location.href = '/'}
                className="px-4 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-semibold rounded-xl">
                Go home
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Hydrate auth on startup, then show spinner while loading
function AuthGate({ children }: { children: ReactNode }) {
  const { hydrate, loading } = useAuthStore();
  useEffect(() => { hydrate(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <span className="w-10 h-10 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
    );
  }
  return <>{children}</>;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuthStore();
  const location = useLocation();
  if (loading) return null;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthGate>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<RequireAuth><LandingPage /></RequireAuth>} />
            <Route path="/interview" element={<RequireAuth><InterviewPage /></RequireAuth>} />
            <Route path="/summary"   element={<RequireAuth><SummaryPage /></RequireAuth>} />
            <Route path="/progress"  element={<RequireAuth><ProgressPage /></RequireAuth>} />
            <Route path="/prepare"   element={<RequireAuth><PreparePage /></RequireAuth>} />
            <Route path="/document"  element={<RequireAuth><DocumentPage /></RequireAuth>} />
            <Route path="/profile"   element={<RequireAuth><ProfilePage /></RequireAuth>} />
            <Route path="*"          element={<Navigate to="/" replace />} />
          </Routes>
        </AuthGate>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
