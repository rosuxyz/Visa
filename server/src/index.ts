import express from 'express';
import cors from 'cors';
import path from 'path';
import './db'; // initialise DB on startup

import authRoutes from './routes/auth';
import fileRoutes from './routes/files';
import deckRoutes from './routes/decks';
import sessionRoutes from './routes/sessions';
import leaderboardRoutes from './routes/leaderboard';

const app = express();
const PORT = Number(process.env.PORT ?? 4000);

const ALLOWED_ORIGINS = [
  /^http:\/\/localhost(:\d+)?$/,
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // same-origin / curl
    const ok = ALLOWED_ORIGINS.some(p =>
      typeof p === 'string' ? p === origin : p.test(origin)
    );
    cb(ok ? null : new Error('CORS'), ok);
  },
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));

// Static uploads (authenticated via query token not needed — direct download route handles auth)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use('/api/auth',        authRoutes);
app.use('/api/files',       fileRoutes);
app.use('/api/decks',       deckRoutes);
app.use('/api/sessions',    sessionRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

app.get('/api/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

app.listen(PORT, () => {
  console.log(`PassMyVisa API running on http://localhost:${PORT}`);
});
