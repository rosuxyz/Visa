import { useCallback, useEffect, useRef, useState } from 'react';
import type { Question, QuestionAnswer, InterviewType } from '../types';
import { QUESTIONS_BY_TYPE } from '../data/questions';
import { useInterviewStore } from '../store/interviewStore';

interface UseInterviewFlowReturn {
  questions: Question[];
  currentIndex: number;
  currentQuestion: Question | null;
  answers: QuestionAnswer[];
  elapsed: number;
  isStarted: boolean;
  isEnded: boolean;
  isSpeaking: boolean;           // true while TTS is reading the question aloud
  startInterview: (type: InterviewType) => void;
  nextQuestion: (transcript: string) => void;
  endInterview: (transcript: string) => void;
  speakQuestion: (text: string, onDone?: () => void) => void;
}

export function useInterviewFlow(): UseInterviewFlowReturn {
  const { customQuestions, saveResults } = useInterviewStore();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<QuestionAnswer[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [isStarted, setIsStarted] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep a ref that is always in sync — used by endInterview to avoid stale closure
  const answersRef = useRef<QuestionAnswer[]>([]);
  const questionsRef = useRef<Question[]>([]);
  const currentIndexRef = useRef(0);
  const elapsedRef = useRef(0);

  const speakQuestion = useCallback((text: string, onDone?: () => void) => {
    if (!window.speechSynthesis) { onDone?.(); return; }

    window.speechSynthesis.cancel();

    // Chrome bug: after cancel(), synthesis can be left in a paused state
    if (window.speechSynthesis.paused) window.speechSynthesis.resume();

    setIsSpeaking(true);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    // Prefer a voices-ready voice; if not loaded yet, onvoiceschanged will re-run
    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      return (
        voices.find(v => v.lang === 'en-GB') ||
        voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural'))) ||
        voices.find(v => v.lang.startsWith('en'))
      );
    };
    const preferred = pickVoice();
    if (preferred) utterance.voice = preferred;

    // Chrome bug: speechSynthesis silently pauses mid-utterance (especially Q3+).
    // Resume every 5 s to prevent the freeze.
    const keepAlive = setInterval(() => {
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    }, 5000);

    // Hard watchdog: if onend hasn't fired within 15 s, force-reset isSpeaking
    // so the mic always turns back on regardless of browser bugs.
    const watchdog = setTimeout(() => {
      clearInterval(keepAlive);
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      onDone?.();
    }, 15000);

    const done = () => {
      clearInterval(keepAlive);
      clearTimeout(watchdog);
      setIsSpeaking(false);
      onDone?.();
    };

    utterance.onend   = done;
    utterance.onerror = done;

    window.speechSynthesis.speak(utterance);
  }, []);

  const startInterview = useCallback((type: InterviewType) => {
    const qs = type === 'document-custom' && customQuestions.length > 0
      ? customQuestions
      : QUESTIONS_BY_TYPE[type];

    if (!qs.length) return; // guard: no questions available

    answersRef.current = [];
    questionsRef.current = qs;
    currentIndexRef.current = 0;
    elapsedRef.current = 0;

    setQuestions(qs);
    setCurrentIndex(0);
    setAnswers([]);
    setElapsed(0);
    setIsStarted(true);
    setIsEnded(false);

    setTimeout(() => speakQuestion(qs[0].question), 800);

    timerRef.current = setInterval(() => {
      setElapsed(s => { elapsedRef.current = s + 1; return s + 1; });
    }, 1000);
  }, [speakQuestion, customQuestions]);

  const saveAnswer = useCallback((index: number, transcript: string, qs: Question[]) => {
    const qa: QuestionAnswer = {
      question: qs[index],
      transcript: transcript.trim(),
    };
    // Update ref immediately — always readable by endInterview
    const next = [...answersRef.current];
    next[index] = qa;
    answersRef.current = next;

    setAnswers([...next]);
    return qa;
  }, []);

  const nextQuestion = useCallback((transcript: string) => {
    const qs = questionsRef.current;
    const idx = currentIndexRef.current;
    saveAnswer(idx, transcript, qs);
    const nextIdx = idx + 1;
    if (nextIdx < qs.length) {
      currentIndexRef.current = nextIdx;
      setCurrentIndex(nextIdx);
      setTimeout(() => speakQuestion(qs[nextIdx].question), 300);
    }
  }, [saveAnswer, speakQuestion]);

  const endInterview = useCallback((transcript: string) => {
    const qs = questionsRef.current;
    const idx = currentIndexRef.current;
    saveAnswer(idx, transcript, qs);
    if (timerRef.current) clearInterval(timerRef.current);
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
    // Call saveResults with the ref — always has the final answers, not stale state
    saveResults(answersRef.current, elapsedRef.current);
    setIsEnded(true);
  }, [saveAnswer, saveResults]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
    };
  }, []);

  return {
    questions,
    currentIndex,
    currentQuestion: questions[currentIndex] ?? null,
    answers,
    elapsed,
    isStarted,
    isEnded,
    isSpeaking,
    startInterview,
    nextQuestion,
    endInterview,
    speakQuestion,
  };
}
