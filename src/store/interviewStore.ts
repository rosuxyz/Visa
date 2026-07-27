import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { InterviewType, QuestionAnswer, SessionRecord, Question, SavedQuestionSet } from '../types';
import { INTERVIEW_TYPE_LABELS } from '../types';

interface InterviewStore {
  selectedType: InterviewType;
  completedAnswers: QuestionAnswer[];
  totalElapsed: number;
  sessions: SessionRecord[];
  customQuestions: Question[];
  savedQuestionSets: SavedQuestionSet[];
  // Persisted per-visa-type user details for sample answer personalisation
  userDetailsByType: Partial<Record<InterviewType, Record<string, string>>>;

  setSelectedType: (type: InterviewType) => void;
  setCustomQuestions: (questions: Question[]) => void;
  saveQuestionSet: (name: string, questions: Question[], source: 'generated' | 'imported') => void;
  deleteQuestionSet: (id: string) => void;
  saveResults: (answers: QuestionAnswer[], elapsed: number) => void;
  updateSessionScore: (feedbacks: (import('../types').AIFeedback | null)[]) => void;
  setUserDetails: (type: InterviewType, values: Record<string, string>) => void;
  reset: () => void;
  clearHistory: () => void;
}

export const useInterviewStore = create<InterviewStore>()(
  persist(
    (set, get) => ({
      selectedType: 'visa',
      completedAnswers: [],
      totalElapsed: 0,
      sessions: [],
      customQuestions: [],
      savedQuestionSets: [],
      userDetailsByType: {},

      setSelectedType: (type) => set({ selectedType: type }),

      setCustomQuestions: (questions) => set({ customQuestions: questions }),

      saveQuestionSet: (name, questions, source) => {
        const record: SavedQuestionSet = {
          id: Date.now().toString(),
          name,
          savedAt: new Date().toISOString(),
          questions,
          source,
        };
        set(state => ({
          savedQuestionSets: [record, ...state.savedQuestionSets].slice(0, 50),
        }));
      },

      deleteQuestionSet: (id) => set(state => ({
        savedQuestionSets: state.savedQuestionSets.filter(s => s.id !== id),
      })),

      saveResults: (answers, elapsed) => {
        const record: SessionRecord = {
          id: Date.now().toString(),
          date: new Date().toISOString(),
          interviewType: get().selectedType,
          answers,
          totalElapsed: elapsed,
          overallScore: 0, // will be updated once SummaryPage fetches feedbacks
        };

        set(state => ({
          completedAnswers: answers,
          totalElapsed: elapsed,
          sessions: [record, ...state.sessions].slice(0, 20),
        }));
      },

      updateSessionScore: (feedbacks) => {
        set(state => {
          if (!state.sessions.length) return {};
          const [latest, ...rest] = state.sessions;

          // Merge feedbacks into answer records
          const updatedAnswers = latest.answers.map((qa, i) => {
            const fb = feedbacks[i];
            return fb ? { ...qa, feedback: fb } : qa;
          });

          const scored = updatedAnswers.filter(a => a.feedback);
          const overallScore = scored.length
            ? Math.round(
                scored.reduce((sum, a) => {
                  const f = a.feedback!;
                  return sum + (f.grammarScore + f.confidenceScore + f.relevanceScore) / 3;
                }, 0) / scored.length
              )
            : 0;

          const updatedSession: SessionRecord = { ...latest, answers: updatedAnswers, overallScore };
          return {
            completedAnswers: updatedAnswers,
            sessions: [updatedSession, ...rest],
          };
        });
      },

      setUserDetails: (type, values) => set(state => ({
        userDetailsByType: { ...state.userDetailsByType, [type]: values },
      })),

      reset: () => set({ completedAnswers: [], totalElapsed: 0 }),

      clearHistory: () => set({ sessions: [] }),
    }),
    {
      name: 'passmyvisa-storage',
      partialize: (state) => ({
        sessions: state.sessions,
        savedQuestionSets: state.savedQuestionSets,
        userDetailsByType: state.userDetailsByType,
        customQuestions: state.customQuestions,
        selectedType: state.selectedType,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<InterviewStore>;
        return {
          ...current,
          sessions: Array.isArray(p.sessions) ? p.sessions : [],
          savedQuestionSets: Array.isArray(p.savedQuestionSets) ? p.savedQuestionSets : [],
          userDetailsByType: (p.userDetailsByType && typeof p.userDetailsByType === 'object') ? p.userDetailsByType : {},
          customQuestions: Array.isArray(p.customQuestions) ? p.customQuestions : [],
          selectedType: p.selectedType ?? 'visa',
        };
      },
    }
  )
);

export { INTERVIEW_TYPE_LABELS };
