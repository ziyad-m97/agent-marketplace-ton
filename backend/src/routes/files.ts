import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db';

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuid()}${ext}`);
  },
});

const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB max

export const filesRouter = Router();

// Upload files for a job
filesRouter.post('/upload', upload.array('files', 10), (req: Request, res: Response) => {
  const { job_id, uploaded_by } = req.body;

  if (!job_id || !uploaded_by) {
    res.status(400).json({ error: 'job_id and uploaded_by are required' });
    return;
  }

  const db = getDb();
  const files = req.files as Express.Multer.File[];
  const fileRecords: any[] = [];

  for (const file of files) {
    const id = uuid();
    db.prepare(`
      INSERT INTO files (id, job_id, filename, filepath, uploaded_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, job_id, file.originalname, file.filename, uploaded_by);

    fileRecords.push({ id, filename: file.originalname });
  }

  res.json({ files: fileRecords });
});

// Download a file
filesRouter.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const file = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id) as any;

  if (!file) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  const filepath = path.join(UPLOAD_DIR, file.filepath);
  if (!fs.existsSync(filepath)) {
    res.status(404).json({ error: 'File missing from storage' });
    return;
  }

  res.download(filepath, file.filename);
});
