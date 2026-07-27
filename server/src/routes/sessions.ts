import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { requireAuth } from '../auth';
import type { AuthRequest } from '../auth';

const router = Router();

// POST /api/sessions — save a completed interview session
router.post('/', requireAuth, (req: AuthRequest, res) => {
  const { deck_id, visa_type, answers, overall_score, elapsed } = req.body as {
    deck_id?: string;
    visa_type: string;
    answers: unknown[];
    overall_score: number;
    elapsed: number;
  };

  if (!visa_type || !Array.isArray(answers)) {
    res.status(400).json({ error: 'visa_type and answers are required' });
    return;
  }

  const id = uuidv4();
  db.prepare(
    'INSERT INTO interview_sessions (id, user_id, deck_id, visa_type, answers, overall_score, elapsed) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, req.user!.userId, deck_id ?? null, visa_type, JSON.stringify(answers), Math.round(overall_score ?? 0), Math.round(elapsed ?? 0));

  res.json({ id, completed_at: new Date().toISOString() });
});

// GET /api/sessions — current user's session history
router.get('/', requireAuth, (req: AuthRequest, res) => {
  const sessions = db.prepare(
    `SELECT s.id, s.deck_id, s.visa_type, s.answers, s.overall_score, s.elapsed, s.completed_at,
            d.name as deck_name
     FROM interview_sessions s
     LEFT JOIN question_decks d ON d.id = s.deck_id
     WHERE s.user_id = ?
     ORDER BY s.completed_at DESC
     LIMIT 50`
  ).all(req.user!.userId) as {
    id: string; deck_id: string | null; visa_type: string; answers: string;
    overall_score: number; elapsed: number; completed_at: string; deck_name: string | null;
  }[];

  res.json(sessions.map(s => ({ ...s, answers: JSON.parse(s.answers) })));
});

// GET /api/sessions/stats — aggregated stats for current user
router.get('/stats', requireAuth, (req: AuthRequest, res) => {
  const row = db.prepare(`
    SELECT
      COUNT(*) as total_sessions,
      ROUND(AVG(overall_score), 1) as avg_score,
      MAX(overall_score) as best_score,
      SUM(elapsed) as total_time
    FROM interview_sessions
    WHERE user_id = ?
  `).get(req.user!.userId) as { total_sessions: number; avg_score: number; best_score: number; total_time: number };

  res.json(row);
});

export default router;
