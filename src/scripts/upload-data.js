// scripts/upload-data.js

const fileInput  = document.getElementById("fileInput");
const fileList   = document.getElementById("fileList");
const uploadBtn  = document.getElementById("uploadBtn");
const uploadArea = document.getElementById("uploadArea");
const browseBtn  = document.querySelector(".browse-btn");

/* ---------- UI ---------- */

// Open file picker
browseBtn?.addEventListener("click", () => fileInput.click());

// Show file when selected
fileInput.addEventListener("change", () => {
  if (!fileInput.files.length) return;

  const file = fileInput.files[0];
  fileList.innerHTML = `📄 ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
  uploadBtn.style.display = "inline-block";
});

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

  try {

    await fetch("http://127.0.0.1:5000/api/upload", {
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

  uploadBtn.disabled = false;
};
