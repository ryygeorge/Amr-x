// scripts/signup.js
import { supabase } from "./supabase-init.js";

// Get elements
const params = new URLSearchParams(window.location.search);
const urlRole = params.get("role");

const roleSelect = document.getElementById("role");
const signupTitle = document.getElementById("signupTitle");
const signupSubtitle = document.getElementById("signupSubtitle");
const loginLink = document.getElementById("loginLink");
const signupForm = document.getElementById("signupForm");
const signupError = document.getElementById("signupError");

// Adjust UI based on ?role=
if (urlRole === "pharma") {
  roleSelect.value = "pharma";
  signupTitle.textContent = "Sign up for the Pharmacist Portal";
  loginLink.href = "login.html?role=pharma";
} else if (urlRole === "admin") {
  roleSelect.value = "admin";
  signupTitle.textContent = "Sign up for the Admin Portal";
  loginLink.href = "login.html?role=admin";
} else if (urlRole === "clinician") {
  roleSelect.value = "clinician";
  signupTitle.textContent = "Sign up for the Clinician Portal";
  loginLink.href = "login.html?role=clinician";
} else {
  loginLink.href = "login.html";
}

// Handle form submit
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  signupError.textContent = "";

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const role = roleSelect.value;
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirm-password").value;

  if (!role) {
    signupError.textContent = "Please select your role.";
    return;
  }

  if (password !== confirmPassword) {
    signupError.textContent = "Passwords do not match.";
    return;
  }

  try {
    // 1) Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name,
          role: role
        },
        emailRedirectTo: `${window.location.origin}/login.html`
      }
    });

    if (authError) throw authError;

    const user = authData.user;

    // 2) Check if email needs confirmation
    const needsConfirmation = !authData.session; // No session = needs confirmation
    
    if (needsConfirmation) {
      // Email confirmation required
      signupError.innerHTML = `
        <div style="background:#0f172a; padding:16px; border-radius:10px; margin:12px 0; border:1px solid #334155;">
          ✅ <strong style="color:#22c55e">Check your email!</strong><br><br>
          We sent a confirmation link to <strong>${email}</strong>.<br>
          <span style="color:#94a3b8; font-size:0.9em;">
            Click the link in your email to activate your account, then come back to login.
          </span>
        </div>
      `;
      signupForm.reset();
      return; // Stop here
    }

    // 3) If email already confirmed (or confirmation disabled), create user profile
    if (user) {
      const { error: dbError } = await supabase
        .from('users')
        .insert([
          {
            id: user.id,
            name: name,
            email: email,
            role: role
          }
        ]);

      if (dbError && !dbError.message.includes('duplicate key')) {
        console.error("User profile creation error:", dbError);
        // Continue anyway - we'll handle in login
      }

      // 4) Save to localStorage
      try {
        localStorage.setItem("pharmaName", name);
        localStorage.setItem("role", role);
      } catch (err) {
        console.warn("localStorage error:", err.message);
      }

      // 5) Redirect to dashboard
      window.location.href = "pharma.html";
    }

  } catch (error) {
    console.error("Signup error:", error);
    
    let message = "Something went wrong. Please try again.";
    
    if (error.message?.includes("User already registered")) {
      message = "An account with this email already exists.";
    } else if (error.message?.includes("invalid")) {
      message = "Please enter a valid email address.";
    } else if (error.message?.includes("weak")) {
      message = "Password is too weak. Try at least 6 characters.";
    }
    
    signupError.textContent = message;
  }
});