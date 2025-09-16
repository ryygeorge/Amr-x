const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure multer for file uploads (destination /uploads)
const upload = multer({ dest: 'uploads/' });

// Serve static frontend files (adjust path to your src folder)
app.use(express.static(path.join(__dirname, '../src')));

// API endpoint for pharmacist entry form submission
app.post('/api/pharmacist-entry', (req, res) => {
  const data = req.body;
  console.log('Pharmacist Entry Data:', data);
  // Here, save data to database or file
  res.status(200).json({ message: 'Pharmacist data received successfully' });
});

// API endpoint for file upload
app.post('/api/upload', upload.array('files'), (req, res) => {
  console.log('Files uploaded:', req.files);
  // Process files as needed
  res.status(200).json({ message: 'Files uploaded successfully' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
