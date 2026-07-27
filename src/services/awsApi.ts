import type { AIFeedback, Question } from '../types';

const GROQ_KEY  = import.meta.env.VITE_GROQ_API_KEY as string;
const BASE_URL  = 'https://api.groq.com/openai/v1/chat/completions';

// Active Groq models (verified July 2026)
const TEXT_MODELS = [
  'llama-3.3-70b-versatile',  // best quality
  'qwen/qwen3.6-27b',         // strong fallback
  'openai/gpt-oss-120b',      // secondary fallback
  'llama-3.1-8b-instant',     // fastest, always on
];

// No dedicated vision models available on this account — fall back to text
const VISION_MODELS = TEXT_MODELS;

// ── types ──────────────────────────────────────────────────────────────────────
type TextPart  = { type: 'text'; text: string };
type ImagePart = { type: 'image_url'; image_url: { url: string } };
type OAContent = string | (TextPart | ImagePart)[];
type OAMessage = { role: 'user'; content: OAContent };

// ── core fetch — tries each model until one succeeds ───────────────────────────
async function chat(messages: OAMessage[], models: string[], maxTokens = 1500): Promise<string> {
  const tried: string[] = [];

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(BASE_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GROQ_KEY}`,
            'Content-Type':  'application/json',
          },
          body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
        });

        const json = await res.json() as {
          choices?: { message?: { content?: string } }[];
          error?: { message?: string; code?: number | string; type?: string };
        };

        // Rate limited (per-minute) — wait and retry once
        if (res.status === 429) {
          const msg = json.error?.message ?? '';
          // Daily limit exhausted — no point retrying
          if (msg.toLowerCase().includes('daily') || msg.toLowerCase().includes('day')) {
            throw new Error('Daily free limit reached. Resets at midnight UTC.');
          }
          if (attempt === 0) {
            await new Promise(r => setTimeout(r, 4000));
            continue;
          }
          tried.push(`${model}: rate limited`);
          break;
        }

        if (!res.ok || json.error) {
          tried.push(`${model}: ${json.error?.message ?? res.statusText}`);
          break;
        }

        const text = json.choices?.[0]?.message?.content ?? '';
        if (!text) { tried.push(`${model}: empty response`); break; }

        return text;
      } catch (e) {
        if (e instanceof Error && e.message.startsWith('Daily')) throw e;
        tried.push(`${model}: ${e instanceof Error ? e.message : 'network error'}`);
        break;
      }
    }
  }

  throw new Error(`All AI models unavailable. Tried: ${tried.slice(-3).join(' | ')}`);
}

// ── AI Feedback ────────────────────────────────────────────────────────────────
export async function getAIFeedback(
  question: string,
  transcript: string
): Promise<AIFeedback> {
  const text = await chat([{
    role: 'user',
    content: `You are an expert UK visa interview coach. Evaluate this interview answer and return a JSON object.

Question: ${question}

Candidate's Answer: ${transcript || '(no answer provided)'}

Return ONLY a valid JSON object with exactly these fields:
- grammarScore: number 0-100 (clarity, grammar, vocabulary)
- confidenceScore: number 0-100 (directness, specificity, assertive tone)
- relevanceScore: number 0-100 (how directly it addresses the UK visa question)
- feedback: string (2-3 sentences of specific, actionable advice for UK visa interviews)

Example: {"grammarScore":78,"confidenceScore":65,"relevanceScore":82,"feedback":"Your answer covers the key points clearly. Mention your exact salary and how it exceeds the Home Office threshold. Avoid vague terms — precise figures reassure the ECO."}`,
  }], TEXT_MODELS);

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Could not parse feedback from AI response');

  const parsed = JSON.parse(jsonMatch[0]) as AIFeedback;
  return {
    grammarScore:    Math.min(100, Math.max(0, Number(parsed.grammarScore)    || 0)),
    confidenceScore: Math.min(100, Math.max(0, Number(parsed.confidenceScore) || 0)),
    relevanceScore:  Math.min(100, Math.max(0, Number(parsed.relevanceScore)  || 0)),
    feedback: String(parsed.feedback || ''),
  };
}

// ── Sample answer ─────────────────────────────────────────────────────────────
export async function getSampleAnswer(
  question: string,
  visaType: string,
  userContext: string
): Promise<string> {
  const contextBlock = userContext.trim()
    ? `\nApplicant's personal details:\n${userContext}\n`
    : '';

  const text = await chat([{
    role: 'user',
    content: `You are an expert UK visa interview coach. Write a model spoken answer to the question below for a UK Entry Clearance Officer (ECO).
${contextBlock}
QUESTION: ${question}

RULES:
- 2 to 4 sentences — spoken naturally, not formal writing
- Use the applicant's exact details above (institution name, course, amount, plans) — NEVER use placeholders like [university] or [amount]
- Be specific and factual — ECOs distrust vague answers
- Open confidently, state the key fact first, then support it
- Do NOT start with "I would say…", "As an applicant…", or anything meta
- Return ONLY the answer — no label, no quotation marks, no JSON

Answer:`,
  }], TEXT_MODELS);

  return text.trim();
}

