import { useEffect, useRef } from 'react';

interface Props {
  finalText: string;
  interimText: string;
  isListening: boolean;
  isSpeaking: boolean;
}

const MAX_DISPLAY_WORDS = 40;

export function CaptionBar({ finalText, interimText, isListening, isSpeaking }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [finalText, interimText]);

  const finalWords = finalText.trim().split(/\s+/).filter(Boolean);
  const trimmed = finalWords.slice(-MAX_DISPLAY_WORDS).join(' ');
  const showEllipsis = finalWords.length > MAX_DISPLAY_WORDS;
  const hasContent = trimmed || interimText;

  return (
    <div className="w-full h-full">
      <div
        className={[
          'w-full h-full rounded-xl px-5 py-3',
          'bg-gray-800/80 border border-gray-700/50',
          'transition-opacity duration-300',
          hasContent || isListening || isSpeaking ? 'opacity-100' : 'opacity-50',
        ].join(' ')}
      >
        <div
          ref={scrollRef}
          className="max-h-16 overflow-y-auto dark-scroll text-center leading-relaxed"
        >
          {/* TTS is reading the question — don't show user captions */}
          {isSpeaking && (
            <span className="text-blue-300 text-sm italic flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse inline-block" />
              Reading question…
            </span>
          )}

          {/* Mic is live, waiting for speech */}
          {!isSpeaking && !hasContent && isListening && (
            <span className="text-gray-400 text-sm italic">Listening… start speaking</span>
          )}

          {/* Idle */}
          {!isSpeaking && !hasContent && !isListening && (
            <span className="text-gray-500 text-sm italic">Live captions will appear here</span>
          )}

          {/* User answer captions */}
          {!isSpeaking && hasContent && (
            <p className="text-sm">
              {showEllipsis && <span className="text-gray-500">… </span>}
              {trimmed && <span className="text-white/90">{trimmed}{' '}</span>}
              {interimText && <span className="text-white/50 italic">{interimText}</span>}
            </p>
          )}
        </div>

        {/* Mic indicator — only when listening and not speaking */}
        {isListening && !isSpeaking && (
          <div className="absolute right-3 top-3 flex items-center gap-1">
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className="inline-block w-0.5 bg-green-400 rounded-full"
                style={{
                  height: `${8 + i * 4}px`,
                  animation: `pulse-dot ${0.6 + i * 0.15}s ease-in-out infinite`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
