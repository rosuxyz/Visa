import { useEffect } from 'react';
import { ECOAvatar } from './ECOAvatar';

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  status: 'idle' | 'requesting' | 'active' | 'denied' | 'error';
  error: string | null;
  isCameraOn: boolean;
  isSpeaking: boolean;
  requestAccess: () => Promise<void>;
}

export function VideoFeed({ videoRef, status, error, isCameraOn, isSpeaking, requestAccess }: Props) {
  useEffect(() => {
    if (videoRef.current && status === 'active') {
      videoRef.current.play().catch(() => {});
    }
  }, [status, videoRef]);

  return (
    <div className="relative w-full bg-gray-950 rounded-2xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={[
          'w-full h-full object-cover',
          'scale-x-[-1]',
          !isCameraOn ? 'opacity-0' : 'opacity-100',
          'transition-opacity duration-300',
        ].join(' ')}
      />

      {/* Camera off overlay */}
      {!isCameraOn && status === 'active' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-950">
          <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center">
            <svg className="w-9 h-9 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <p className="text-gray-400 text-sm">Camera is off</p>
        </div>
      )}

      {/* Permission / loading states */}
      {(status === 'idle' || status === 'requesting' || status === 'denied' || status === 'error') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gray-950 p-6 text-center">
          {status === 'requesting' ? (
            <>
              <div className="w-12 h-12 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
              <p className="text-gray-300 text-sm">Requesting camera access…</p>
            </>
          ) : (
            <>
              <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center mb-2">
                <svg className="w-9 h-9 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              {error && <p className="text-red-400 text-sm max-w-xs">{error}</p>}
              {!error && <p className="text-gray-400 text-sm">Camera access required for the mock interview.</p>}
              <button
                onClick={requestAccess}
                className="mt-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {status === 'denied' || status === 'error' ? 'Try Again' : 'Enable Camera'}
              </button>
            </>
          )}
        </div>
      )}

      {/* LIVE badge */}
      {status === 'active' && isCameraOn && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-full">
          <span className="pulse-dot w-2 h-2 rounded-full bg-red-500 inline-block" />
          <span className="text-white text-xs font-medium">LIVE</span>
        </div>
      )}

      {/* ECO Officer avatar — bottom right corner */}
      {status === 'active' && (
        <ECOAvatar isSpeaking={isSpeaking} />
      )}
    </div>
  );
}
