// scripts/upload-data.js
import { db, auth, storage } from "./firebase-init.js";
import {
  collection,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-storage.js";

// DOM elements
const fileInput  = document.getElementById("fileInput");
const fileList   = document.getElementById("fileList");
const uploadBtn  = document.getElementById("uploadBtn");
const uploadArea = document.getElementById("uploadArea");
const browseBtn  = document.querySelector(".browse-btn");

/* ---------- UI WIRING ---------- */

// open picker from button
browseBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  fileInput.click();
});

// open picker from area click
uploadArea?.addEventListener("click", () => {
  fileInput.click();
});

// drag & drop support
uploadArea?.addEventListener("dragover", (e) => {
  e.preventDefault();
});

uploadArea?.addEventListener("drop", (e) => {
  e.preventDefault();
  if (!e.dataTransfer?.files?.length) return;
  fileInput.files = e.dataTransfer.files;
  displayFiles(fileInput.files);
});

// display selected files
fileInput.onchange = () => displayFiles(fileInput.files);

function displayFiles(files) {
  fileList.innerHTML = "";
  for (let f of files) {
    const p = document.createElement("p");
    p.textContent = `📄 ${f.name} (${(f.size / 1024 / 1024).toFixed(2)} MB)`;
    fileList.appendChild(p);
  }
  uploadBtn.style.display = files.length ? "inline-flex" : "none";
}

/* ---------- HELPERS ---------- */

// Upload one file to Firebase Storage with progress callback
function uploadFileToStorage(file, uid, onProgress) {
  return new Promise((resolve, reject) => {
    const safeName = file.name.replace(/[^\w.\-]/g, "_");
    const path = `ml-uploads/${uid}/${Date.now()}-${safeName}`;
    const storageRef = ref(storage, path);

    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        if (onProgress) {
          const pct = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          onProgress(pct);
        }
      },
      (error) => reject(error),
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({ path, downloadURL });
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}

/* ---------- MAIN UPLOAD HANDLER ---------- */

uploadBtn.onclick = async () => {
  const files = fileInput.files;
  if (!files.length) return;

  if (!auth.currentUser) {
    alert("Please log in before uploading data.");
    return;
  }

  // allow only CSV & XLSX, and put a max size guard (frontend only)
  const MAX_SIZE = 1024 * 1024 * 1024; // 1 GB per file (adjust if you want)
  for (let f of files) {
    const name = f.name.toLowerCase();
    if (!name.endsWith(".csv") && !name.endsWith(".xlsx")) {
      alert("Only CSV and Excel (.xlsx) files are allowed.");
      return;
    }
    if (f.size > MAX_SIZE) {
      alert(
        `"${f.name}" is too large (${(f.size / 1024 / 1024).toFixed(
          1
        )} MB). Please upload files smaller than 1 GB for now.`
      );
      return;
    }
  }

  uploadBtn.disabled = true;
  uploadBtn.textContent = "Uploading… 0%";
  uploadBtn.classList.remove("upload-success");

  const uploadedFiles = [];

  try {
    for (let file of files) {
      // 1) Upload to Storage with progress
      const { path, downloadURL } = await uploadFileToStorage(
        file,
        auth.currentUser.uid,
        (pct) => {
          uploadBtn.textContent = `Uploading… ${pct.toFixed(0)}%`;
        }
      );

      // 2) Create metadata doc in Firestore for ML/backend
      const docRef = await addDoc(collection(db, "mlUploads"), {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || null,
        storagePath: path,
        downloadURL,
        status: "uploaded",       // later ML can change to 'processing' / 'ready'
        uploadedAt: serverTimestamp(),
        uploaderUid: auth.currentUser.uid,
      });

      uploadedFiles.push({
        name: file.name,
        id: docRef.id,
      });
    }

    if (!uploadedFiles.length) {
      alert("No files were uploaded.");
    } else {
      const summary = uploadedFiles
        .map((f) => `${f.name} (doc id: ${f.id})`)
        .join("\n");
      alert("Files uploaded successfully:\n" + summary);
    }

    // Clear selection
    fileList.innerHTML = "";
    fileInput.value = "";

    // success state
    uploadBtn.disabled = false;
    uploadBtn.textContent = "Uploaded ✔";
    uploadBtn.classList.add("upload-success");

    setTimeout(() => {
      uploadBtn.textContent = "Upload Files";
      uploadBtn.classList.remove("upload-success");
      uploadBtn.style.display = "none";
    }, 1500);
  } catch (err) {
    console.error(err);
    alert("Upload failed: " + err.message);
    uploadBtn.disabled = false;
    uploadBtn.textContent = "Upload Files";
    uploadBtn.classList.remove("upload-success");
  }
};
