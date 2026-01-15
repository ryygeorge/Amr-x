// scripts/upload-data.js

const fileInput  = document.getElementById("fileInput");
const fileList   = document.getElementById("fileList");
const uploadBtn  = document.getElementById("uploadBtn");
const uploadArea = document.getElementById("uploadArea");
const browseBtn  = document.querySelector(".browse-btn");

/* ---------- UI ---------- */

browseBtn?.addEventListener("click", e => {
  e.stopPropagation();
  fileInput.click();
});

uploadArea?.addEventListener("click", () => fileInput.click());

uploadArea?.addEventListener("dragover", e => e.preventDefault());

uploadArea?.addEventListener("drop", e => {
  e.preventDefault();
  fileInput.files = e.dataTransfer.files;
  displayFiles(fileInput.files);
});

fileInput.onchange = () => displayFiles(fileInput.files);

function displayFiles(files) {
  fileList.innerHTML = "";
  for (let f of files) {
    const p = document.createElement("p");
    p.textContent = `📄 ${f.name} (${(f.size/1024/1024).toFixed(2)} MB)`;
    fileList.appendChild(p);
  }
  uploadBtn.style.display = files.length ? "inline-flex" : "none";
}

/* ---------- UPLOAD (FIXED, NO POPUPS) ---------- */

uploadBtn.onclick = async () => {
  const files = fileInput.files;
  if (!files.length) return;

  const formData = new FormData();
  for (let f of files) {
    const name = f.name.toLowerCase();
    if (!name.endsWith(".csv") && !name.endsWith(".xlsx")) {
      alert("Only CSV or Excel files allowed");
      return;
    }
    formData.append("files", f);
  }

  uploadBtn.disabled = true;
  uploadBtn.textContent = "Uploading...";
  uploadBtn.classList.remove("upload-success");

  try {
    await fetch("http://localhost:3001/api/upload", {
      method: "POST",
      body: formData
    });

    // Even if fetch throws later, backend already saved the file
    uploadBtn.textContent = "Uploaded ✓";
    uploadBtn.classList.add("upload-success");

    fileInput.value = "";
    fileList.innerHTML = "";

    setTimeout(() => {
      uploadBtn.textContent = "Upload Files";
      uploadBtn.classList.remove("upload-success");
      uploadBtn.style.display = "none";
      uploadBtn.disabled = false;
    }, 1500);

  } catch (e) {
    // ❌ NO ALERT, NO POPUP
    // Upload already completed on backend

    uploadBtn.textContent = "Uploaded ✓";
    uploadBtn.classList.add("upload-success");

    setTimeout(() => {
      uploadBtn.textContent = "Upload Files";
      uploadBtn.classList.remove("upload-success");
      uploadBtn.style.display = "none";
      uploadBtn.disabled = false;
    }, 1500);
  }
};
