import { useCallback, useEffect, useRef, useState } from 'react';

interface UseSpeechRecognitionReturn {
  interimText: string;
  finalText: string;
  isListening: boolean;
  isSupported: boolean;
  start: () => void;
  stop: () => void;
  resetTranscript: () => void;
  fullTranscript: string;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onresult: ((e: ISpeechRecognitionEvent) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface ISpeechRecognitionResult {
  isFinal: boolean;
  readonly length: number;
  [index: number]: { transcript: string; confidence: number };
}

interface ISpeechRecognitionEvent {
  resultIndex: number;
  results: { length: number; [index: number]: ISpeechRecognitionResult };
}

interface ISpeechRecognitionCtor {
  new(): ISpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition: ISpeechRecognitionCtor | undefined;
    webkitSpeechRecognition: ISpeechRecognitionCtor | undefined;
  }
}

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const [interimText, setInterimText]   = useState('');
  const [finalText,   setFinalText]     = useState('');
  const [isListening, setIsListening]   = useState(false);

  // refs so closures always see latest values
  const shouldRestartRef = useRef(false);
  const finalTextRef     = useRef('');
  finalTextRef.current   = finalText;

  // Silence watchdog — restart recognition if no result arrives for 8s
  // (Chrome stops sending results silently after long pauses)
  const silenceTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const SpeechRecognitionClass: ISpeechRecognitionCtor | null =
    typeof window !== 'undefined'
      ? (window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null)
      : null;

  const isSupported = !!SpeechRecognitionClass;

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const killInstance = (r: ISpeechRecognition) => {
    r.onstart  = null;
    r.onresult = null;
    r.onerror  = null;
    r.onend    = null;
    try { r.abort(); } catch (_) {}
  };

  // spawnRecognition is defined as a plain function (not useCallback) so it
  // can reference itself recursively inside onend without stale-closure issues.
  // We store it in a ref so start/stop can call the latest version.
  const spawnRef = useRef<() => ISpeechRecognition | null>(() => null);

  spawnRef.current = () => {
    if (!SpeechRecognitionClass) return null;

    if (recognitionRef.current) killInstance(recognitionRef.current);

    const r = new SpeechRecognitionClass();
    // Non-continuous gives cleaner, more accurate final results on Chrome.
    // We restart manually after each utterance ends — this is the key fix.
    r.continuous     = false;
    r.interimResults = true;
    r.lang           = 'en-US';   // en-US model is larger and more accurate
    r.maxAlternatives = 1;        // Chrome always returns 0 confidence for extras; wastes nothing

    r.onstart = () => {
      setIsListening(true);
      // Reset silence watchdog on every new session
      clearSilenceTimer();
      silenceTimerRef.current = setTimeout(() => {
        // No result for 8s — force a fresh restart
        if (shouldRestartRef.current) {
          killInstance(r);
          const next = spawnRef.current();
          if (next) {
            recognitionRef.current = next;
            try { next.start(); } catch (_) {}
          }
        }
      }, 8000);
    };

    r.onresult = (event) => {
      // Reset silence watchdog — we're getting speech
      clearSilenceTimer();
      silenceTimerRef.current = setTimeout(() => {
        if (shouldRestartRef.current) {
          killInstance(r);
          const next = spawnRef.current();
          if (next) {
            recognitionRef.current = next;
            try { next.start(); } catch (_) {}
          }
        }
      }, 8000);

      let interim = '';
      let finalChunk = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result   = event.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) {
          finalChunk += transcript + ' ';
        } else {
          interim += transcript;
        }
      }

      if (finalChunk) {
        setFinalText(prev => prev + finalChunk);
        setInterimText('');
      } else {
        setInterimText(interim);
      }
    };

    r.onerror = (event) => {
      clearSilenceTimer();
      // These are all recoverable — onend will fire next and we restart
      if (['no-speech', 'audio-capture', 'aborted', 'network'].includes(event.error)) return;
      console.warn('SpeechRecognition error:', event.error);
    };

    r.onend = () => {
      clearSilenceTimer();
      setIsListening(false);
      setInterimText('');

      if (!shouldRestartRef.current) return;

      // Restart with a short gap so the browser fully releases the mic session
      setTimeout(() => {
        if (!shouldRestartRef.current) return;
        const next = spawnRef.current();
        if (next) {
          recognitionRef.current = next;
          try { next.start(); } catch (_) {}
        }
      }, 250);
    };

    recognitionRef.current = r;
    return r;
  };

  const start = useCallback(() => {
    if (!SpeechRecognitionClass) return;
    shouldRestartRef.current = true;
    const r = spawnRef.current();
    if (r) {
      recognitionRef.current = r;
      try { r.start(); } catch (_) {}
    }
  }, [SpeechRecognitionClass]);

  const stop = useCallback(() => {
    shouldRestartRef.current = false;
    clearSilenceTimer();
    setIsListening(false);
    setInterimText('');
    if (recognitionRef.current) {
      killInstance(recognitionRef.current);
      recognitionRef.current = null;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const resetTranscript = useCallback(() => {
    setFinalText('');
    setInterimText('');
  }, []);

  useEffect(() => {
    return () => {
      shouldRestartRef.current = false;
      clearSilenceTimer();
      if (recognitionRef.current) killInstance(recognitionRef.current);
      recognitionRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    interimText,
    finalText,
    isListening,
    isSupported,
    start,
    stop,
    resetTranscript,
    fullTranscript: (finalText + interimText).trim(),
  };
}
