// Backend/server.js - MINIMAL WORKING VERSION
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Create uploads directory
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Configure multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^\w.\-]/g, '_');
    cb(null, Date.now() + '-' + safeName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 100 }, // 100MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.csv', '.xlsx', '.xls', '.pdf'];
    if (!allowed.includes(ext)) {
      return cb(new Error('Only CSV, Excel, and PDF files allowed'));
    }
    cb(null, true);
  }
});

// Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    ok: true, 
    message: 'AMR-X Backend Running',
    timestamp: new Date().toISOString()
  });
});

app.post('/api/upload', upload.array('files'), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ ok: false, msg: 'No files uploaded' });
    }

    const files = req.files.map(file => ({
      id: Date.now() + Math.random(),
      name: file.originalname,
      size: file.size,
      storedAs: file.filename,
      path: file.path
    }));

    console.log('Files uploaded:', files);
    
    res.json({
      ok: true,
      message: `Successfully uploaded ${files.length} file(s)`,
      files: files
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ ok: false, msg: error.message });
  }
});

// Error handling
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ ok: false, msg: `File error: ${err.message}` });
  }
  res.status(500).json({ ok: false, msg: err.message });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ AMR-X Backend running on http://localhost:${PORT}`);
  console.log(`📤 Upload endpoint: POST http://localhost:${PORT}/api/upload`);
  console.log(`🩺 Health check: GET http://localhost:${PORT}/api/health`);
});