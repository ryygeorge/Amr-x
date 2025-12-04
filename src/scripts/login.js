// scripts/login.js
import { auth, db } from "./firebase-init.js";
import {
  signInWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// URL role hint: ?role=pharma | admin | clinician
const params = new URLSearchParams(window.location.search);
const urlRole = params.get("role"); // "pharma" | "admin" | "clinician" | null

const loginTitle = document.getElementById("loginTitle");
const loginSubtitle = document.getElementById("loginSubtitle");
const signupLink = document.getElementById("signupLink");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");

// Safety: adjust UI text based on ?role=
if (urlRole === "pharma") {
  loginTitle.textContent = "Login to Pharmacist Portal";
  loginSubtitle.textContent =
    "Sign in to see antibiotic usage, resistance trends and stewardship analytics.";
  signupLink.href = "signup.html?role=pharma";
} else if (urlRole === "admin") {
  loginTitle.textContent = "Login to Admin Portal";
  loginSubtitle.textContent =
    "Sign in to manage hospital-wide AMR-X settings, users and reports.";
  signupLink.href = "signup.html?role=admin";
} else if (urlRole === "clinician") {
  loginTitle.textContent = "Login to Clinician Portal";
  loginSubtitle.textContent =
    "Sign in to access clinician-focused AMR views and bedside support.";
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
    const userCred = await signInWithEmailAndPassword(auth, email, password);
    const user = userCred.user;

    // Fetch extra data (including role and name) from Firestore
    const userDocRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userDocRef);

    let storedRole = urlRole || null; // start with URL hint if present
    let displayName = "";

    if (userSnap.exists()) {
      const data = userSnap.data();

      if (data && data.role) {
        storedRole = data.role;
      }

      if (data && (data.name || data.fullName)) {
        displayName = data.name || data.fullName;
      }
    }

    // Fallback displayName if not in Firestore
    if (!displayName) {
      if (user.displayName) {
        displayName = user.displayName;
      } else {
        displayName = email.split("@")[0];
      }
    }

    // Normalize role just for consistency (even though redirect is same)
    let normalizedRole = String(storedRole || "")
      .trim()
      .toLowerCase();

    if (normalizedRole === "pharmacist") {
      normalizedRole = "pharma";
    } else if (normalizedRole === "clinicist") {
      normalizedRole = "clinician";
    }

    if (!normalizedRole) {
      normalizedRole = "clinician"; // default if nothing set
    }

    // Save for greeting on pharma.html
    try {
      localStorage.setItem("pharmaName", displayName);
      localStorage.setItem("role", normalizedRole);
    } catch (err) {
      console.warn("Could not use localStorage:", err.message);
    }

    // ✅ Redirect ALL ROLES to the same pharma portal
    window.location.href = "pharma.html";
  } catch (error) {
    console.error(error);
    let message = "Unable to login. Please check your details.";

    if (error.code === "auth/user-not-found") {
      message = "No account found with this email.";
    } else if (error.code === "auth/wrong-password") {
      message = "Incorrect password.";
    } else if (error.code === "auth/invalid-email") {
      message = "Please enter a valid email address.";
    }

    loginError.textContent = message;
  }
});
