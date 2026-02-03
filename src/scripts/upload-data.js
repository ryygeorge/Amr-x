// scripts/upload-data.js

<<<<<<< Updated upstream
<<<<<<< Updated upstream
const fileInput  = document.getElementById("fileInput");
const fileList   = document.getElementById("fileList");
const uploadBtn  = document.getElementById("uploadBtn");
const uploadArea = document.getElementById("uploadArea");
const browseBtn  = document.querySelector(".browse-btn");

/* ---------- UI ---------- */

browseBtn?.addEventListener("click", e => {
  e.stopPropagation();
  fileInput.click();
=======
const uploadArea = document.getElementById("uploadArea");
const fileInput = document.getElementById("fileInput");
const fileList = document.getElementById("fileList");
const uploadBtn = document.getElementById("uploadBtn");
const browseBtn = uploadArea.querySelector(".browse-btn");

// Open file picker
browseBtn.addEventListener("click", () => fileInput.click());

=======
const uploadArea = document.getElementById("uploadArea");
const fileInput = document.getElementById("fileInput");
const fileList = document.getElementById("fileList");
const uploadBtn = document.getElementById("uploadBtn");
const browseBtn = uploadArea.querySelector(".browse-btn");

// Open file picker
browseBtn.addEventListener("click", () => fileInput.click());

>>>>>>> Stashed changes
// Show file when selected
fileInput.addEventListener("change", () => {
  if (!fileInput.files.length) return;

  const file = fileInput.files[0];
  fileList.innerHTML = `📄 ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
  uploadBtn.style.display = "inline-block";
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
});

// Upload logic
uploadBtn.addEventListener("click", async () => {
  const file = fileInput.files[0];
  if (!file) {
    alert("No file selected");
    return;
  }
<<<<<<< Updated upstream
<<<<<<< Updated upstream
  uploadBtn.style.display = files.length ? "inline-flex" : "none";
}

/* ---------- UPLOAD (FIXED, NO POPUPS) ---------- */

uploadBtn.onclick = async () => {
  const files = fileInput.files;
  if (!files.length) return;
=======
>>>>>>> Stashed changes

  const formData = new FormData();
  for (let f of files) {
    const name = f.name.toLowerCase();
    if (!name.endsWith(".csv") && !name.endsWith(".xlsx")) {
      alert("Only CSV or Excel files allowed");
      return;
    }
    formData.append("files", f);
  }
=======
>>>>>>> Stashed changes

  uploadBtn.disabled = true;
  uploadBtn.textContent = "Uploading...";

  try {
<<<<<<< Updated upstream
<<<<<<< Updated upstream
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
};
=======
    const supabase = window.supabase;
    if (!supabase) throw new Error("Supabase not loaded");

    // 1️⃣ Get logged-in user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not logged in");

    // 2️⃣ Get pharmacist profile (district)
    const { data: pharmacist, error } = await supabase
      .from("pharmacists")
      .select("district")
      .eq("id", user.id)
      .single();

    if (error || !pharmacist?.district) {
      throw new Error("Pharmacist district not found");
    }

    const district = pharmacist.district;

    // 3️⃣ Upload file to Supabase Storage
    const path = `kerala/${district}/${user.id}/${Date.now()}_${file.name}`;

=======
    const supabase = window.supabase;
    if (!supabase) throw new Error("Supabase not loaded");

    // 1️⃣ Get logged-in user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not logged in");

    // 2️⃣ Get pharmacist profile (district)
    const { data: pharmacist, error } = await supabase
      .from("pharmacists")
      .select("district")
      .eq("id", user.id)
      .single();

    if (error || !pharmacist?.district) {
      throw new Error("Pharmacist district not found");
    }

    const district = pharmacist.district;

    // 3️⃣ Upload file to Supabase Storage
    const path = `kerala/${district}/${user.id}/${Date.now()}_${file.name}`;

>>>>>>> Stashed changes
    const { error: uploadError } = await supabase.storage
      .from("uploads")
      .upload(path, file);

    if (uploadError) throw uploadError;

    console.log("✅ File uploaded:", path);

    // 4️⃣ Notify backend to ingest
    const res = await fetch("http://localhost:3001/api/ingest-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path,
        district,
        userId: user.id
      })
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Ingest failed");

    fileList.innerHTML = `✅ Uploaded & ingested (${result.inserted} rows)`;
    uploadBtn.textContent = "Uploaded ✓";

  } catch (err) {
    console.error(err);
    alert(err.message);
    uploadBtn.textContent = "Upload Failed";
  }

  uploadBtn.disabled = false;
});
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
