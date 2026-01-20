// scripts/signup.js - FINAL FIXED VERSION
import { supabase } from "./supabase-init.js";

// Get elements
const signupForm = document.getElementById("signupForm");
const signupError = document.getElementById("signupError");
const signupBtn = document.querySelector(".primary-btn");

// Handle form submit
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  signupError.textContent = "";

  // Get form data
  const fullName = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirm-password").value;
  const phone = document.getElementById("phone")?.value.trim() || "";
  const pharmacyName = document.getElementById("pharmacyName")?.value.trim() || "";
  const districtSelect = document.getElementById("districtSelect");
  const district = districtSelect ? districtSelect.value : "";

  console.log("🔍 DEBUG Form Data:", {
    fullName,
    email,
    pharmacyName,
    district,
    districtSelectExists: !!districtSelect,
    districtValue: districtSelect?.value,
    phone
  });

  // Validation
  if (password !== confirmPassword) {
    signupError.textContent = "Passwords do not match.";
    return;
  }

  if (password.length < 8) {
    signupError.textContent = "Password must be at least 8 characters.";
    return;
  }

  if (!district || district === "") {
    signupError.textContent = "Please select your district.";
    return;
  }

  if (!pharmacyName.trim()) {
    signupError.textContent = "Please enter your pharmacy/clinic name.";
    return;
  }

  if (!fullName.trim()) {
    signupError.textContent = "Please enter your full name.";
    return;
  }

  if (!email.trim()) {
    signupError.textContent = "Please enter your email address.";
    return;
  }

  signupBtn.disabled = true;
  signupBtn.textContent = "Creating account...";

  try {
    console.log("📤 Creating auth user (NO metadata to avoid trigger)...");
    
    // 🔴 CRITICAL CHANGE 1: NO metadata in auth.signUp()
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password
      // NO options.data - this avoids the broken trigger
    });

    if (authError) {
      console.error("Auth error:", authError);
      throw authError;
    }

    const user = authData.user;
    console.log("✅ Auth user created with ID:", user?.id);

    // Wait a moment for auth to settle
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log("💾 Creating pharmacist profile...");
    // 🔴 CRITICAL CHANGE 2: Try with ID first, fallback without
    let profileError = null;
    
    // First try with user ID
    const { error: insertWithIdError } = await supabase
      .from('pharmacists')
      .insert([
        {
          id: user.id,
          email: email,
          full_name: fullName,
          pharmacy_name: pharmacyName,
          district: district,
          phone: phone || null,
          license_number: null,
          is_verified: false,
          state: "Kerala",
          country: "India"
        }
      ]);
    
    profileError = insertWithIdError;
    
    // If that fails due to foreign key constraint, try without ID
    if (profileError && profileError.code === '23503') {
      console.log("🔄 Retrying without ID...");
      const { error: insertWithoutIdError } = await supabase
        .from('pharmacists')
        .insert({
          email: email,
          full_name: fullName,
          pharmacy_name: pharmacyName,
          district: district,
          phone: phone || null,
          license_number: null,
          is_verified: false,
          state: "Kerala",
          country: "India"
        });
      
      profileError = insertWithoutIdError;
    }

    if (profileError) {
      console.error("Database error details:", profileError);
      
      // Show detailed error message
      if (profileError.code === '23502') {
        signupError.textContent = "Missing required information. Please check all fields.";
      } else if (profileError.code === '23505') {
        signupError.textContent = "Email already registered. Please use a different email or login.";
      } else {
        signupError.textContent = `Database error: ${profileError.message}`;
      }
      
      // Try to rollback auth user
      try {
        await supabase.auth.admin.deleteUser(user.id);
        console.log("↩️ Rollback: Auth user deleted");
      } catch (rollbackError) {
        console.warn("Could not delete auth user:", rollbackError);
      }
      
      throw profileError;
    }

    console.log("✅ Pharmacist profile created");

    // 🔴 CRITICAL CHANGE 3: Update auth metadata AFTER successful insert
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          name: fullName,
          role: 'pharmacist',
          pharmacy_name: pharmacyName,
          district: district
        }
      });
      
      if (updateError) {
        console.warn("Could not update auth metadata (not critical):", updateError);
      } else {
        console.log("✅ Auth metadata updated");
      }
    } catch (updateError) {
      console.warn("Auth metadata update failed (not critical):", updateError);
    }

    // Store user data for greeting
    localStorage.setItem("pharmaName", fullName);
    localStorage.setItem("userName", fullName);
    localStorage.setItem("pharmacyName", pharmacyName);
    localStorage.setItem("district", district);

    // Show success message
    signupError.innerHTML = `
      <div style="background:rgba(16, 185, 129, 0.1); padding:16px; border-radius:10px; margin:12px 0; border:1px solid rgba(16, 185, 129, 0.3);">
        ✅ <strong style="color:#10b981">Account Created Successfully!</strong><br><br>
        Welcome to AMR-X Kerala, <strong>${fullName.split(' ')[0]}</strong>!<br>
        <span style="color:#94a3b8; font-size:0.9em;">
          Account created for <strong>${pharmacyName}</strong> in <strong>${district}</strong> district.<br><br>
          Please check your email at <strong>${email}</strong> to verify your account, then login.
        </span>
        <br><br>
        <a href="login.html?role=pharma" style="background:#3b82f6; color:white; padding:8px 16px; border-radius:6px; text-decoration:none; display:inline-block;">
          Go to Login
        </a>
      </div>
    `;
    
    signupBtn.textContent = "Account Created ✓";
    signupBtn.classList.add("upload-success");
    signupForm.reset();

    console.log("🎉 Signup process completed successfully");

  } catch (error) {
    console.error("❌ Signup error:", error);
    
    let message = "Something went wrong. Please try again.";
    
    if (error.message?.includes("User already registered")) {
      message = "An account with this email already exists. Please login instead.";
    } else if (error.message?.includes("invalid") || error.code === 'invalid_email') {
      message = "Please enter a valid email address.";
    } else if (error.message?.includes("weak") || error.code === 'weak_password') {
      message = "Password is too weak. Try at least 8 characters with letters and numbers.";
    } else if (error.message?.includes("rate limit")) {
      message = "Too many attempts. Please try again in a few minutes.";
    } else if (error.message?.includes("Database error saving new user")) {
      message = "System error. Please try a different email or contact support.";
    }
    
    signupError.textContent = message;
    signupBtn.textContent = "Create Account";
    signupBtn.disabled = false;
    signupBtn.classList.remove("upload-success");
  }
});

// Password confirmation check
document.getElementById("confirm-password")?.addEventListener("input", function() {
  const password = document.getElementById("password").value;
  const confirmPassword = this.value;
  const errorEl = document.getElementById("signupError");
  
  if (confirmPassword && password !== confirmPassword) {
    errorEl.textContent = "Passwords do not match";
  } else if (errorEl.textContent === "Passwords do not match") {
    errorEl.textContent = "";
  }
});

// Debug: Check HTML element on page load
document.addEventListener("DOMContentLoaded", () => {
  const districtSelect = document.getElementById("districtSelect");
  console.log("📍 District select element on load:", districtSelect);
  console.log("📍 District select value:", districtSelect?.value);
  console.log("📍 District select options:", districtSelect?.options?.length);
  
  if (districtSelect) {
    districtSelect.addEventListener("change", () => {
      console.log("District changed to:", districtSelect.value);
    });
  }
});