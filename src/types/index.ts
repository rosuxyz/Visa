export interface Question {
  id: number;
  category: string;
  question: string;
}

export type InterviewType =
  | 'visa'
  | 'document-custom';

export const INTERVIEW_TYPE_LABELS: Record<InterviewType, string> = {
  'visa':            'Visa Interview',
  'document-custom': 'Custom (from Document)',
};

export interface QuestionAnswer {
  question: Question;
  transcript: string;
  feedback?: AIFeedback;
}

export interface AIFeedback {
  grammarScore: number;       // 0–100
  confidenceScore: number;    // 0–100
  relevanceScore: number;     // 0–100
  feedback: string;
}

export type InterviewStatus = 'idle' | 'active' | 'ended';

export interface SessionRecord {
  id: string;
  date: string;          // ISO
  interviewType: InterviewType;
  answers: QuestionAnswer[];
  totalElapsed: number;
  overallScore: number;  // 0–100, avg of all scored answers
}

export interface SavedQuestionSet {
  id: string;
  name: string;
  savedAt: string;       // ISO
  questions: Question[];
  source: 'generated' | 'imported';
}