// ── Overall interview review ───────────────────────────────────────────────────
export interface OverallReview {
  overallScore: number;
  readinessLevel: string;
  strengths: string[];
  improvements: string[];
  summary: string;
  recommendation: string;
}

export async function getOverallReview(
  qa: { question: string; answer: string }[],
  visaType: string
): Promise<OverallReview> {
  const qaBlock = qa.map((item, i) =>
    `Q${i + 1}: ${item.question}\nA${i + 1}: ${item.answer || '(no answer)'}`
  ).join('\n\n');

  const text = await chat([{
    role: 'user',
    content: `You are a senior UK visa interview coach. Review this complete mock interview for a ${visaType} applicant.

${qaBlock}

Return ONLY a valid JSON object with exactly these fields:
- overallScore: number 0-100
- readinessLevel: one of: "Ready to Apply", "Almost There", "Needs More Practice", "Significant Preparation Needed"
- strengths: array of 2-3 short strings
- improvements: array of 2-3 short strings
- summary: string (2-3 sentences)
- recommendation: string (single most important action before the real interview)

Example: {"overallScore":72,"readinessLevel":"Almost There","strengths":["Clear employment history","Good visa knowledge"],"improvements":["Needs specific financial figures","Elaborate on home country ties"],"summary":"The candidate shows solid knowledge but lacks specific detail in financial answers.","recommendation":"Practice quoting exact salary figures and savings balances."}`,
  }], TEXT_MODELS, 1000);

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Could not parse overall review');
  const parsed = JSON.parse(jsonMatch[0]) as OverallReview;
  return {
    overallScore:   Math.min(100, Math.max(0, Number(parsed.overallScore) || 0)),
    readinessLevel: String(parsed.readinessLevel || 'Needs More Practice'),
    strengths:      Array.isArray(parsed.strengths)    ? parsed.strengths.slice(0, 3).map(String)    : [],
    improvements:   Array.isArray(parsed.improvements) ? parsed.improvements.slice(0, 3).map(String) : [],
    summary:        String(parsed.summary || ''),
    recommendation: String(parsed.recommendation || ''),
  };
}

// ── Generate questions from personal details ──────────────────────────────────
export async function generateQuestionsFromDetails(
  details: Record<string, string>
): Promise<import('../types').Question[]> {
  const lines = Object.entries(details)
    .filter(([, v]) => v.trim())
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

  const text = await chat([{
    role: 'user',
    content: `You are a strict UK Entry Clearance Officer (ECO) conducting a real visa interview. Based on the applicant's personal details below, generate between 15 and 20 interview questions you would ask them.

APPLICANT DETAILS:
${lines}

INSTRUCTIONS:
- Every question MUST directly reference at least one specific detail the applicant provided (their university name, exact course, sponsor's name, fund amount, future plans, etc.)
- Do NOT generate generic visa questions — every question must be personalised and verifiable against their stated details
- Ask questions that probe credibility: does the story hang together? Are funds sufficient? Will they return home?
- Cover these angles: purpose of visit, choice of institution/course, financial sufficiency, sponsor credibility, ties to home country, future plans after visa ends, English ability, previous travel or refusals, course relevance to career, why this specific university
- Questions should feel adversarial but professional — an ECO trying to verify, not trip up
- Vary the difficulty: some easy factual checks, some deeper probing questions, some follow-up style questions that build on earlier ones
- Generate exactly 18 questions
- Return ONLY a valid JSON array of 18 objects, each with:
  - id: number (1–18)
  - category: one of: Purpose, Finances, Ties, Education, Employment, Sponsor, Future Plans, History, English, Credibility
  - question: string (the exact question, using the applicant's specific details)

Example for a student with saved £25,000 at Barclays:
[{"id":1,"category":"Finances","question":"You've stated you have £25,000 saved at Barclays — can you walk me through how you accumulated that amount and confirm it covers your full first year of fees and living costs?"}]`,
  }], TEXT_MODELS, 3000);

  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('Could not parse questions from AI response');
  const parsed = JSON.parse(match[0]) as import('../types').Question[];
  return parsed.slice(0, 20).map((q, i) => ({
    id: i + 1,
    category: String(q.category || 'General'),
    question: String(q.question || ''),
  }));
}

