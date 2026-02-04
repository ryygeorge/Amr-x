import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";

import ingestUploadRouter from "./routes/ingestUpload.js";
import chatbotRouter from "./routes/chatbot.js";
import analyticsRouter from "./routes/analytics.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "50mb" }));

app.use("/api/ingest-upload", ingestUploadRouter);
app.use("/api/chatbot", chatbotRouter);
app.use("/api/analytics", analyticsRouter);

app.get("/api/health", (req, res) => {
  res.json({ ok: true, status: "AMR-X backend running" });
});

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
});
