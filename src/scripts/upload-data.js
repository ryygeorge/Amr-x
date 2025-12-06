// scripts/upload-data.js
import { db, auth } from "./firebase-init.js";
import {
  collection,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import * as XLSX from "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm";

// --- DOM elements ---
const fileInput = document.getElementById("fileInput");
const fileList  = document.getElementById("fileList");
const uploadBtn = document.getElementById("uploadBtn");
const uploadArea = document.getElementById("uploadArea");
const browseBtn = document.querySelector(".browse-btn");

// --- UI wiring (same behaviour as before) ---
browseBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  fileInput.click();
});

uploadArea?.addEventListener("click", () => {
  fileInput.click();
});

fileInput.onchange = () => displayFiles(fileInput.files);

function displayFiles(files) {
  fileList.innerHTML = "";
  for (let f of files) {
    const p = document.createElement("p");
    p.textContent = `📄 ${f.name} (${(f.size / 1024).toFixed(1)} KB)`;
    fileList.appendChild(p);
  }
  uploadBtn.style.display = files.length ? "inline-flex" : "none";
}

// --- Helpers to read & parse files ---

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// very simple CSV parser (no fancy quoted commas)
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (!lines.length) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h || `col_${idx}`] = (parts[idx] ?? "").trim();
    });
    rows.push(obj);
  }

  return rows;
}

async function parseXlsx(file) {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  return rows;
}

// --- Firestore write: store for ML later ---
// uploads collection -> one doc per file
// each file doc -> subcollection "rows" with each row as a doc
async function storeFileDataInFirestore(file, rows) {
  const uploadsCol = collection(db, "mlUploads"); // name it whatever you want

  const uploadDocRef = await addDoc(uploadsCol, {
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || null,
    rowCount: rows.length,
    uploadedAt: serverTimestamp(),
    uploaderUid: auth.currentUser ? auth.currentUser.uid : null,
  });

  const rowsCol = collection(uploadDocRef, "rows");

  // naive: one write per row (fine for small/medium files)
  for (const row of rows) {
    await addDoc(rowsCol, row);
  }

  return {
    id: uploadDocRef.id,
    rowCount: rows.length,
  };
}

// --- Upload button handler ---
uploadBtn.onclick = async () => {
  const files = fileInput.files;
  if (!files.length) return;

  // validate types
  for (let f of files) {
    const name = f.name.toLowerCase();
    if (!name.endsWith(".csv") && !name.endsWith(".xlsx")) {
      alert("Only CSV and Excel (.xlsx) files are allowed.");
      return;
    }
  }

  uploadBtn.disabled = true;
  uploadBtn.textContent = "Uploading...";

  const storedFiles = [];

  try {
    for (let file of files) {
      const lower = file.name.toLowerCase();

      let rows = [];
      if (lower.endsWith(".csv")) {
        const text = await readFileAsText(file);
        rows = parseCsv(text);
      } else if (lower.endsWith(".xlsx")) {
        rows = await parseXlsx(file);
      }

      if (!rows.length) {
        console.warn(`No rows parsed from ${file.name}`);
        continue;
      }

      const info = await storeFileDataInFirestore(file, rows);
      storedFiles.push({ name: file.name, rows: info.rowCount });
    }

    if (!storedFiles.length) {
      alert("No valid data found to store.");
    } else {
      const summary = storedFiles
        .map((f) => `${f.name} (${f.rows} rows)`)
        .join("\n");
      alert("Uploaded & stored in database:\n" + summary);
    }

    fileList.innerHTML = "";
    uploadBtn.style.display = "none";
    fileInput.value = "";

  } catch (err) {
    console.error(err);
    alert("Upload failed: " + err.message);
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.textContent = "Upload Files";
  }
};
