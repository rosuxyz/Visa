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
  const answered = transcript?.trim();
  const answerBlock = answered
    ? `CANDIDATE'S ANSWER:\n"${answered}"`
    : `CANDIDATE'S ANSWER: (silent — no answer given)`;

  const text = await chat([{
    role: 'user',
    content: `You are a senior UK Entry Clearance Officer (ECO) evaluating a visa interview answer. Your job is to assess whether the answer convinces you — as a real interviewer — that this person is genuine, prepared, and meets the visa requirements.

IMPORTANT: You are NOT an English teacher. Grammar and accent do not matter. Many genuine applicants speak English as a second language. What matters is the CONTENT — are they giving you the real facts and reasons you need to approve their visa?

━━━ INTERVIEW CONTEXT ━━━
QUESTION ASKED: ${question}

${answerBlock}

━━━ HOW TO SCORE (0–100 each) ━━━

**grammarScore** — Basic communication clarity (NOT grammar pedantry)
This is LOW weight. Only penalise if the answer is so unclear you genuinely cannot understand the intended meaning.
- 80–100: Understandable regardless of grammatical perfection — the message is clear
- 50–79: Mostly clear but some phrases are confusing
- 20–49: Hard to understand, meaning is frequently lost
- 0–19: Incomprehensible or silent
Ignore: tense errors, missing articles, accent, non-native phrasing. Score 80+ unless you truly cannot understand them.

**confidenceScore** — Does the candidate sound like they believe their own story?
Real ECOs flag applicants who sound unsure of their own plans. Assess: do they state facts directly? Or do they hedge, guess, and qualify everything?
- 90–100: States facts directly ("I have £28,000 in HSBC"), sounds prepared and certain
- 70–89: Mostly confident, one or two unnecessary qualifications
- 45–69: Sounds somewhat uncertain, hedges on things they should know ("I think maybe…")
- 20–44: Sounds like they are guessing or unsure of basic facts about their own application
- 0–19: Silent or completely evasive

**relevanceScore** — Did they actually answer the question? (HIGHEST WEIGHT)
This is what matters most to an ECO. Did they address what was asked? Did they provide the specific facts needed?
- 90–100: Directly and completely answers what was asked with specific facts (names, amounts, dates, plans)
- 70–89: Answers the main point; one secondary aspect missing
- 45–69: Partially answers — hits some parts but skips key details the ECO specifically asked about
- 20–44: Loosely related but doesn't really address the question
- 0–19: Off-topic, silent, or so vague it tells the ECO nothing

**coherenceScore** — Does the answer make logical sense as a story?
ECOs are trained to spot inconsistencies. Does the answer hang together? Does it contradict anything? Is it a believable, coherent account?
- 90–100: Clear, logical, self-consistent — tells a believable story
- 70–89: Mostly coherent, one slightly unclear transition
- 45–69: Some disorganisation or internal inconsistency
- 20–44: Hard to follow, contradictory, or jumps around without connecting ideas
- 0–19: Incoherent or absent

━━━ ECO VERDICT ━━━
After reading this answer, what would a real ECO think?
- "Pass" — Satisfying answer. ECO would move on without concern.
- "Borderline" — Answer is okay but ECO would mentally flag this applicant for a follow-up question.
- "Fail" — Answer raises a red flag. ECO would doubt the application or want to probe much deeper.

━━━ OUTPUT — return ONLY this JSON, nothing else ━━━
{
  "grammarScore": <0-100>,
  "confidenceScore": <0-100>,
  "relevanceScore": <0-100>,
  "coherenceScore": <0-100>,
  "verdict": "<Pass|Borderline|Fail>",
  "strengths": ["<one specific thing this answer did well — quote the candidate's words if useful>"],
  "weaknesses": ["<the single most important content gap or problem — be concrete>"],
  "missedPoints": ["<a key fact the ECO expected to hear but was absent from the answer>"],
  "rewriteSuggestion": "<a single example sentence showing how to open or strengthen this answer — must be something the candidate could actually say>",
  "feedback": "<2-3 sentences of direct coaching: what content the answer needs, what would make the ECO more satisfied, one specific improvement — written conversationally to the student>"
}

RULES:
- Silent/no answer: all scores 0, verdict "Fail"
- Never inflate scores to be encouraging — the candidate needs honest assessment to prepare
- strengths/weaknesses/missedPoints must be about the CONTENT of this specific answer, never generic
- rewriteSuggestion must be a real spoken sentence, not meta-instructions like "explain your funding source"
- Do NOT penalise non-native English grammar — only penalise if meaning is genuinely lost`,
  }], TEXT_MODELS, 1200);

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Could not parse feedback from AI response');

  const parsed = JSON.parse(jsonMatch[0]) as Partial<AIFeedback> & {
    verdict?: string;
    strengths?: unknown;
    weaknesses?: unknown;
    missedPoints?: unknown;
    rewriteSuggestion?: unknown;
  };

  const clamp = (n: unknown) => Math.min(100, Math.max(0, Number(n) || 0));
  const toStrArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.slice(0, 3).map(String).filter(Boolean) : [];

  return {
    grammarScore:       clamp(parsed.grammarScore),
    confidenceScore:    clamp(parsed.confidenceScore),
    relevanceScore:     clamp(parsed.relevanceScore),
    coherenceScore:     clamp(parsed.coherenceScore),
    feedback:           String(parsed.feedback || ''),
    verdict:            (['Pass', 'Borderline', 'Fail'].includes(String(parsed.verdict))
                          ? parsed.verdict as 'Pass' | 'Borderline' | 'Fail'
                          : undefined),
    strengths:          toStrArr(parsed.strengths),
    weaknesses:         toStrArr(parsed.weaknesses),
    missedPoints:       toStrArr(parsed.missedPoints),
    rewriteSuggestion:  parsed.rewriteSuggestion ? String(parsed.rewriteSuggestion) : undefined,
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
// Human-readable labels for each detail key — mirrors PREPARE_FIELDS
const DETAIL_LABELS: Record<string, string> = {
  visaType:       'Visa type applying for',
  course:         'Course / programme',
  university:     'University / institution',
  courseStart:    'Course start date',
  courseDuration: 'Course duration',
  funding:        'How studies are funded',
  sponsor:        'Sponsor name & relationship',
  english:        'English test & score',
  hometies:       'Ties to home country',
  futurePlans:    'Plans after visa / studies end',
  prevVisas:      'Previous UK / other country visas',
  extraInfo:      'Additional relevant details',
};

export async function generateQuestionsFromDetails(
  details: Record<string, string>,
  sessionNum = 0,
  usedQuestions: string[] = []
): Promise<import('../types').Question[]> {
  const lines = Object.entries(details)
    .filter(([, v]) => v.trim())
    .map(([k, v]) => `${DETAIL_LABELS[k] ?? k}: ${v}`)
    .join('\n');

  const avoidBlock = usedQuestions.length > 0
    ? `\nAVOID — these questions were used in previous sessions, do NOT repeat or paraphrase any of them:\n${usedQuestions.slice(-30).map((q, i) => `${i + 1}. ${q}`).join('\n')}\n`
    : '';

  // Different angle seed per session so the model explores different dimensions
  const SESSION_ANGLES = [
    'Focus heavily on motivation and future plans this session.',
    'Focus heavily on financial details and sponsor credibility this session.',
    'Focus heavily on ties to home country and accommodation this session.',
    'Focus heavily on course knowledge and credibility probes this session.',
    'Focus heavily on travel history, English proficiency, and consistency this session.',
  ];
  const angleHint = SESSION_ANGLES[sessionNum % SESSION_ANGLES.length];

  const text = await chat([{
    role: 'user',
    content: `You are a senior UK Entry Clearance Officer (ECO) conducting a visa interview at a British embassy. You are professional, methodical, and mildly skeptical. Your job is to verify the applicant's story is genuine and consistent.

APPLICANT'S PROFILE:
${lines}

SESSION: ${sessionNum + 1}
${angleHint}
${avoidBlock}
TASK: Write exactly 10 fresh interview questions tailored to THIS specific applicant for this session.

━━━ COVERAGE (choose based on the session angle above) ━━━
Always include at least one question from each of these areas:
- Purpose & motivation (why UK, why now, why this course)
- Finances (exact amounts, source, duration, what if funding falls short)
- Ties to home country (concrete anchors — family, property, job, business)
- Future plans after visa ends (specific role, employer, location, why return)
- One credibility probe (challenge a gap, vague claim, or inconsistency in their profile)

Fill remaining questions with whatever the session angle requires.

━━━ QUESTION QUALITY RULES ━━━
PERSONALISATION (critical):
- Use the applicant's EXACT data in every question: real university name, course title, exact amounts, sponsor's name, country, dates
- Never say "your university", "the course", "[amount]" — always use the real value
- If a field is blank, ask about it rather than skip it

TONE & VARIETY:
- Sound like a real human across a desk — conversational, direct, occasionally challenging
- Mix openers: "Walk me through…", "How much exactly…", "That's a significant sum — can you explain…", "What specifically attracted you to…", "If [scenario], what would you do?"
- Vary sentence structure — no two questions should start the same way
- The 10 questions should feel like a coherent, natural 8-minute interview conversation

STRICT PROHIBITIONS:
- Never ask about documents or paperwork
- Never repeat a question from the AVOID list above (even paraphrased)
- No placeholders like [university], [amount], [country]
- No generic questions answerable by any applicant

━━━ OUTPUT FORMAT ━━━
Return ONLY a valid JSON array of exactly 10 objects, no prose:
[{"id":1,"category":"Purpose","question":"..."},...]

Category must be one of: Purpose, Education, Finances, Sponsor, Accommodation, Ties, Future Plans, History, Credibility`,
  }], TEXT_MODELS, 2500);

  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('Could not parse questions from AI response');
  const parsed = JSON.parse(match[0]) as import('../types').Question[];
  return parsed.slice(0, 10).map((q, i) => ({
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
