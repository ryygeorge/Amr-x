// scripts/login.js - UPDATED FOR PHARMACIST SYSTEM
import { supabase } from "./supabase-init.js";

const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");

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

    // 2) Check if user is a pharmacist
    let pharmacistProfile = null;
    const { data: profileData, error: profileError } = await supabase
      .from('pharmacists')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (!profileError && profileData) {
      pharmacistProfile = profileData;
    }

    // 3) If not a pharmacist, check users table (for backwards compatibility)
    if (!pharmacistProfile) {
      const { data: userProfile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      
      // If user exists in old system, migrate to pharmacists table
      if (userProfile) {
        const { error: migrateError } = await supabase
          .from('pharmacists')
          .insert([
            {
              id: user.id,
              email: user.email,
              full_name: userProfile.name || user.user_metadata?.name,
              pharmacy_name: "Unknown Pharmacy",
              district: "Unknown",
              state: "Kerala",
              country: "India",
              is_verified: false
            }
          ]);
        
        if (!migrateError) {
          pharmacistProfile = { 
            full_name: userProfile.name,
            pharmacy_name: "Unknown Pharmacy",
            district: "Unknown" 
          };
        }
      }
    }

    // 4) Get display name and store data
    const displayName = pharmacistProfile?.full_name || 
                       user.user_metadata?.name || 
                       email.split("@")[0];
    
    const pharmacyName = pharmacistProfile?.pharmacy_name || "Unknown Pharmacy";
    const district = pharmacistProfile?.district || "Unknown";

    // Store in localStorage for greeting
    localStorage.setItem("pharmaName", displayName);
    localStorage.setItem("userName", displayName);
    localStorage.setItem("pharmacyName", pharmacyName);
    localStorage.setItem("district", district);

    // 5) Redirect to dashboard
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