// scripts/auth-ui.js
import { auth, db } from "./firebase-init.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

let profileChip = null;
let profileMenu = null;
let styleInjected = false;

// Inject small CSS just for the profile chip + menu
function injectProfileStyles() {
  if (styleInjected) return;
  styleInjected = true;

  const style = document.createElement("style");
  style.textContent = `
    .profile-chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding-inline: 12px;
      white-space: nowrap;
    }
    .profile-initial {
      width: 24px;
      height: 24px;
      border-radius: 999px;
      background: #020617;
      border: 1px solid rgba(148,163,184,0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.8rem;
      font-weight: 600;
      color: #e5e7eb;
    }
    .profile-name {
      font-size: 0.85rem;
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
      color: #e5e7eb;
    }
    .profile-menu {
      position: absolute;
      top: 60px;
      right: 24px;
      min-width: 190px;
      padding: 10px 12px;
      border-radius: 14px;
      background: rgba(15,23,42,0.98);
      border: 1px solid rgba(51,65,85,0.9);
      box-shadow: 0 18px 40px rgba(15,23,42,1);
      font-size: 0.85rem;
      color: #e5e7eb;
      z-index: 99;
      display: none;
    }
    .profile-menu-header {
      margin-bottom: 8px;
      color: #9ca3c9;
    }
    .profile-menu-header strong {
      color: #e5e7eb;
    }
    .profile-logout-btn {
      margin-top: 4px;
      width: 100%;
      border-radius: 999px;
      border: none;
      padding: 7px 10px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      background: linear-gradient(120deg,#ef4444,#f97373);
      color: #f9fafb;
      box-shadow: 0 8px 20px rgba(127,29,29,0.6);
      transition: transform 0.12s ease, box-shadow 0.12s ease;
    }
    .profile-logout-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 10px 26px rgba(127,29,29,0.85);
    }
  `;
  document.head.appendChild(style);
}

function destroyProfileUI() {
  if (profileChip && profileChip.parentElement) {
    profileChip.parentElement.removeChild(profileChip);
  }
  if (profileMenu && profileMenu.parentElement) {
    profileMenu.parentElement.removeChild(profileMenu);
  }
  profileChip = null;
  profileMenu = null;
}

// Render profile chip and dropdown
function renderProfileUI(displayName) {
  injectProfileStyles();

  // Do not show profile on pages that opt out
  if (document.body.dataset.hideProfile === "true") return;

  // Find header containers
  const navRight = document.querySelector(".navbar .nav-right");
  const landingNav = document.querySelector(".topbar .landing-nav");
  const container = navRight || landingNav;
  const headerWrapper = document.querySelector(".navbar") || document.querySelector(".topbar");

  if (!container || !headerWrapper) return;

  const firstName = String(displayName || "User").split(" ")[0];
  const initial = firstName.charAt(0).toUpperCase() || "U";

  // If already created, just update text
  if (profileChip) {
    profileChip.querySelector(".profile-initial").textContent = initial;
    profileChip.querySelector(".profile-name").textContent = firstName;
    return;
  }

  // Create chip
  profileChip = document.createElement("button");
  profileChip.type = "button";
  profileChip.id = "profileChip";
  profileChip.className = "nav-link profile-chip";
  profileChip.innerHTML = `
    <span class="profile-initial">${initial}</span>
    <span class="profile-name">${firstName}</span>
  `;

  container.appendChild(profileChip);

  // Create dropdown menu
  profileMenu = document.createElement("div");
  profileMenu.id = "profileMenu";
  profileMenu.className = "profile-menu";
  profileMenu.innerHTML = `
    <div class="profile-menu-header">
      Signed in as<br><strong>${displayName}</strong>
    </div>
  `;

  const logoutBtn = document.createElement("button");
  logoutBtn.className = "profile-logout-btn";
  logoutBtn.textContent = "Logout";

  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Logout error:", e);
    } finally {
      window.location.href = "index.html";
    }
  });

  profileMenu.appendChild(logoutBtn);
  headerWrapper.appendChild(profileMenu);

  // Toggle menu on chip click
  profileChip.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!profileMenu) return;
    const isOpen = profileMenu.style.display === "block";
    profileMenu.style.display = isOpen ? "none" : "block";
  });

  // Close menu when clicking outside
  document.addEventListener("click", (e) => {
    if (!profileMenu || !profileChip) return;
    if (
      profileMenu.style.display === "block" &&
      !profileMenu.contains(e.target) &&
      !profileChip.contains(e.target)
    ) {
      profileMenu.style.display = "none";
    }
  });
}

// Listen for auth state changes
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    destroyProfileUI();
    return;
  }

  // Get nice display name
  let displayName = user.displayName || "";
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
      const data = snap.data();
      if (data.name) displayName = data.name;
    }
  } catch (e) {
    console.warn("Could not fetch Firestore user document:", e.message);
  }

  if (!displayName) {
    displayName = user.email ? user.email.split("@")[0] : "User";
  }

  // Save for pharma greeting
  try {
    localStorage.setItem("pharmaName", displayName);
  } catch (e) {
    console.warn("localStorage error:", e.message);
  }

  renderProfileUI(displayName);
});
