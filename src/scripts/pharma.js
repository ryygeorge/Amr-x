import { supabase } from "./supabase-init.js";

console.log("🚀 Pharmacist dashboard booted");

/* ============================
   REAL DATA FETCHER (MINIMAL)
   ============================ */
async function fetchAllRealData() {
  try {
    console.log("🚀 Fetching ALL real data from Supabase...");

    // 1️⃣ ML predictions
    const { data: mlPredictions, error: mlErr } =
      await supabase.from("ml_predictions").select("*");

    if (mlErr) throw mlErr;

    // 2️⃣ District heatmap data
    const { data: districts, error: distErr } =
      await supabase.from("district_resistance_heatmap").select("*");

    if (distErr) throw distErr;

    // 3️⃣ Pharmacist entries
    const { data: entries, error: entryErr } =
      await supabase.from("pharmacist_entries").select("*");

    if (entryErr) throw entryErr;

    console.log("✅ REAL DATA LOADED:");
    console.log("• ML predictions:", mlPredictions.length);
    console.log("• Districts:", districts.length);
    console.log("• Pharmacist entries:", entries.length);

    // 🔥 Connect data to existing UI logic
    if (window.updateHeatmapWithRealData) {
      window.updateHeatmapWithRealData(districts);
    }

  } catch (err) {
    console.error("❌ Failed to fetch real data:", err.message);
  }
}

// ✅ NOW the function exists
fetchAllRealData();
