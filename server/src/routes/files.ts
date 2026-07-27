import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { requireAuth } from '../auth';
import type { AuthRequest } from '../auth';

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.doc', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error(`File type ${ext} not supported`));
  },
});

const router = Router();

// POST /api/files — upload one or more files
// Fields: file (file), doc_type (sop | transcript | offer_letter | other)
router.post('/', requireAuth, upload.array('files', 10), (req: AuthRequest, res) => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files?.length) {
    res.status(400).json({ error: 'No files uploaded' });
    return;
  }

  const docTypes = Array.isArray(req.body.doc_types)
    ? req.body.doc_types as string[]
    : [req.body.doc_types as string ?? 'other'];

  const inserted = files.map((file, i) => {
    const raw = docTypes[i] ?? 'other';
    const docType = ['sop', 'transcript', 'offer_letter', 'other'].includes(raw) ? raw : 'other';
    const id = uuidv4();
    db.prepare(
      'INSERT INTO uploaded_files (id, user_id, original_name, stored_name, doc_type, size_bytes) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, req.user!.userId, file.originalname, file.filename, docType, file.size);
    return { id, original_name: file.originalname, doc_type: docType, size_bytes: file.size, uploaded_at: new Date().toISOString() };
  });

  res.json(inserted);
});

// GET /api/files — list current user's files
router.get('/', requireAuth, (req: AuthRequest, res) => {
  const files = db.prepare(
    'SELECT id, original_name, doc_type, size_bytes, uploaded_at FROM uploaded_files WHERE user_id = ? ORDER BY uploaded_at DESC'
  ).all(req.user!.userId);
  res.json(files);
});

// DELETE /api/files/:id
router.delete('/:id', requireAuth, (req: AuthRequest, res) => {
  const row = db.prepare('SELECT stored_name FROM uploaded_files WHERE id = ? AND user_id = ?').get(
    req.params.id, req.user!.userId
  ) as { stored_name: string } | undefined;
  if (!row) { res.status(404).json({ error: 'File not found' }); return; }
  const filePath = path.join(UPLOADS_DIR, row.stored_name);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  db.prepare('DELETE FROM uploaded_files WHERE id = ? AND user_id = ?').run(req.params.id, req.user!.userId);
  res.json({ ok: true });
});

// GET /api/files/:id/download
router.get('/:id/download', requireAuth, (req: AuthRequest, res) => {
  const row = db.prepare('SELECT original_name, stored_name FROM uploaded_files WHERE id = ? AND user_id = ?').get(
    req.params.id, req.user!.userId
  ) as { original_name: string; stored_name: string } | undefined;
  if (!row) { res.status(404).json({ error: 'File not found' }); return; }
  res.download(path.join(UPLOADS_DIR, row.stored_name), row.original_name);
});

export default router;
