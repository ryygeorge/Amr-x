// scripts/login.js
import { supabase } from "./supabase-init.js";

// URL role hint: ?role=pharma | admin | clinician
const params = new URLSearchParams(window.location.search);
const urlRole = params.get("role");

const loginTitle = document.getElementById("loginTitle");
const loginSubtitle = document.getElementById("loginSubtitle");
const signupLink = document.getElementById("signupLink");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");

// Role-based UI text
if (urlRole === "pharma") {
  loginTitle.textContent = "Login to Pharmacist Portal";
  signupLink.href = "signup.html?role=pharma";
} else if (urlRole === "admin") {
  loginTitle.textContent = "Login to Admin Portal";
  signupLink.href = "signup.html?role=admin";
} else if (urlRole === "clinician") {
  loginTitle.textContent = "Login to Clinician Portal";
  signupLink.href = "signup.html?role=clinician";
} else {
  signupLink.href = "signup.html";
}

// Handle login
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    // 1) Sign in
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) throw authError;

    const user = authData.user;
    
    if (!user) {
      throw new Error("No user returned from authentication");
    }

    // 2) Check if user exists in our users table
    let userProfile = null;
    const { data: profileData, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle(); // Use maybeSingle instead of single to avoid throwing if not found

    if (!profileError && profileData) {
      userProfile = profileData;
    }

    // 3) If user doesn't exist in users table, create it automatically
    if (!userProfile) {
      const displayName = user.user_metadata?.name || email.split("@")[0];
      const userRole = user.user_metadata?.role || urlRole || "clinician";
      
      // Normalize role
      let normalizedRole = String(userRole).trim().toLowerCase();
      if (normalizedRole === "pharmacist") normalizedRole = "pharma";
      if (normalizedRole === "clinicist") normalizedRole = "clinician";
      if (!normalizedRole) normalizedRole = "clinician";
      
      // Insert user profile
      const { error: insertError } = await supabase
        .from('users')
        .insert([
          {
            id: user.id,
            name: displayName,
            email: user.email,
            role: normalizedRole
          }
        ])
        .select()
        .single();
      
      if (!insertError) {
        userProfile = { name: displayName, role: normalizedRole };
      } else if (insertError.code === '23505') {
        // Duplicate key - user already exists, fetch it
        const { data: existingUser } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();
        if (existingUser) userProfile = existingUser;
      }
    }

    // 4) Get final user data
    const displayName = userProfile?.name || user.user_metadata?.name || email.split("@")[0];
    const userRole = userProfile?.role || user.user_metadata?.role || urlRole || "clinician";
    
    // Normalize role again for safety
    let normalizedRole = String(userRole).trim().toLowerCase();
    if (normalizedRole === "pharmacist") normalizedRole = "pharma";
    if (normalizedRole === "clinicist") normalizedRole = "clinician";
    if (!normalizedRole) normalizedRole = "clinician";

    // 5) Save to localStorage
    try {
      localStorage.setItem("pharmaName", displayName);
      localStorage.setItem("role", normalizedRole);
    } catch (err) {
      console.warn("localStorage error:", err.message);
    }

    // 6) Redirect
    window.location.href = "pharma.html";

  } catch (error) {
    console.error("Login error:", error);
    
    let message = "Unable to login. Please check your details.";
    
    if (error.message?.includes("Invalid login credentials")) {
      message = "Invalid email or password.";
    } else if (error.message?.includes("Email not confirmed")) {
      message = `
        <div style="background:#0f172a; padding:12px; border-radius:8px; margin:10px 0;">
          <strong>Email not confirmed!</strong><br>
          Please check your email and click the confirmation link first.
          <br><br>
          <button onclick="location.reload()" style="background:#3b82f6; color:white; border:none; padding:8px 16px; border-radius:6px; cursor:pointer;">
            Try Again
          </button>
        </div>
      `;
    } else if (error.message?.includes("User not found")) {
      message = "No account found with this email.";
    }
    
    loginError.innerHTML = message;
  }
});