// Backend/server.js - UPDATED VERSION
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json());

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5500', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// Import routes
const ingestUploadRoute = require('./routes/ingestUpload');

// Routes
app.use('/api', ingestUploadRoute);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    ok: true, 
    message: 'AMR-X Backend Running (Supabase Storage Mode)',
    timestamp: new Date().toISOString(),
    storage_mode: 'supabase_cloud',
    routes: [
      'POST /api/ingest-upload',
      'GET  /api/health'
    ]
  });
});

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ ok: false, msg: 'Route not found' });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    ok: false, 
    msg: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, () => {
  console.log(`\n✅ AMR-X Backend running on http://localhost:${PORT}`);
  console.log(`📤 Ingest endpoint: POST http://localhost:${PORT}/api/ingest-upload`);
  console.log(`🩺 Health check: GET http://localhost:${PORT}/api/health`);
  console.log(`🚫 Local storage: DISABLED (Using Supabase Storage)`);
  console.log(`📁 Backend mode: API Only (No file storage)\n`);
});