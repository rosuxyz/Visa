import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { InterviewType, QuestionAnswer, SessionRecord, Question, SavedQuestionSet } from '../types';
import { INTERVIEW_TYPE_LABELS } from '../types';

export interface RevisionQuestion {
  id: string;
  question: Question;
  note: string;         // user's own note
  addedAt: string;      // ISO
  sessionNum: number;
}

interface InterviewStore {
  selectedType: InterviewType;
  completedAnswers: QuestionAnswer[];
  totalElapsed: number;
  sessions: SessionRecord[];
  customQuestions: Question[];
  savedQuestionSets: SavedQuestionSet[];
  userDetailsByType: Partial<Record<InterviewType, Record<string, string>>>;

  // Session tracking — for unique question sets per session
  sessionCount: number;
  usedQuestionTexts: string[];    // flat list of question strings used in past sessions

  // Revision list
  revisionList: RevisionQuestion[];

  setSelectedType: (type: InterviewType) => void;
  setCustomQuestions: (questions: Question[]) => void;
  saveQuestionSet: (name: string, questions: Question[], source: 'generated' | 'imported') => void;
  deleteQuestionSet: (id: string) => void;
  saveResults: (answers: QuestionAnswer[], elapsed: number) => void;
  updateSessionScore: (feedbacks: (import('../types').AIFeedback | null)[]) => void;
  setUserDetails: (type: InterviewType, values: Record<string, string>) => void;
  incrementSession: (questions: Question[]) => void;
  addToRevision: (question: Question, note?: string) => void;
  removeFromRevision: (id: string) => void;
  updateRevisionNote: (id: string, note: string) => void;
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
      sessionCount: 0,
      usedQuestionTexts: [],
      revisionList: [],

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
          overallScore: 0,
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
          const updatedAnswers = latest.answers.map((qa, i) => {
            const fb = feedbacks[i];
            return fb ? { ...qa, feedback: fb } : qa;
          });
          const scored = updatedAnswers.filter(a => a.feedback);
          const overallScore = scored.length
            ? Math.round(
                scored.reduce((sum, a) => {
                  const f = a.feedback!;
                  const coh = f.coherenceScore ?? f.relevanceScore;
                  return sum + (f.grammarScore + f.confidenceScore + f.relevanceScore + coh) / 4;
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

      incrementSession: (questions) => set(state => ({
        sessionCount: state.sessionCount + 1,
        // Keep last 200 used question texts so we don't repeat them
        usedQuestionTexts: [
          ...state.usedQuestionTexts,
          ...questions.map(q => q.question),
        ].slice(-200),
      })),

      addToRevision: (question, note = '') => set(state => {
        // Avoid exact duplicates
        if (state.revisionList.some(r => r.question.question === question.question)) return {};
        const entry: RevisionQuestion = {
          id: Date.now().toString(),
          question,
          note,
          addedAt: new Date().toISOString(),
          sessionNum: state.sessionCount,
        };
        return { revisionList: [entry, ...state.revisionList] };
      }),

      removeFromRevision: (id) => set(state => ({
        revisionList: state.revisionList.filter(r => r.id !== id),
      })),

      updateRevisionNote: (id, note) => set(state => ({
        revisionList: state.revisionList.map(r => r.id === id ? { ...r, note } : r),
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
        sessionCount: state.sessionCount,
        usedQuestionTexts: state.usedQuestionTexts,
        revisionList: state.revisionList,
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
          sessionCount: typeof p.sessionCount === 'number' ? p.sessionCount : 0,
          usedQuestionTexts: Array.isArray(p.usedQuestionTexts) ? p.usedQuestionTexts : [],
          revisionList: Array.isArray(p.revisionList) ? p.revisionList : [],
        };
      },
    }
  )
);

export { INTERVIEW_TYPE_LABELS };
