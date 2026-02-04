import crypto from "crypto";
import express from "express";
import { supabase } from "../lib/supabase.js";
import { parseExcel } from "../services/excelParser.js"; // ← adjust path if needed

const router = express.Router();

router.post("/", async (req, res) => {
  const uploadId = crypto.randomUUID();
  const { filePath, district, pharmacistId } = req.body;

  if (!filePath || !district || !pharmacistId) {
    return res.status(400).json({
      error: "Missing filePath, district, or pharmacistId"
    });
  }

  try {
    /* =========================
       1. DOWNLOAD FILE
       ========================= */
    const { data, error } = await supabase
      .storage
      .from("uploads")
      .download(filePath);

    if (error) throw error;

    const buffer = Buffer.from(await data.arrayBuffer());

    /* =========================
       2. PARSE EXCEL (SINGLE SOURCE OF TRUTH)
       ========================= */
    const parsed = await parseExcel(buffer);

    if (!parsed.success) {
      throw new Error(parsed.error);
    }

    if (!parsed.rows.length) {
      throw new Error("No valid antibiogram rows found");
    }

    /* =========================
       3. INSERT UPLOAD METADATA
       ========================= */
    await supabase.from("uploads").insert({
      id: uploadId,
      pharmacist_id: pharmacistId,
      district,
      file_path: filePath,
      file_name: filePath.split("/").pop(),
      status: "stored"
    });

    /* =========================
       4. ENRICH + INSERT PARSED ROWS
       ========================= */
    const enrichedRows = parsed.rows.map(r => ({
      upload_id: uploadId,
      pharmacist_id: pharmacistId,
      district,
      organism: r.organism,
      antibiotic: r.antibiotic,
      result: r.result,
      source_file: filePath
    }));

    const { error: insertError } = await supabase
      .from("parsed_antibiogram_rows")
      .insert(enrichedRows);

    if (insertError) throw insertError;

    /* =========================
       5. MARK UPLOAD AS INGESTED
       ========================= */
    await supabase
      .from("uploads")
      .update({
        status: "ingested",
        row_count: enrichedRows.length
      })
      .eq("id", uploadId);

    res.json({
      ok: true,
      upload_id: uploadId,
      inserted_rows: enrichedRows.length
    });

  } catch (err) {
    await supabase
      .from("uploads")
      .update({
        status: "failed",
        error_message: err.message
      })
      .eq("id", uploadId);

    res.status(400).json({ error: err.message });
  }
});

export default router;
