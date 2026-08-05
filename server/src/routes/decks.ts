import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import db from '../db';
import { requireAuth } from '../auth';
import type { AuthRequest } from '../auth';

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');
const GROQ_KEY = process.env.GROQ_API_KEY ?? '';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const TEXT_MODELS = ['llama-3.3-70b-versatile', 'qwen/qwen3.6-27b', 'openai/gpt-oss-120b', 'llama-3.1-8b-instant'];

async function groqChat(prompt: string): Promise<string> {
  for (const model of TEXT_MODELS) {
    try {
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: 2000 }),
      });
      const json = await res.json() as { choices?: { message?: { content?: string } }[]; error?: { message: string } };
      if (res.status === 429) { await new Promise(r => setTimeout(r, 3000)); continue; }
      if (!res.ok || json.error) continue;
      const text = json.choices?.[0]?.message?.content ?? '';
      if (text) return text;
    } catch { continue; }
  }
  throw new Error('AI unavailable');
}

function extractTextFromStoredFile(storedName: string): string {
  const filePath = path.join(UPLOADS_DIR, storedName);
  if (!fs.existsSync(filePath)) return '';
  // For text-extractable files we just read raw — full PDF extraction happens client-side
  // Here we return file metadata as context since we don't run pdfjs on the server
  return fs.readFileSync(filePath).toString('utf-8', 0, 8000).replace(/[^\x20-\x7E\n]/g, ' ');
}

const router = Router();

// POST /api/decks/generate — generate a deck from uploaded file IDs
router.post('/generate', requireAuth, async (req: AuthRequest, res) => {
  const { file_ids, visa_type, name, extracted_texts } = req.body as {
    file_ids: string[];
    visa_type: string;
    name: string;
    extracted_texts?: Record<string, string>; // file_id -> text sent from client PDF parser
  };

  if (!file_ids?.length || !visa_type || !name) {
    res.status(400).json({ error: 'file_ids, visa_type, and name are required' });
    return;
  }

  // Fetch file records
  const placeholders = file_ids.map(() => '?').join(',');
  const files = db.prepare(
    `SELECT id, original_name, doc_type, stored_name FROM uploaded_files WHERE id IN (${placeholders}) AND user_id = ?`
  ).all(...file_ids, req.user!.userId) as { id: string; original_name: string; doc_type: string; stored_name: string }[];

  if (!files.length) {
    res.status(404).json({ error: 'No matching files found' });
    return;
  }

  // Build document context — prefer client-extracted text, fall back to filename/type
  const docContext = files.map(f => {
    const clientText = (extracted_texts?.[f.id] ?? '').trim();
    const text = clientText.length > 50
      ? clientText.slice(0, 3000)
      : extractTextFromStoredFile(f.stored_name).slice(0, 3000);
    const label = { sop: 'Statement of Purpose', transcript: 'Academic Transcript', offer_letter: 'Offer Letter', other: 'Supporting Document' }[f.doc_type] ?? f.doc_type;
    return `[${label} — ${f.original_name}]\n${text || '(document uploaded but text could not be extracted — generate questions based on document type)'}`;
  }).join('\n\n---\n\n');

  const prompt = `You are a UK visa interview preparation expert. Based on the following documents provided by a ${visa_type} visa applicant, generate exactly 10 targeted interview questions that a UK Entry Clearance Officer (ECO) would ask specifically about the details in these documents.

DOCUMENTS:
${docContext}

Rules:
- Questions must reference specific details from the documents (names, dates, institutions, amounts, courses, employers)
- Each question should cover a different aspect: purpose, finances, ties to home country, accommodation, employment, education, relationship, history, intent
- Questions should feel like a real visa interview, not a generic quiz
- Progress from broad purpose questions to specific document details

Return ONLY a valid JSON array of exactly 10 objects, each with:
- id: number (1-10)
- category: one of: Purpose, Finances, Ties, Accommodation, Employment, Education, Relationship, History, Intent, Details
- question: string (the interview question)

Example: [{"id":1,"category":"Education","question":"Your offer letter shows you've been accepted to study MSc Data Science at Manchester — why did you choose this specific programme over similar ones in your home country?"}]`;

  try {
    const text = await groqChat(prompt);
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('No JSON array in response');
    const questions = JSON.parse(match[0]) as { id: number; category: string; question: string }[];
    const validated = questions.slice(0, 10).map((q, i) => ({
      id: i + 1,
      category: String(q.category || 'General'),
      question: String(q.question || ''),
    }));

    const id = uuidv4();
    db.prepare(
      'INSERT INTO question_decks (id, user_id, name, visa_type, file_ids, questions) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, req.user!.userId, name, visa_type, JSON.stringify(file_ids), JSON.stringify(validated));

    res.json({ id, name, visa_type, file_ids, questions: validated, created_at: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to generate questions' });
  }
});

// GET /api/decks — list user's decks
router.get('/', requireAuth, (req: AuthRequest, res) => {
  const decks = db.prepare(
    'SELECT id, name, visa_type, file_ids, questions, created_at FROM question_decks WHERE user_id = ? ORDER BY created_at DESC'
  ).all(req.user!.userId) as { id: string; name: string; visa_type: string; file_ids: string; questions: string; created_at: string }[];
  res.json(decks.map(d => ({ ...d, file_ids: JSON.parse(d.file_ids), questions: JSON.parse(d.questions) })));
});

// DELETE /api/decks/:id
router.delete('/:id', requireAuth, (req: AuthRequest, res) => {
  const deck = db.prepare('SELECT id FROM question_decks WHERE id = ? AND user_id = ?').get(req.params.id, req.user!.userId);
  if (!deck) { res.status(404).json({ error: 'Deck not found' }); return; }
  db.prepare('DELETE FROM question_decks WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
