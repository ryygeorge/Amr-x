import xlsx from "xlsx";

/* ---- CONFIG ---- */

const ORGANISM_KEYS = [
  "organism", "bacteria", "species", "strain", "souches"
];

const NON_ANTIBIOTIC_KEYS = [
  "age", "sex", "gender", "hospital", "ward", "notes",
  "date", "collection", "diabetes", "hypertension",
  "infection", "history"
];

const VALID_RESULTS = ["R", "S", "I"];

/* ---- HELPERS ---- */

function norm(x) {
  return String(x || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/* ---- MAIN PARSER ---- */

export function parseAntibiogram(buffer, fallbackOrganism = null) {
  const wb = xlsx.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });

  if (!rows.length) {
    throw new Error("Empty file");
  }

  const headers = Object.keys(rows[0]);
  console.log("🔍 Detected headers:", headers);

  // 1️⃣ Find organism column if present
  const organismKey = headers.find(h =>
    ORGANISM_KEYS.includes(norm(h))
  );

  // 2️⃣ Identify antibiotic columns (wide format)
  const antibioticColumns = headers.filter(h => {
    const n = norm(h);
    return (
      !ORGANISM_KEYS.includes(n) &&
      !NON_ANTIBIOTIC_KEYS.includes(n)
    );
  });

  const observations = [];

  for (const row of rows) {
    const organism =
      row[organismKey] ||
      fallbackOrganism ||
      null;

    if (!organism) continue;

    // WIDE format
    for (const ab of antibioticColumns) {
      const value = String(row[ab]).trim().toUpperCase();
      if (!VALID_RESULTS.includes(value)) continue;

      observations.push({
        organism: String(organism).toUpperCase(),
        antibiotic: ab.toUpperCase(),
        result: value
      });
    }
  }

  if (!observations.length) {
    throw new Error(
      "No valid antibiogram data found (R/S/I values missing or organism absent)"
    );
  }

  return observations;
}
