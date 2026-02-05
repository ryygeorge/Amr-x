// scripts/choose.js
import { supabase } from "./supabase-init.js";

const pharmaSignupBtn = document.getElementById("pharmaSignupBtn");
const pharmaLoginBtn = document.getElementById("pharmaLoginBtn");
const userPortalBtn = document.getElementById("openUserPortalBtn");

let currentSession = null;

// Initialize auth state
async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  currentSession = session;
}

// Track auth state changes
supabase.auth.onAuthStateChange((_event, session) => {
  currentSession = session;
});

function go(url) {
  window.location.href = url;
}

// User Portal button (no auth needed - just direct link)
userPortalBtn?.addEventListener("click", (e) => {
  // Direct link to user.html - no auth check needed
  // This will use the href attribute, so we don't need to prevent default
  console.log("Opening User Portal (no authentication required)");
});

// Pharmacist SIGNUP button
pharmaSignupBtn?.addEventListener("click", (e) => {
  e.preventDefault();

  if (currentSession?.user) {
    // Already logged in → go straight to Hospital Pharmacy Dashboard
    go("pharma.html");
  } else {
    // Not logged in → take to pharmacist-focused signup
    go("signup.html?role=pharma");
  }
});

// Pharmacist LOGIN button
pharmaLoginBtn?.addEventListener("click", (e) => {
  e.preventDefault();

  if (currentSession?.user) {
    // Already logged in → skip login page
    go("pharma.html");
  } else {
    // Not logged in → take to pharmacist login
    go("login.html?role=pharma");
  }
});

// Initialize auth on load
initAuth();