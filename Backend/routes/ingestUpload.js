import express from "express";
import XLSX from "xlsx";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

/* -------------------- CONSTANTS -------------------- */

// Valid susceptibility values
const RSI_VALUES = ["R", "S", "I"];

// Antibiotic normalization map (expand later)
const ANTIBIOTIC_MAP = {
  CIP: "Ciprofloxacin",
  GEN: "Gentamicin",
  AMX: "Amoxicillin",
  AMC: "Amoxicillin-Clavulanate",
  CTX: "Ceftriaxone",
  CRO: "Ceftriaxone",
  IPM: "Imipenem",
  MEM: "Meropenem",
  VAN: "Vancomycin",
};

// Headers that are NOT antibiotics
const IGNORE_HEADERS = [
  "age",
  "gender",
  "sex",
  "diabetes",
  "hypertension",
  "notes",
  "collection_date",
  "date",
  "hospital_before",
  "infection_freq",
];

/* -------------------- HELPERS -------------------- */

const isRSI = (val) =>
  typeof val === "string" && RSI_VALUES.includes(val.trim().toUpperCase());

const normalizeAntibiotic = (key) => {
  const clean = key.replace(/[^A-Za-z]/g, "").toUpperCase();
  return ANTIBIOTIC_MAP[clean] || clean;
};

const isIgnorableHeader = (header) =>
  IGNORE_HEADERS.includes(header.toLowerCase());

const looksLikeAntibiotic = (header) => {
  if (!header) return false;
  const clean = header.replace(/[^A-Za-z]/g, "");
  return clean.length >= 2 && clean.length <= 6;
};

/* -------------------- CORE NORMALIZER -------------------- */

function normalizeRows(rows, district, sourceFile) {
  if (!rows.length) return [];

  const headers = Object.keys(rows[0]);

  // Detect format
  const hasAntibioticColumn =
    headers.includes("antibiotic") && headers.includes("result");

  const normalized = [];

  /* ---------- LONG FORMAT ---------- */
  if (hasAntibioticColumn) {
    for (const row of rows) {
      if (isRSI(row.result)) {
        normalized.push({
          organism: row.organism || "UNKNOWN",
          antibiotic: normalizeAntibiotic(row.antibiotic),
          result: row.result.toUpperCase(),
          district,
          source_file: sourceFile,
        });
      }
    }
    return normalized;
  }

  /* ---------- WIDE FORMAT ---------- */
  const antibioticColumns = headers.filter(
    (h) => looksLikeAntibiotic(h) && !isIgnorableHeader(h)
  );

  if (!antibioticColumns.length) {
    throw new Error("No antibiotic-like columns found");
  }

  for (const row of rows) {
    const organism =
      row.organism ||
      row.Organism ||
      row.bacteria ||
      row.Bacteria ||
      "UNKNOWN";

    for (const abx of antibioticColumns) {
      if (isRSI(row[abx])) {
        normalized.push({
          organism,
          antibiotic: normalizeAntibiotic(abx),
          result: row[abx].toUpperCase(),
          district,
          source_file: sourceFile,
        });
      }
    }
  }

  return normalized;
}

/* -------------------- INGEST ROUTE -------------------- */

router.post("/ingest-upload", async (req, res) => {
  const { path, district, userId } = req.body;

  if (!path || !district || !userId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  console.log("📥 Ingesting file:", path);

  try {
    /* 1️⃣ Download file */
    const { data, error } = await supabase.storage
      .from("uploads")
      .download(path);

    if (error) throw error;

    const buffer = Buffer.from(await data.arrayBuffer());

    /* 2️⃣ Parse CSV / Excel */
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

    console.log("📄 Rows detected:", rows.length);

    /* 3️⃣ Normalize */
    const observations = normalizeRows(rows, district, path);

    if (!observations.length) {
      throw new Error("No valid AMR observations found");
    }

    console.log(`✅ Normalized ${observations.length} rows`);

    /* 4️⃣ Insert */
    const { error: insertError } = await supabase
      .from("pharmacist_entries")
      .insert(observations);

    if (insertError) throw insertError;

    res.json({
      success: true,
      inserted: observations.length,
    });

  } catch (err) {
    console.error("❌ Ingest error:", err.message);
    res.status(400).json({ error: err.message });
  }
});

export default router;
