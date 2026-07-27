import type { InterviewType, Question } from '../types';

const VISA_QUESTIONS: Question[] = [
  { id: 1,  category: 'Purpose',        question: 'What is the main purpose of your visit or stay in the UK?' },
  { id: 2,  category: 'Duration',       question: 'How long do you intend to stay and what are your plans once your visa ends?' },
  { id: 3,  category: 'Finances',       question: 'How will you fund yourself financially during your stay in the UK?' },
  { id: 4,  category: 'Accommodation',  question: 'Where will you be staying while in the UK and have you arranged this already?' },
  { id: 5,  category: 'Ties',           question: 'What ties — family, employment, property — do you have to your home country that ensure your return?' },
  { id: 6,  category: 'History',        question: 'Have you ever been refused entry to the UK or any other country? Please explain.' },
  { id: 7,  category: 'Background',     question: 'Can you describe your current occupation or studies back in your home country?' },
  { id: 8,  category: 'Intent',         question: 'Do you intend to work or study in the UK during this application? Please confirm.' },
  { id: 9,  category: 'Support',        question: 'Do you have a sponsor or contact in the UK, and what is their relationship to you?' },
  { id: 10, category: 'Compliance',     question: 'Are you aware of the conditions attached to your visa and do you agree to comply with them?' },
];

export const QUESTIONS_BY_TYPE: Record<InterviewType, Question[]> = {
  'visa':            VISA_QUESTIONS,
  'document-custom': [],
};
