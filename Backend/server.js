// AMR-X Backend – FINAL (Express 5 compatible)

const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

/* ---------------- FIREBASE ADMIN ---------------- */
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

/* ---------------- EXPRESS APP ---------------- */
const app = express();
app.use(express.json());

/* ---------------- CORS (FIXED FOR EXPRESS 5) ---------------- */
app.use(cors({
  origin: true,
}));



/* ---------------- FILE UPLOAD SETUP ---------------- */
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^\w.\-]/g, '_');
    cb(null, Date.now() + '-' + safe);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    if (!name.endsWith('.csv') && !name.endsWith('.xlsx')) {
      return cb(new Error('Only CSV and XLSX files allowed'));
    }
    cb(null, true);
  },
});

/* ---------------- ROUTES ---------------- */

// Health check
app.get('/api/ping', (_req, res) => {
  res.json({ ok: true, msg: 'AMR-X API running' });
});

// Upload route
app.post('/api/upload', upload.array('files'), async (req, res) => {
  try {
    if (!req.files || !req.files.length) {
      return res.status(400).json({ ok: false, msg: 'No files uploaded' });
    }

    const saved = [];

    for (const file of req.files) {
      const doc = await db.collection('mlUploads').add({
        originalName: file.originalname,
        storedName: file.filename,
        size: file.size,
        path: file.path,
        status: 'uploaded',
        uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      saved.push({
        id: doc.id,
        name: file.originalname,
      });
    }

    res.json({ ok: true, files: saved });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ---------------- START SERVER ---------------- */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ AMR-X API running at http://localhost:${PORT}`);
});
