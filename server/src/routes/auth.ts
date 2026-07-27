import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { signToken, requireAuth } from '../auth';
import type { AuthRequest } from '../auth';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body as { name?: string; email?: string; password?: string };
  if (!name?.trim() || !email?.trim() || !password?.trim()) {
    res.status(400).json({ error: 'Name, email, and password are required' });
    return;
  }
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (exists) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }
  const hash = await bcrypt.hash(password, 10);
  const id = uuidv4();
  db.prepare('INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)').run(
    id, name.trim(), email.toLowerCase().trim(), hash
  );
  const token = signToken({ userId: id, email: email.toLowerCase() });
  res.json({ token, user: { id, name: name.trim(), email: email.toLowerCase() } });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email?.trim() || !password?.trim()) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase()) as {
    id: string; name: string; email: string; password: string; avatar: string | null; created_at: string;
  } | undefined;
  if (!user) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }
  const token = signToken({ userId: user.id, email: user.email });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar } });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req: AuthRequest, res) => {
  const user = db.prepare('SELECT id, name, email, avatar, created_at FROM users WHERE id = ?').get(req.user!.userId) as {
    id: string; name: string; email: string; avatar: string | null; created_at: string;
  } | undefined;
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  res.json(user);
});

// PATCH /api/auth/me — update name or avatar
router.patch('/me', requireAuth, (req: AuthRequest, res) => {
  const { name, avatar } = req.body as { name?: string; avatar?: string };
  if (name?.trim()) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name.trim(), req.user!.userId);
  if (avatar !== undefined) db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatar, req.user!.userId);
  const user = db.prepare('SELECT id, name, email, avatar, created_at FROM users WHERE id = ?').get(req.user!.userId);
  res.json(user);
});

export default router;
