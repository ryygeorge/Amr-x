import express from "express";
import XLSX from "xlsx";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

const RSI = ["R", "S", "I"];

const IGNORE_HEADERS = [
  "age", "sex", "gender", "notes", "date",
  "diabetes", "hypertension", "collection_date"
];

const ANTIBIOTIC_MAP = {
  CIP: "Ciprofloxacin",
  GEN: "Gentamicin",
  AMK: "Amikacin",
  AMC: "Amoxicillin-Clavulanate",
  CRO: "Ceftriaxone",
  CTX: "Ceftriaxone",
  MEM: "Meropenem",
  IPM: "Imipenem"
};

const isRSI = v =>
  typeof v === "string" && RSI.includes(v.trim().toUpperCase());

const normalizeAntibiotic = key => {
  const clean = key.replace(/[^A-Za-z]/g, "").toUpperCase();
  return ANTIBIOTIC_MAP[clean] || clean;
};

const looksLikeAntibiotic = h => {
  const c = h.replace(/[^A-Za-z]/g, "");
  return c.length >= 2 && c.length <= 6;
};

function normalizeRows(rows, district, sourceFile) {
  const headers = Object.keys(rows[0]);
  const isLong =
    headers.includes("antibiotic") && headers.includes("result");

  const out = [];

  if (isLong) {
    for (const r of rows) {
      if (isRSI(r.result)) {
        out.push({
          organism: r.organism || "UNKNOWN",
          antibiotic: normalizeAntibiotic(r.antibiotic),
          result: r.result.toUpperCase(),
          district,
          source_file: sourceFile
        });
      }
    }
    return out;
  }

  const abxCols = headers.filter(
    h => looksLikeAntibiotic(h) && !IGNORE_HEADERS.includes(h.toLowerCase())
  );

  for (const r of rows) {
    const organism =
      r.organism || r.Organism || r.bacteria || "UNKNOWN";

    for (const abx of abxCols) {
      if (isRSI(r[abx])) {
        out.push({
          organism,
          antibiotic: normalizeAntibiotic(abx),
          result: r[abx].toUpperCase(),
          district,
          source_file: sourceFile
        });
      }
    }
  }

  return out;
}

router.post("/", async (req, res) => {
  const { filePath, district } = req.body;

  if (!filePath || !district) {
    return res.status(400).json({ error: "Missing filePath or district" });
  }

  try {
    const { data, error } = await supabase
      .storage
      .from("uploads")
      .download(filePath);

    if (error) throw error;

    const buffer = Buffer.from(await data.arrayBuffer());

    const wb = XLSX.read(buffer, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

    const records = normalizeRows(rows, district, filePath);

    if (!records.length) {
      throw new Error("No valid R/S/I values found");
    }

    const { error: insertError } = await supabase
      .from("pharmacist_entries")
      .insert(records);

    if (insertError) throw insertError;

    res.json({ ok: true, inserted: records.length });

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
