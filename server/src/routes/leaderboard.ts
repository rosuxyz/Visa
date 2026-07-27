import { Router } from 'express';
import db from '../db';
import { requireAuth } from '../auth';
import type { AuthRequest } from '../auth';

const router = Router();

// GET /api/leaderboard — top 20 users by avg score (public)
router.get('/', requireAuth, (req: AuthRequest, res) => {
  const rows = db.prepare(`
    SELECT
      u.id,
      u.name,
      u.avatar,
      COUNT(s.id)                       as total_sessions,
      ROUND(AVG(s.overall_score), 1)    as avg_score,
      MAX(s.overall_score)              as best_score,
      SUM(s.elapsed)                    as total_time
    FROM users u
    JOIN interview_sessions s ON s.user_id = u.id
    GROUP BY u.id
    HAVING COUNT(s.id) >= 1
    ORDER BY avg_score DESC
    LIMIT 20
  `).all() as {
    id: string; name: string; avatar: string | null;
    total_sessions: number; avg_score: number; best_score: number; total_time: number;
  }[];

  // Mark the current user's row
  const result = rows.map((r, i) => ({ ...r, rank: i + 1, isMe: r.id === req.user!.userId }));
  res.json(result);
});

// GET /api/leaderboard/profile/:userId — public profile for any user
router.get('/profile/:userId', requireAuth, (req: AuthRequest, res) => {
  const user = db.prepare('SELECT id, name, avatar, created_at FROM users WHERE id = ?').get(req.params.userId) as {
    id: string; name: string; avatar: string | null; created_at: string;
  } | undefined;
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  const stats = db.prepare(`
    SELECT COUNT(*) as total_sessions, ROUND(AVG(overall_score),1) as avg_score, MAX(overall_score) as best_score, SUM(elapsed) as total_time
    FROM interview_sessions WHERE user_id = ?
  `).get(req.params.userId) as { total_sessions: number; avg_score: number; best_score: number; total_time: number };

  const recentSessions = db.prepare(`
    SELECT visa_type, overall_score, elapsed, completed_at FROM interview_sessions
    WHERE user_id = ? ORDER BY completed_at DESC LIMIT 5
  `).all(req.params.userId);

  res.json({ ...user, stats, recentSessions });
});

export default router;
