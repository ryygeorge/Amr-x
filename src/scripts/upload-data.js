// src/scripts/upload-data.js
document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ upload-data.js loaded");

  const fileInput = document.getElementById("fileInput");
  const uploadBtn = document.getElementById("uploadBtn");
  const fileList = document.getElementById("fileList");
  const uploadArea = document.getElementById("uploadArea");
  const browseBtn = document.querySelector(".browse-btn");

  if (!fileInput || !uploadBtn) {
    console.error("❌ Upload elements not found in DOM");
    return;
  }

  /* ---------------- UI HELPERS ---------------- */

  browseBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  uploadArea?.addEventListener("click", () => fileInput.click());

  uploadArea?.addEventListener("dragover", (e) => e.preventDefault());

  uploadArea?.addEventListener("drop", (e) => {
    e.preventDefault();
    fileInput.files = e.dataTransfer.files;
    displayFiles(fileInput.files);
  });

  fileInput.addEventListener("change", () => {
    displayFiles(fileInput.files);
  });

  function displayFiles(files) {
    fileList.innerHTML = "";
    if (!files.length) return;

    for (const f of files) {
      const p = document.createElement("p");
      p.textContent = `📄 ${f.name} (${(f.size / 1024 / 1024).toFixed(2)} MB)`;
      fileList.appendChild(p);
    }

    uploadBtn.style.display = "inline-flex";
    uploadBtn.disabled = false;
  }

  /* ---------------- MAIN UPLOAD ---------------- */

  uploadBtn.addEventListener("click", async () => {
    console.log("🚀 Upload button clicked");

    const file = fileInput.files[0];
    if (!file) {
      alert("Please select a file first");
      return;
    }

    uploadBtn.disabled = true;
    uploadBtn.textContent = "Uploading…";

    try {
      // 1️⃣ Get logged-in user
      const { data: { user }, error: authError } =
        await window.supabase.auth.getUser();

      if (authError || !user) {
        throw new Error("User not logged in");
      }

      // 2️⃣ Get pharmacist profile (district)
      const { data: pharmacist, error: profileError } =
        await window.supabase
          .from("pharmacists")
          .select("district")
          .eq("id", user.id)
          .single();

      if (profileError || !pharmacist?.district) {
        throw new Error("District not found in profile");
      }

      const district = pharmacist.district;

      // 3️⃣ Build storage path
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `kerala/${district}/${user.id}/${Date.now()}_${safeName}`;

      console.log("📤 Uploading to:", path);

      // 4️⃣ Upload to Supabase Storage
      const { error: uploadError } =
        await window.supabase
          .storage
          .from("uploads")
          .upload(path, file);

      if (uploadError) throw uploadError;

      console.log("✅ File uploaded to storage");

      // 5️⃣ Notify backend to ingest
      const res = await fetch("http://localhost:3001/api/ingest-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filePath: path,
          district,
          pharmacistId: user.id   // ✅ THIS WAS MISSING
        })
      });


      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Backend ingest failed: ${t}`);
      }

      const result = await res.json();
      console.log("✅ Ingest result:", result);

      uploadBtn.textContent = "Uploaded ✓";
      uploadBtn.style.background = "#16a34a";

      fileInput.value = "";
      fileList.innerHTML = "";

      setTimeout(() => {
        uploadBtn.textContent = "Upload Files";
        uploadBtn.style.display = "none";
        uploadBtn.disabled = false;
        uploadBtn.style.background = "";
      }, 2500);

    } catch (err) {
      console.error("❌ Upload failed:", err);
      alert(`Upload failed: ${err.message}`);

      uploadBtn.textContent = "Upload Files";
      uploadBtn.disabled = false;
    }
  });
});
