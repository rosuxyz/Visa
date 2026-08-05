import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWebcam } from '../hooks/useWebcam';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

interface CaptionLine {
  id: number;
  text: string;
  timestamp: string;
}

function now() {
  return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function CaptionTestPage() {
  const navigate = useNavigate();
  const webcam = useWebcam();
  const speech = useSpeechRecognition();

  const [lines, setLines] = useState<CaptionLine[]>([]);
  const [micActive, setMicActive] = useState(false);
  const lineIdRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Request camera on mount
  useEffect(() => {
    webcam.requestAccess();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll captions to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines, speech.interimText]);

  // When a final sentence arrives, add it as a line
  useEffect(() => {
    if (!speech.finalText.trim()) return;
    const sentences = speech.finalText
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(Boolean);

    // Only add the last chunk (accumulative finalText — take tail)
    const last = sentences[sentences.length - 1];
    if (!last) return;

    setLines(prev => {
      // Avoid duplicating the same text
      if (prev.length > 0 && prev[prev.length - 1].text === last) return prev;
      return [...prev, { id: lineIdRef.current++, text: last, timestamp: now() }];
    });
  }, [speech.finalText]);

  const toggleMic = () => {
    if (micActive) {
      speech.stop();
      speech.resetTranscript();
      setMicActive(false);
    } else {
      speech.resetTranscript();
      speech.start();
      setMicActive(true);
    }
  };

  const clearCaptions = () => {
    setLines([]);
    speech.resetTranscript();
  };

  // Mic volume visualiser — fake bars driven by interimText length
  const hasActivity = !!speech.interimText || speech.isListening;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">

      {/* ── Top bar ─────────────────────────────────────── */}
      <header className="flex items-center gap-4 px-6 py-4 bg-gray-900/80 border-b border-white/5 backdrop-blur-sm">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 hover:opacity-75 transition-opacity"
        >
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-sm">🛂</div>
          <span className="font-bold text-sm hidden sm:block">PassMyVisa</span>
        </button>

        <div className="w-px h-5 bg-white/10" />

        <h1 className="text-sm font-semibold text-slate-300">Live Caption Test</h1>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={clearCaptions}
            className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-all"
          >
            Clear
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white border border-white/10 rounded-lg transition-all"
          >
            ← Back
          </button>
        </div>
      </header>

      {/* ── Main content ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col lg:flex-row gap-0 overflow-hidden">

        {/* Left — camera + controls */}
        <div className="lg:w-[420px] flex-shrink-0 flex flex-col gap-4 p-5 border-r border-white/5">

          {/* Camera feed */}
          <div className="relative rounded-2xl overflow-hidden bg-gray-900 border border-white/5" style={{ aspectRatio: '4/3' }}>
            <video
              ref={webcam.videoRef}
              autoPlay muted playsInline
              className={[
                'w-full h-full object-cover scale-x-[-1] transition-opacity duration-300',
                webcam.isCameraOn ? 'opacity-100' : 'opacity-0',
              ].join(' ')}
            />

            {/* Camera off */}
            {!webcam.isCameraOn && webcam.status === 'active' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-900">
                <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center">
                  <svg className="w-7 h-7 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
                <p className="text-gray-400 text-sm">Camera is off</p>
              </div>
            )}

            {/* Requesting */}
            {webcam.status === 'requesting' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-900">
                <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                <p className="text-gray-400 text-sm">Requesting camera…</p>
              </div>
            )}

            {/* Denied / error */}
            {(webcam.status === 'denied' || webcam.status === 'error') && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-900 p-6 text-center">
                <p className="text-red-400 text-sm">{webcam.error || 'Camera access denied'}</p>
                <button onClick={webcam.requestAccess}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-all">
                  Retry
                </button>
              </div>
            )}

            {/* LIVE badge */}
            {webcam.status === 'active' && webcam.isCameraOn && (
              <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-white text-[10px] font-bold tracking-wide">LIVE</span>
              </div>
            )}

            {/* Mic waveform overlay — bottom of camera */}
            {micActive && (
              <div className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-gradient-to-t from-black/70 to-transparent flex items-center gap-3">
                <div className="flex items-end gap-0.5 h-6">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-1 rounded-full bg-green-400"
                      style={{
                        height: hasActivity
                          ? `${20 + Math.sin(i * 0.8) * 50 + (speech.interimText.length % 10) * 3}%`
                          : '15%',
                        transition: 'height 0.1s ease',
                        opacity: hasActivity ? 1 : 0.4,
                      }}
                    />
                  ))}
                </div>
                <span className="text-green-300 text-xs font-medium">
                  {speech.isListening ? 'Listening…' : 'Mic active'}
                </span>
              </div>
            )}
          </div>

          {/* Camera & Mic controls */}
          <div className="flex gap-2">
            <button
              onClick={webcam.toggleCamera}
              className={[
                'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all border',
                webcam.isCameraOn
                  ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  : 'bg-red-600/20 border-red-500/30 text-red-400 hover:bg-red-600/30',
              ].join(' ')}
            >
              <span className="text-base">{webcam.isCameraOn ? '📹' : '🚫'}</span>
              {webcam.isCameraOn ? 'Camera on' : 'Camera off'}
            </button>

            <button
              onClick={toggleMic}
              className={[
                'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all border',
                micActive
                  ? 'bg-green-600/20 border-green-500/30 text-green-400 hover:bg-green-600/30'
                  : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10',
              ].join(' ')}
            >
              <span className="text-base">{micActive ? '🎤' : '🔇'}</span>
              {micActive ? 'Mic on' : 'Start mic'}
            </button>
          </div>

          {/* Status card */}
          <div className="bg-gray-900 rounded-2xl border border-white/5 p-4 flex flex-col gap-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status</p>

            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Camera</span>
              <span className={[
                'text-xs font-bold px-2.5 py-1 rounded-full',
                webcam.status === 'active' && webcam.isCameraOn ? 'bg-green-500/15 text-green-400' : 'bg-slate-700 text-slate-400',
              ].join(' ')}>
                {webcam.status === 'active' && webcam.isCameraOn ? 'Active' : webcam.status === 'active' ? 'Off' : webcam.status}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Microphone</span>
              <span className={[
                'text-xs font-bold px-2.5 py-1 rounded-full',
                speech.isListening ? 'bg-green-500/15 text-green-400' : micActive ? 'bg-yellow-500/15 text-yellow-400' : 'bg-slate-700 text-slate-400',
              ].join(' ')}>
                {speech.isListening ? 'Listening' : micActive ? 'Starting…' : 'Off'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Speech API</span>
              <span className={[
                'text-xs font-bold px-2.5 py-1 rounded-full',
                speech.isSupported ? 'bg-blue-500/15 text-blue-400' : 'bg-red-500/15 text-red-400',
              ].join(' ')}>
                {speech.isSupported ? 'Supported' : 'Not supported'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Lines captured</span>
              <span className="text-xs font-bold text-slate-300 bg-slate-700 px-2.5 py-1 rounded-full">
                {lines.length}
              </span>
            </div>
          </div>

          {!speech.isSupported && (
            <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-xl px-4 py-3 text-yellow-400 text-xs leading-relaxed">
              ⚠️ Live captions require Chrome or Edge. Other browsers do not support the Web Speech API.
            </div>
          )}
        </div>

        {/* Right — live captions */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Captions header */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-white/5">
            <div className={[
              'w-2 h-2 rounded-full flex-shrink-0',
              speech.isListening ? 'bg-green-400 animate-pulse' : 'bg-slate-600',
            ].join(' ')} />
            <h2 className="text-sm font-bold text-slate-300">Live Captions</h2>
            {lines.length > 0 && (
              <span className="text-xs text-slate-600">{lines.length} lines</span>
            )}
          </div>

          {/* Scrollable caption area */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-3">

            {lines.length === 0 && !speech.interimText && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
                <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center text-3xl">
                  🎤
                </div>
                <div>
                  <p className="text-slate-400 font-semibold mb-1">No captions yet</p>
                  <p className="text-slate-600 text-sm">
                    {micActive ? 'Start speaking — your words will appear here.' : 'Press "Start mic" and begin speaking.'}
                  </p>
                </div>
              </div>
            )}

            {/* Finalised lines */}
            {lines.map((line, idx) => (
              <div
                key={line.id}
                className="flex items-start gap-3 group animate-in fade-in slide-in-from-bottom-2 duration-300"
              >
                <span className="text-[10px] text-slate-600 font-mono flex-shrink-0 mt-1.5 w-16 text-right">
                  {line.timestamp}
                </span>
                <div className="flex-1 bg-gray-800/60 border border-white/5 rounded-xl px-4 py-3">
                  <p className="text-white text-sm leading-relaxed">{line.text}</p>
                </div>
                <span className="text-[10px] text-slate-700 flex-shrink-0 mt-2.5">#{idx + 1}</span>
              </div>
            ))}

            {/* Live interim text */}
            {speech.interimText && (
              <div className="flex items-start gap-3">
                <span className="text-[10px] text-slate-700 font-mono flex-shrink-0 mt-1.5 w-16 text-right">live</span>
                <div className="flex-1 bg-blue-900/20 border border-blue-500/20 rounded-xl px-4 py-3">
                  <p className="text-blue-300 text-sm leading-relaxed italic">{speech.interimText}</p>
                  <div className="flex gap-0.5 mt-2">
                    {[0,1,2].map(i => (
                      <span key={i} className="w-1 h-1 rounded-full bg-blue-400 animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
                <span className="text-[10px] text-slate-700 flex-shrink-0 mt-2.5">…</span>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Bottom bar — full transcript copy */}
          {lines.length > 0 && (
            <div className="border-t border-white/5 px-6 py-3 flex items-center gap-3">
              <p className="text-xs text-slate-500 flex-1 truncate">
                {lines.map(l => l.text).join(' ')}
              </p>
              <button
                onClick={() => navigator.clipboard?.writeText(lines.map(l => l.text).join(' '))}
                className="flex-shrink-0 text-xs font-semibold text-slate-400 hover:text-white px-3 py-1.5 border border-white/10 hover:border-white/20 rounded-lg transition-all"
              >
                Copy all
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
