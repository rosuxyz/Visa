import { useNavigate } from 'react-router-dom';

interface Props {
  elapsed: number;
  isMicOn: boolean;
  isCameraOn: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onEndInterview: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function IconButton({
  onClick, title, active, danger, children,
}: {
  onClick: () => void;
  title: string;
  active: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={[
        'flex flex-col items-center justify-center gap-0.5 w-12 h-12 sm:w-auto sm:h-auto sm:px-3 sm:py-2 sm:flex-row sm:gap-2 rounded-xl transition-all font-medium text-xs',
        danger
          ? active
            ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            : 'bg-red-600/80 hover:bg-red-500 text-white border border-red-500'
          : active
            ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
            : 'bg-red-900/50 hover:bg-red-900/70 text-red-400 border border-red-800/50',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

export function TopBar({ elapsed, isMicOn, isCameraOn, onToggleMic, onToggleCamera, onEndInterview }: Props) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-between px-4 py-2.5 bg-gray-900 border-b border-gray-800 gap-3">

      {/* Left — branding (clickable → home) */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 flex-shrink-0 hover:opacity-80 transition-opacity"
      >
        <div className="w-7 h-7 bg-blue-700 rounded-lg flex items-center justify-center text-sm shadow-sm">🛂</div>
        <span className="text-white font-semibold text-sm hidden md:block">PassMyVisa</span>
      </button>

      {/* Centre — timer */}
      <div className="flex items-center gap-2 bg-gray-800 px-4 py-2 rounded-full border border-gray-700 flex-shrink-0">
        <span className="pulse-dot w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
        <span className="text-white font-mono font-semibold text-sm tabular-nums">{formatTime(elapsed)}</span>
        <span className="text-gray-500 text-xs hidden sm:inline">elapsed</span>
      </div>

      {/* Right — controls */}
      <div className="flex items-center gap-2 flex-shrink-0">

        {/* Mic toggle */}
        <IconButton onClick={onToggleMic} title={isMicOn ? 'Mute microphone' : 'Unmute'} active={isMicOn}>
          {isMicOn ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.5a1.5 1.5 0 01-1.5-1.5V9a1.5 1.5 0 011.5-1.5h1.5z" />
            </svg>
          )}
          <span className="text-[10px] sm:text-xs">{isMicOn ? 'Mic on' : 'Muted'}</span>
        </IconButton>

        {/* Camera toggle */}
        <IconButton onClick={onToggleCamera} title={isCameraOn ? 'Turn off camera' : 'Turn on camera'} active={isCameraOn}>
          {isCameraOn ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M12 18.75h.008v.008H12v-.008zm0-3.75h.008v.008H12v-.008zm-3-3h.008v.008H9v-.008zm3 0h.008v.008H12v-.008z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
            </svg>
          )}
          <span className="text-[10px] sm:text-xs">{isCameraOn ? 'Cam on' : 'Cam off'}</span>
        </IconButton>

        {/* Divider */}
        <div className="w-px h-8 bg-gray-700 hidden sm:block" />

        {/* End interview — always visible, labelled */}
        <button
          onClick={onEndInterview}
          className="flex items-center gap-1.5 px-3 py-2.5 bg-red-600 hover:bg-red-500 active:scale-[0.97] text-white text-xs font-bold rounded-xl transition-all shadow-sm"
        >
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span>End Interview</span>
        </button>
      </div>
    </div>
  );
}
