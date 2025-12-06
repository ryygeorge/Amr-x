// scripts/signup.js
import { auth, db } from "./firebase-init.js";
import {
  createUserWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  doc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Get elements
const params = new URLSearchParams(window.location.search);
const urlRole = params.get("role"); // "pharma" | "admin" | "clinician" | nu=-----------------------------------------------------------------------------------------]1 


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
  signupSubtitle.textContent =
    "Create an AMR-X account tailored to pharmacy and stewardship analytics.";
  loginLink.href = "login.html?role=pharma";
} else if (urlRole === "admin") {
  roleSelect.value = "admin";
  signupTitle.textContent = "Sign up for the Admin Portal";
  signupSubtitle.textContent =
    "Create an AMR-X admin account to manage users, hospitals and reports.";
  loginLink.href = "login.html?role=admin";
} else if (urlRole === "clinician") {
  roleSelect.value = "clinician";
  signupTitle.textContent = "Sign up for the Clinician Portal";
  signupSubtitle.textContent =
    "Create an AMR-X account focused on clinician and bedside workflows.";
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
    // Create auth user
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCred.user;

    // Store extra data in Firestore
    await setDoc(doc(db, "users", user.uid), {
      name,
      email,
      role,            // 'pharma', 'admin', or 'clinician'
      createdAt: serverTimestamp(),
    });

    // Optional: store for greeting later
    try {
      localStorage.setItem("pharmaName", name);
      localStorage.setItem("role", role);
    } catch (err) {
      console.warn("localStorage not available:", err.message);
    }

    // ✅ Redirect ALL roles to the same portal
    window.location.href = "pharma.html";
  } catch (error) {
    console.error(error);
    let message = "Something went wrong. Please try again.";

    if (error.code === "auth/email-already-in-use") {
      message = "An account with this email already exists.";
    } else if (error.code === "auth/invalid-email") {
      message = "Please enter a valid email address.";
    } else if (error.code === "auth/weak-password") {
      message = "Password is too weak. Try at least 6+ characters.";
    }

    signupError.textContent = message;
  }
});
