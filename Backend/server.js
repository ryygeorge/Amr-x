// Minimal AMR-X backend for Pharmacist Entry (Firestore only)
// Run in Backend folder: npm install express cors firebase-admin
// Start: node server.js

const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

// 1) Firebase Admin
const serviceAccount = require('./serviceAccountKey.json'); // keep private
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// 2) Express app + CORS
const app = express();
app.use(express.json());

// Allow Local dev origins to call the API
app.use(cors({
  origin: ['http://127.0.0.1:5500', 'http://localhost:5500', 'http://localhost:8000'],
  methods: ['GET','POST','OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

// 3) Health check
app.get('/api/ping', (_req, res) => res.json({ ok: true, msg: 'AMR-X API alive' }));

// 4) Create Pharmacist Entry
app.post('/api/pharmacist-entry', async (req, res) => {
  try {
    const data = {
      medicinesSold: req.body.medicinesSold || '',
      quantity: Number(req.body.quantity || 0),
      dosage: req.body.dosage || '',
      cured: req.body.cured || '',
      feedback: req.body.feedback || '',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    const doc = await db.collection('pharmacist_entries').add(data);
    res.status(201).json({ ok: true, id: doc.id });
  } catch (e) {
    console.error('POST /api/pharmacist-entry:', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 5) Read recent entries (for dashboard)
app.get('/api/pharmacist-entry', async (_req, res) => {
  try {
    const snap = await db.collection('pharmacist_entries')
      .orderBy('createdAt', 'desc').limit(100).get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ ok: true, data: items });
  } catch (e) {
    console.error('GET /api/pharmacist-entry:', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 6) Optional summary route used by your existing pharma.html fallback
//    This returns static demo data so your page still renders if entries are empty.
app.get('/api/pharma-summary', (_req, res) => {
  res.json({
    totalCases: 182,
    highRisk: 24,
    hospitals: 3,
    bar: {
      labels: ['Jan','Feb','Mar','Apr','May','Jun'],
      datasets: [
        { label: 'Ciprofloxacin', data: [15,23,28,32,25,19], color: '#2463eb' },
        { label: 'Amoxicillin',   data: [21,17,19,18,22,25], color: '#13d3cb' }
      ]
    },
    pie: { labels: ['St Mercy','Green Valley','General Health'], data: [44,33,23], colors: ['#2463eb','#13d3cb','#7fc8f8'] },
    table: [
      { antibiotic: 'Ciprofloxacin', hospital: 'St Mercy',        cases: 72, resistance: '56%' },
      { antibiotic: 'Amoxicillin',   hospital: 'Green Valley',    cases: 48, resistance: '42%' },
      { antibiotic: 'Ceftriaxone',   hospital: 'General Health',  cases: 33, resistance: '35%' },
      { antibiotic: 'Azithromycin',  hospital: 'St Mercy',        cases: 29, resistance: '17%' }
    ]
  });
});

// 7) Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`AMR-X API running at http://localhost:${PORT}`));
