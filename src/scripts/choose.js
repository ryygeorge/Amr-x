// scripts/choose.js
import { auth } from "./firebase-init.js";
import {
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

const pharmaSignupBtn = document.getElementById("pharmaSignupBtn");
const pharmaLoginBtn  = document.getElementById("pharmaLoginBtn");
// user button has normal link; no JS needed for it
// const userBtn       = document.getElementById("openUserPortalBtn");

let currentUser = null;

// track auth state
onAuthStateChanged(auth, (user) => {
  currentUser = user || null;
});

function go(url) {
  window.location.href = url;
}

// Pharmacist SIGNUP button
pharmaSignupBtn?.addEventListener("click", (e) => {
  e.preventDefault();

  if (currentUser) {
    // already logged in → go straight to pharmacist dashboard
    go("pharma.html");
  } else {
    // not logged in → take to pharmacist-focused signup
    go("signup.html?role=pharma");
  }
});

// Pharmacist LOGIN button
pharmaLoginBtn?.addEventListener("click", (e) => {
  e.preventDefault();

  if (currentUser) {
    // already logged in → skip login page
    go("pharma.html");
  } else {
    // not logged in → take to pharmacist login
    go("login.html?role=pharma");
  }
});
