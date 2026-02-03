import express from "express";
import multer from "multer";

const router = express.Router();

// Use memory storage (file handled by Supabase later)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB
});

// Health check
router.get("/test", (req, res) => {
  res.json({ status: "upload route working" });
});

// Upload endpoint
router.post("/", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    res.json({
      success: true,
      filename: req.file.originalname,
      size: req.file.size
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
