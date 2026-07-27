import { useEffect, useRef, useState } from 'react';

interface Props {
  isSpeaking: boolean;
}

export function ECOAvatar({ isSpeaking }: Props) {
  const [mouthOpen, setMouthOpen] = useState(false);
  const [blinkLeft, setBlinkLeft] = useState(false);
  const [blinkRight, setBlinkRight] = useState(false);
  const mouthTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Natural-feeling mouth movement: random intervals between 100–320 ms
  useEffect(() => {
    const clear = () => {
      if (mouthTimerRef.current) clearTimeout(mouthTimerRef.current);
    };
    clear();
    if (!isSpeaking) { setMouthOpen(false); return clear; }
    const cycle = () => {
      setMouthOpen(v => !v);
      mouthTimerRef.current = setTimeout(cycle, 110 + Math.floor(Math.random() * 200));
    };
    mouthTimerRef.current = setTimeout(cycle, 80);
    return clear;
  }, [isSpeaking]);

  // Occasional synchronized blink every 3–6 s
  useEffect(() => {
    const scheduleBlink = () => {
      blinkTimerRef.current = setTimeout(() => {
        setBlinkLeft(true);
        setBlinkRight(true);
        setTimeout(() => { setBlinkLeft(false); setBlinkRight(false); }, 130);
        scheduleBlink();
      }, 3000 + Math.floor(Math.random() * 3000));
    };
    scheduleBlink();
    return () => { if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current); };
  }, []);

  return (
    <div className="absolute bottom-3 right-3 z-20 flex flex-col items-center gap-1.5 select-none">

      {/* Outer speaking ring */}
      <div
        className="relative rounded-full transition-all duration-300"
        style={{
          padding: isSpeaking ? 3 : 2,
          background: isSpeaking
            ? 'conic-gradient(from 0deg, #3b82f6, #60a5fa, #93c5fd, #3b82f6)'
            : 'rgba(255,255,255,0.15)',
          animation: isSpeaking ? 'ecoRingSpin 2s linear infinite' : 'none',
          boxShadow: isSpeaking ? '0 0 20px rgba(59,130,246,0.7), 0 0 40px rgba(59,130,246,0.3)' : 'none',
        }}
      >
        {/* Avatar circle */}
        <div
          className="rounded-full overflow-hidden"
          style={{
            width: 108,
            height: 108,
            animation: isSpeaking
              ? 'ecoNod 0.65s ease-in-out infinite alternate'
              : 'ecoBreathe 3.5s ease-in-out infinite',
          }}
        >
          <svg
            viewBox="0 0 120 130"
            width="108"
            height="108"
            xmlns="http://www.w3.org/2000/svg"
            style={{ display: 'block' }}
          >
            <defs>
              {/* Background gradient */}
              <radialGradient id="eco-bg" cx="40%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#1e3a5f" />
                <stop offset="100%" stopColor="#0a1628" />
              </radialGradient>
              {/* Skin tone gradient */}
              <linearGradient id="eco-face" x1="20%" y1="0%" x2="80%" y2="100%">
                <stop offset="0%" stopColor="#F8C9A0" />
                <stop offset="100%" stopColor="#E8A878" />
              </linearGradient>
              {/* Face shadow */}
              <radialGradient id="eco-face-shade" cx="50%" cy="80%" r="60%">
                <stop offset="0%" stopColor="rgba(0,0,0,0)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0.18)" />
              </radialGradient>
              {/* Uniform gradient */}
              <linearGradient id="eco-uniform" x1="0%" y1="0%" x2="20%" y2="100%">
                <stop offset="0%" stopColor="#1e3867" />
                <stop offset="100%" stopColor="#0d1e3a" />
              </linearGradient>
              {/* Badge gradient */}
              <linearGradient id="eco-badge" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#D4A520" />
                <stop offset="100%" stopColor="#8A6510" />
              </linearGradient>
              {/* Neck skin */}
              <linearGradient id="eco-neck" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F0BA8E" />
                <stop offset="100%" stopColor="#D8966A" />
              </linearGradient>
              {/* Iris gradient */}
              <radialGradient id="eco-iris-l" cx="45%" cy="35%" r="55%">
                <stop offset="0%" stopColor="#6B9BC4" />
                <stop offset="100%" stopColor="#2E5A7A" />
              </radialGradient>
              <radialGradient id="eco-iris-r" cx="45%" cy="35%" r="55%">
                <stop offset="0%" stopColor="#6B9BC4" />
                <stop offset="100%" stopColor="#2E5A7A" />
              </radialGradient>
              {/* Clip circle */}
              <clipPath id="eco-clip">
                <circle cx="60" cy="60" r="60" />
              </clipPath>
            </defs>

            {/* ── Background ── */}
            <rect width="120" height="130" fill="url(#eco-bg)" />

            <g clipPath="url(#eco-clip)">
              {/* ── Uniform body ── */}
              <path
                d="M-10,130 L-10,98 Q0,84 30,84 L44,89 L52,97 L60,100 L68,97 L76,89 L90,84 Q120,84 130,98 L130,130 Z"
                fill="url(#eco-uniform)"
              />
              {/* Jacket lapels */}
              <path d="M44,89 L28,120 L-10,108 L-10,98 Q0,84 30,84 L44,89 Z" fill="#17305e" />
              <path d="M76,89 L92,120 L130,108 L130,98 Q120,84 90,84 L76,89 Z" fill="#17305e" />

              {/* White shirt */}
              <path
                d="M50,91 L52,97 L60,100 L68,97 L70,91 Q65,96 60,96 Q55,96 50,91 Z"
                fill="#EEF0F2"
              />
              {/* Tie */}
              <path
                d="M57,95 L58,97 L60,130 L62,97 L63,95 Q61,97 60,97 Q59,97 57,95 Z"
                fill="#0c1b36"
              />
              {/* Tie knot */}
              <path d="M56,93 L60,96 L64,93 Q62,95 60,95 Q58,95 56,93 Z" fill="#0f2248" />

              {/* HM Border Force badge */}
              <ellipse cx="84" cy="107" rx="9" ry="10" fill="url(#eco-badge)" />
              <ellipse cx="84" cy="107" rx="8" ry="9" fill="none" stroke="#8A6510" strokeWidth="0.5" />
              <text x="84" y="105" textAnchor="middle" fontSize="4.2" fill="#0d1a35" fontWeight="900" letterSpacing="-0.2">HM</text>
              <text x="84" y="110" textAnchor="middle" fontSize="3.8" fill="#0d1a35" fontWeight="700">BF</text>
              <circle cx="84" cy="107" r="6" fill="none" stroke="#D4A520" strokeWidth="0.5" opacity="0.6" />

              {/* ── Neck ── */}
              <path
                d="M53,82 Q53,94 56,96 Q58,97 60,97 Q62,97 64,96 Q67,94 67,82 Q64,86 60,86 Q56,86 53,82 Z"
                fill="url(#eco-neck)"
              />

              {/* ── Head ── */}
              <ellipse cx="60" cy="50" rx="27" ry="33" fill="url(#eco-face)" />
              <ellipse cx="60" cy="50" rx="27" ry="33" fill="url(#eco-face-shade)" />

              {/* ── Ears ── */}
              <ellipse cx="33" cy="53" rx="4.5" ry="6.5" fill="#E8A878" />
              <ellipse cx="33" cy="53" rx="2.5" ry="3.8" fill="#D08060" />
              <ellipse cx="87" cy="53" rx="4.5" ry="6.5" fill="#E8A878" />
              <ellipse cx="87" cy="53" rx="2.5" ry="3.8" fill="#D08060" />

              {/* ── Hair ── dark professional short cut ── */}
              {/* Main hair mass */}
              <path
                d="M33,30 Q38,14 60,11 Q82,14 87,30 Q84,18 60,15 Q36,18 33,30 Z"
                fill="#231A10"
              />
              <path
                d="M33,30 Q31,37 33,48 L35,40 Q37,26 60,23 Q83,26 85,40 L87,48 Q89,37 87,30 Q82,14 60,11 Q38,14 33,30 Z"
                fill="#231A10"
              />
              {/* Side hairline detail */}
              <path d="M33,48 Q34,40 37,34 Q42,27 46,25 Q40,29 38,44 Z" fill="#1a120a" />
              <path d="M87,48 Q86,40 83,34 Q78,27 74,25 Q80,29 82,44 Z" fill="#1a120a" />
              {/* Hair highlight for depth */}
              <path d="M46,17 Q60,13 74,17 Q66,15 60,15 Q54,15 46,17 Z" fill="#35281A" opacity="0.5" />

              {/* ── Eyebrows ── */}
              <path
                d="M38,37 Q43,33 51,35"
                stroke="#2C1A0A" strokeWidth="2.8" fill="none" strokeLinecap="round"
              />
              <path
                d="M69,35 Q77,33 82,37"
                stroke="#2C1A0A" strokeWidth="2.8" fill="none" strokeLinecap="round"
              />

              {/* ── Left Eye ── */}
              <ellipse cx="45" cy="46" rx="8" ry="5.5" fill="rgba(0,0,0,0.07)" />
              <ellipse cx="45" cy="46" rx="7.5" ry="5" fill="#FAFAFA" />
              <circle cx="45" cy="46" r="3.8" fill="url(#eco-iris-l)" />
              <circle cx="45" cy="46" r="2.3" fill="#14141E" />
              <circle cx="46.5" cy="44.5" r="1.0" fill="white" opacity="0.9" />
              <path d="M37.5,44 Q45,40.5 52.5,44" stroke="rgba(0,0,0,0.12)" strokeWidth="1.3" fill="none" />
              {/* Blink lid left */}
              {blinkLeft && (
                <ellipse cx="45" cy="46" rx="7.5" ry="3" fill="#F2BA96"
                  style={{ transformOrigin: '45px 42px', transform: 'scaleY(1.6)' }} />
              )}

              {/* ── Right Eye ── */}
              <ellipse cx="75" cy="46" rx="8" ry="5.5" fill="rgba(0,0,0,0.07)" />
              <ellipse cx="75" cy="46" rx="7.5" ry="5" fill="#FAFAFA" />
              <circle cx="75" cy="46" r="3.8" fill="url(#eco-iris-r)" />
              <circle cx="75" cy="46" r="2.3" fill="#14141E" />
              <circle cx="76.5" cy="44.5" r="1.0" fill="white" opacity="0.9" />
              <path d="M67.5,44 Q75,40.5 82.5,44" stroke="rgba(0,0,0,0.12)" strokeWidth="1.3" fill="none" />
              {/* Blink lid right */}
              {blinkRight && (
                <ellipse cx="75" cy="46" rx="7.5" ry="3" fill="#F2BA96"
                  style={{ transformOrigin: '75px 42px', transform: 'scaleY(1.6)' }} />
              )}

              {/* ── Nose ── */}
              <path d="M58.5,51 L57,61" stroke="#C08060" strokeWidth="1" fill="none" opacity="0.55" />
              <path d="M61.5,51 L63,61" stroke="#C08060" strokeWidth="1" fill="none" opacity="0.55" />
              <path
                d="M55,61 Q58,64 60,64 Q62,64 65,61 Q62.5,62.5 60,62.5 Q57.5,62.5 55,61 Z"
                fill="#C08060" opacity="0.5"
              />

              {/* ── Mouth ── */}
              {/* Lip base — always rendered */}
              <path
                d={
                  mouthOpen
                    ? 'M50,66 Q55,63 60,64 Q65,63 70,66 Q65,72 60,73 Q55,72 50,66 Z'
                    : 'M50,66 Q55,63 60,64 Q65,63 70,66 Q65,69 60,69.5 Q55,69 50,66 Z'
                }
                fill="#C87A68"
              />
              {/* Mouth interior — only when open */}
              {mouthOpen && (
                <path
                  d="M52,66.5 Q60,72 68,66.5 Q65,72 60,73 Q55,72 52,66.5 Z"
                  fill="#3D1808"
                />
              )}
              {/* Upper lip highlight */}
              <path
                d="M52,65.5 Q56.5,63 60,63.8 Q63.5,63 68,65.5"
                stroke="rgba(255,255,255,0.22)" strokeWidth="0.7" fill="none"
              />

              {/* ── Cheek highlight ── */}
              <ellipse cx="38" cy="56" rx="6" ry="4" fill="rgba(255,170,130,0.10)" />
              <ellipse cx="82" cy="56" rx="6" ry="4" fill="rgba(255,170,130,0.10)" />

            </g>
          </svg>
        </div>
      </div>

      {/* Audio waveform bars — only when speaking */}
      {isSpeaking && (
        <div className="flex items-center justify-center gap-0.5 h-5">
          {[0, 1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="w-1 rounded-full bg-blue-400"
              style={{
                height: '6px',
                animation: 'ecoWaveBar 0.7s ease-in-out infinite',
                animationDelay: `${i * 0.13}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Status badge */}
      <div
        className={[
          'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold backdrop-blur-sm transition-all duration-300',
          isSpeaking
            ? 'bg-blue-600/90 text-white shadow-lg shadow-blue-800/50'
            : 'bg-black/60 text-gray-200 border border-white/10',
        ].join(' ')}
      >
        <span
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{
            background: isSpeaking ? '#60efff' : '#94a3b8',
            animation: isSpeaking ? 'ecoDot 1s ease-in-out infinite' : 'none',
          }}
        />
        <span>{isSpeaking ? 'Asking…' : 'ECO Officer'}</span>
      </div>
    </div>
  );
}
