// scripts/upload-data.js - DISTRICT-BASED UPLOADS
const fileInput = document.getElementById("fileInput");
const fileList = document.getElementById("fileList");
const uploadBtn = document.getElementById("uploadBtn");
const uploadArea = document.getElementById("uploadArea");
const browseBtn = document.querySelector(".browse-btn");

// Get current pharmacist with district
async function getCurrentPharmacist() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.warn('No user logged in');
      return { id: 'anonymous_pharmacist', district: 'unknown' };
    }
    
    // Fetch pharmacist profile
    const { data: pharmacist, error } = await supabase
      .from('pharmacists')
      .select('district, state, country, pharmacy_name')
      .eq('id', user.id)
      .single();
    
    if (error) {
      console.warn('Could not fetch pharmacist profile:', error);
      return { id: user.id, district: 'unknown' };
    }
    
    return {
      id: user.id,
      district: pharmacist.district || 'unknown',
      state: pharmacist.state || 'Kerala',
      country: pharmacist.country || 'India',
      pharmacy_name: pharmacist.pharmacy_name
    };
  } catch (error) {
    console.error('Error getting pharmacist:', error);
    return { id: 'anonymous_pharmacist', district: 'unknown' };
  }
}

/* ---------- UI HANDLERS ---------- */
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

/* ---------- MAIN UPLOAD FUNCTION ---------- */
uploadBtn.onclick = async () => {
  const files = fileInput.files;
  if (!files.length) return;

  uploadBtn.disabled = true;
  uploadBtn.textContent = "Uploading...";
  uploadBtn.classList.remove("upload-success");

  try {
    // Get pharmacist info (with district)
    const pharmacist = await getCurrentPharmacist();
    
    if (pharmacist.id === 'anonymous_pharmacist') {
      throw new Error('Please login to upload data');
    }
    
    if (pharmacist.district === 'unknown') {
      throw new Error('District information not found. Please update your profile.');
    }
    
    // Upload to Supabase Storage with district path
    const result = await uploadToSupabaseStorage(files[0], pharmacist);
    
    if (result.stored) {
      uploadBtn.textContent = "Uploaded ✓";
      uploadBtn.classList.add("upload-success");
      
      fileInput.value = "";
      fileList.innerHTML = "";
      
      // Show success message with district info
      const districtMsg = document.createElement('p');
      districtMsg.className = 'upload-success-msg';
      districtMsg.innerHTML = `✅ File uploaded from <strong>${pharmacist.pharmacy_name}</strong> in <strong>${pharmacist.district}</strong> district`;
      districtMsg.style.marginTop = '15px';
      districtMsg.style.padding = '10px';
      districtMsg.style.background = '#f0f9ff';
      districtMsg.style.borderRadius = '8px';
      fileList.appendChild(districtMsg);
    } else {
      throw new Error('File storage failed');
    }

    setTimeout(() => {
      uploadBtn.textContent = "Upload Files";
      uploadBtn.classList.remove("upload-success");
      uploadBtn.style.display = "none";
      uploadBtn.disabled = false;
    }, 3000);

  } catch (error) {
    console.error('Upload error:', error);
    
    uploadBtn.textContent = "Failed ❌";
    uploadBtn.classList.remove("upload-success");
    
    alert(`Upload failed: ${error.message}`);
    
    setTimeout(() => {
      uploadBtn.textContent = "Upload Files";
      uploadBtn.classList.remove("upload-success");
      uploadBtn.disabled = false;
    }, 3000);
  }
};

/* ---------- SUPABASE UPLOAD WITH DISTRICT ---------- */
async function uploadToSupabaseStorage(file, pharmacist) {
  console.log('Starting district-based upload...');
  
  // Create district-based file path
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 10);
  const fileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  
  // District-based structure
  const filePath = `kerala/${pharmacist.district}/${pharmacist.id}/${timestamp}_${randomId}_${fileName}`;
  
  console.log(`📍 Uploading to district path: ${filePath}`);
  
  if (!window.supabase) {
    throw new Error('Supabase client not loaded');
  }
  
  const supabase = window.supabase;
  
  // 1. Upload to storage ONLY
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('uploads')
    .upload(filePath, file, {
      contentType: file.type,
      upsert: false
    });
  
  if (uploadError) {
    console.error('Storage upload error:', uploadError);
    throw new Error(`Upload failed: ${uploadError.message}`);
  }
  
  console.log('✅ File uploaded to district folder:', uploadData);
  
  // 2. Notify backend (just tell it the file exists)
  try {
    const response = await fetch('http://localhost:3001/api/ingest-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filePath: filePath,
        pharmacistId: pharmacist.id,
        district: pharmacist.district,
        state: pharmacist.state,
        pharmacyName: pharmacist.pharmacy_name,
        fileName: file.name
      })
    });
    
    const result = await response.json();
    console.log('Backend notified:', result);
    
  } catch (backendError) {
    console.warn('Backend notification failed:', backendError);
  }
  
  return { 
    stored: true, 
    processed: true, 
    message: `File stored in ${pharmacist.district} district for ML processing` 
  };
}

// Add CSS for success message
// Add CSS for success message (FIXED COLORS)
// Add CSS for success message - FIXED VERSION
function addSuccessStyles() {
  // Check if style already exists
  if (document.getElementById('upload-success-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'upload-success-styles';
  style.textContent = `
    /* Success button styling */
    .upload-success {
      background-color: #2563eb !important; /* Blue */
      color: white !important;
      border-color: #1d4ed8 !important;
    }
    
    /* Success message box */
    .upload-success-msg {
      background: #1e40af !important; /* Dark blue */
      color: white !important;
      font-size: 14px !important;
      margin-top: 16px !important;
      padding: 14px !important;
      border-radius: 8px !important;
      border: 1px solid #3b82f6 !important;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    
    /* Success icon */
    .success-icon {
      color: #60a5fa !important;
      flex-shrink: 0;
    }
    
    /* Fade animation */
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .upload-success-msg {
      animation: fadeIn 0.5s ease-out;
    }
  `;
  document.head.appendChild(style);
}

// Call this function at the start
addSuccessStyles();