// ── Shared question-gen instruction ───────────────────────────────────────────
const QUESTION_GEN_INSTRUCTION = `You are a UK visa interview preparation expert. Generate 10 targeted UK visa interview questions an Entry Clearance Officer (ECO) might ask about this document.

Generate 10 questions that:
1. Are directly relevant to specific details in the document (dates, names, institutions, amounts)
2. Follow real UK UKVI interview question style
3. Cover: finances, intent, ties to home country, purpose, accommodation, etc.
4. Progress from general to specific

Return ONLY a valid JSON array of 10 objects, each with:
- id: number (1-10)
- category: string (one of: Purpose, Finances, Ties, Accommodation, Employment, Education, Relationship, History, Intent, Details)
- question: string

Example: [{"id":1,"category":"Purpose","question":"Your letter states you are visiting for a conference on 15 March — can you tell me more about the event?"}]`;

function parseQuestions(text: string): Question[] {
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Could not parse questions from AI response');
  const parsed = JSON.parse(jsonMatch[0]) as Question[];
  return parsed.slice(0, 10).map((q, i) => ({
    id: i + 1,
    category: String(q.category || 'General'),
    question: String(q.question || ''),
  }));
}

// ── Text document ──────────────────────────────────────────────────────────────
export async function generateQuestionsFromText(
  documentText: string,
  filename: string
): Promise<Question[]> {
  const text = await chat([{
    role: 'user',
    content: `Document filename: ${filename}\nDocument content:\n${documentText.slice(0, 6000)}\n\n${QUESTION_GEN_INSTRUCTION}`,
  }], TEXT_MODELS);
  return parseQuestions(text);
}

// ── Extract literal questions from a questions-list document ──────────────────
const EXTRACT_QUESTIONS_INSTRUCTION = `Extract every interview question verbatim from this document — do NOT generate new ones, do NOT paraphrase.

Rules:
- Extract every sentence that is a question (ends with "?" or is clearly a prompt like "Tell me about...").
- Preserve the question text exactly.
- Assign a category from: Purpose, Finances, Ties, Accommodation, Employment, Education, Relationship, History, Intent, Details.
- Return ONLY a valid JSON array (up to 50 items), each with: id (number), category (string), question (string).

Example: [{"id":1,"category":"Employment","question":"Can you explain your role at your current employer?"}]`;

export async function extractQuestionsFromText(
  documentText: string,
  filename: string
): Promise<Question[]> {
  const text = await chat([{
    role: 'user',
    content: `Document filename: ${filename}\nDocument content:\n${documentText.slice(0, 8000)}\n\n${EXTRACT_QUESTIONS_INSTRUCTION}`,
  }], TEXT_MODELS);

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Could not parse questions from document');
  const parsed = JSON.parse(jsonMatch[0]) as Question[];
  return parsed.slice(0, 50).map((q, i) => ({
    id: i + 1,
    category: String(q.category || 'General'),
    question: String(q.question || ''),
  }));
}

export async function extractQuestionsFromImages(
  dataUrls: string[],
  filename: string
): Promise<Question[]> {
  const content: (TextPart | ImagePart)[] = [
    ...dataUrls.slice(0, 4).map(url => ({
      type: 'image_url' as const,
      image_url: { url },
    })),
    {
      type: 'text' as const,
      text: `These are page images from the document "${filename}".\n\n${EXTRACT_QUESTIONS_INSTRUCTION}`,
    },
  ];

  const text = await chat([{ role: 'user', content }], VISION_MODELS);

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Could not parse questions from document');
  const parsed = JSON.parse(jsonMatch[0]) as Question[];
  return parsed.slice(0, 50).map((q, i) => ({
    id: i + 1,
    category: String(q.category || 'General'),
    question: String(q.question || ''),
  }));
}

// ── Image document (scanned PDF / JPG / PNG) ───────────────────────────────────
export async function generateQuestionsFromImages(
  dataUrls: string[],
  filename: string
): Promise<Question[]> {
  const content: (TextPart | ImagePart)[] = [
    ...dataUrls.slice(0, 4).map(url => ({
      type: 'image_url' as const,
      image_url: { url },
    })),
    {
      type: 'text' as const,
      text: `These are page images from the document "${filename}".\n\n${QUESTION_GEN_INSTRUCTION}`,
    },
  ];

  const text = await chat([{ role: 'user', content }], VISION_MODELS);
  return parseQuestions(text);
}
