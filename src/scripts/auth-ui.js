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

// Helper: ID of placeholder element present in headers (optional)
const PROFILE_PLACEHOLDER_ID = "profilePlaceholder";

// show / hide "Login" / "Sign Up" links in headers (and any .auth-link)
function setAuthLinksVisible(isVisible) {
  const els = document.querySelectorAll(".auth-link");
  els.forEach((el) => {
    el.style.display = isVisible ? "" : "none";
  });
}

// Update landing page buttons depending on auth state
function updateLandingCTAs(isLoggedIn) {
  const heroGetStarted = document.getElementById("heroGetStarted");
  const heroLoginCta = document.getElementById("heroLoginCta");
  const overviewGetStarted = document.getElementById("overviewGetStarted");

  if (heroGetStarted) heroGetStarted.href = isLoggedIn ? "pharma.html" : "choose.html";
  if (overviewGetStarted) overviewGetStarted.href = isLoggedIn ? "pharma.html" : "choose.html";
  if (heroLoginCta) heroLoginCta.style.display = isLoggedIn ? "none" : "";
}

// Inject styles used by the skeleton and interactive profile (positioned absolutely so no layout shift)
function injectProfileStyles() {
  if (styleInjected) return;
  styleInjected = true;

  const style = document.createElement("style");
  style.textContent = `
    /* Profile elements are absolutely positioned so they don't shift header layout */
    #${PROFILE_PLACEHOLDER_ID} {
      position: absolute !important;
      right: 20px;
      top: 50%;
      transform: translateY(-50%);
      pointer-events: none; /* skeleton non-interactive by default */
      display: flex;
      align-items: center;
      min-width: 0;
    }

    .profile-chip {
      display:inline-flex;
      align-items:center;
      gap:8px;
      padding-inline:12px;
      white-space:nowrap;
      cursor:pointer;
      border-radius:999px;
      pointer-events: auto; /* enable when interactive */
      background: transparent;
      border: none;
    }
    .profile-initial {
      width:28px;
      height:28px;
      border-radius:999px;
      background:#020617;
      border:1px solid rgba(148,163,184,0.7);
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:0.9rem;
      font-weight:700;
      color:#e5e7eb;
    }
    .profile-name {
      font-size:0.9rem;
      max-width:120px;
      overflow:hidden;
      text-overflow:ellipsis;
      color:#e5e7eb;
      margin-left:6px;
    }
    .profile-skeleton { opacity:0.95; }
    .profile-menu {
      position:absolute;
      top:60px;
      right:24px;
      min-width:190px;
      padding:10px 12px;
      border-radius:14px;
      background:rgba(15,23,42,0.98);
      border:1px solid rgba(51,65,85,0.9);
      box-shadow:0 18px 40px rgba(15,23,42,1);
      font-size:0.85rem;
      color:#e5e7eb;
      z-index:99;
      display:none;
    }
    .profile-menu-header { margin-bottom:8px; color:#9ca3c9; }
    .profile-menu-header strong { color:#e5e7eb; }
    .profile-logout-btn {
      margin-top:4px;
      width:100%;
      border-radius:999px;
      border:none;
      padding:7px 10px;
      font-size:0.85rem;
      font-weight:600;
      cursor:pointer;
      background:linear-gradient(120deg,#ef4444,#f97373);
      color:#f9fafb;
      box-shadow:0 8px 20px rgba(127,29,29,0.6);
      transition:transform 0.12s ease, box-shadow 0.12s ease;
    }
    .profile-logout-btn:hover { transform: translateY(-1px); box-shadow:0 10px 26px rgba(127,29,29,0.85); }

    /* Fallback: if placeholder missing, the script will append an absolutely positioned wrapper */
    .amrx-profile-fallback {
      position: absolute;
      right: 20px;
      top: 50%;
      transform: translateY(-50%);
      display:flex;
      align-items:center;
      z-index: 60;
    }
  `;
  document.head.appendChild(style);
}

// Remove any existing interactive nodes
function removeExistingProfileNodes() {
  if (profileChip && profileChip.parentElement) profileChip.parentElement.removeChild(profileChip);
  if (profileMenu && profileMenu.parentElement) profileMenu.parentElement.removeChild(profileMenu);
  profileChip = null;
  profileMenu = null;
}

// Render a quick non-interactive skeleton using cached name (very fast)
function renderImmediateSkeleton(cachedName) {
  try {
    injectProfileStyles();

    const firstName = String(cachedName || "User").split(" ")[0];
    const initial = firstName.charAt(0).toUpperCase() || "U";

    // Try to find existing placeholder div. If present, make sure it doesn't affect layout (style injected above).
    let placeholder = document.getElementById(PROFILE_PLACEHOLDER_ID);

    if (!placeholder) {
      // create fallback wrapper (absolutely positioned) so we don't touch header flow
      placeholder = document.createElement("div");
      placeholder.id = PROFILE_PLACEHOLDER_ID;
      placeholder.className = "amrx-profile-fallback";
      // append to body so it's absolutely positioned over header
      document.body.appendChild(placeholder);
    }

    // If there is already a profile chip inside, skip
    if (placeholder.querySelector(".profile-chip")) return;

    // non-interactive skeleton element
    const div = document.createElement("div");
    div.className = "profile-chip profile-skeleton";
    div.setAttribute("aria-hidden", "true");
    div.innerHTML = `<span class="profile-initial">${initial}</span><span class="profile-name">${firstName}</span>`;

    // placeholder is absolutely positioned so this won't affect layout
    placeholder.appendChild(div);

    profileChip = div;
  } catch (e) {
    console.warn("Profile skeleton render failed:", e.message);
  }
}

// Render the full interactive profile UI (or update existing)
function renderProfileUI(displayName) {
  injectProfileStyles();

  if (document.body.dataset.hideProfile === "true") return;

  // Preferred append targets (try topbar or navbar)
  const headerWrapper = document.querySelector(".topbar") || document.querySelector(".navbar");
  const navContainer = document.querySelector(".navbar .nav-right") || document.querySelector(".topbar .landing-nav");

  // Ensure we have a placeholder to append into without disturbing layout
  let placeholder = document.getElementById(PROFILE_PLACEHOLDER_ID);
  if (!placeholder) {
    // Create fallback wrapper attached to headerWrapper if possible; otherwise body
    placeholder = document.createElement("div");
    placeholder.id = PROFILE_PLACEHOLDER_ID;
    placeholder.className = "amrx-profile-fallback";
    // place in headerWrapper if available so absolute coords are more predictable
    if (headerWrapper) headerWrapper.appendChild(placeholder);
    else document.body.appendChild(placeholder);
  }

  // compute display pieces
  const firstName = String(displayName || "User").split(" ")[0];
  const initial = firstName.charAt(0).toUpperCase() || "U";

  // remove any skeleton inside placeholder (we will create interactive chip)
  const existingSkel = placeholder.querySelector(".profile-chip");
  if (existingSkel) placeholder.removeChild(existingSkel);

  // If interactive already exists, just update it
  if (profileChip && profileChip.tagName === "BUTTON") {
    const initEl = profileChip.querySelector(".profile-initial");
    const nameEl = profileChip.querySelector(".profile-name");
    if (initEl) initEl.textContent = initial;
    if (nameEl) nameEl.textContent = firstName;
    return;
  }

  // remove old nodes before creating new ones
  removeExistingProfileNodes();

  // Create interactive chip (button)
  const chip = document.createElement("button");
  chip.type = "button";
  chip.id = "profileChip";
  chip.className = "nav-link profile-chip";
  chip.innerHTML = `<span class="profile-initial">${initial}</span><span class="profile-name">${firstName}</span>`;

  // Ensure chip is interactive: attach to placeholder (which is absolutely positioned)
  placeholder.appendChild(chip);
  profileChip = chip;

  // Create dropdown menu (appended to headerWrapper to keep absolute coords sane)
  const menu = document.createElement("div");
  menu.id = "profileMenu";
  menu.className = "profile-menu";
  menu.innerHTML = `<div class="profile-menu-header">Signed in as<br><strong>${displayName}</strong></div>`;

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

  menu.appendChild(logoutBtn);
  // append menu to headerWrapper (so it's visually inside header area)
  if (headerWrapper) headerWrapper.appendChild(menu);
  else document.body.appendChild(menu);

  profileMenu = menu;

  // Toggle menu on chip click
  chip.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!profileMenu) return;
    const isOpen = profileMenu.style.display === "block";
    profileMenu.style.display = isOpen ? "none" : "block";
  });

  // Close menu when clicking outside
  document.addEventListener("click", (e) => {
    if (!profileMenu || !profileChip) return;
    if (profileMenu.style.display === "block" && !profileMenu.contains(e.target) && !profileChip.contains(e.target)) {
      profileMenu.style.display = "none";
    }
  });
}

function clearProfilePlaceholder() {
  const placeholder = document.getElementById(PROFILE_PLACEHOLDER_ID);
  if (placeholder) placeholder.innerHTML = "";
  removeExistingProfileNodes();
}

// Try to render skeleton immediately from localStorage (fast)
try {
  const cached = localStorage.getItem("pharmaName");
  if (cached) {
    // create skeleton instantly (absolutely positioned, so no layout shift)
    renderImmediateSkeleton(cached);
    // optimistic routing
    const heroGetStarted = document.getElementById("heroGetStarted");
    const overviewGetStarted = document.getElementById("overviewGetStarted");
    if (heroGetStarted) heroGetStarted.href = "pharma.html";
    if (overviewGetStarted) overviewGetStarted.href = "pharma.html";
    // hide auth links early if cached name seems present
    setAuthLinksVisible(false);
  }
} catch (e) {
  console.warn("localStorage read error:", e.message);
}

// Listen for auth state changes
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // logged out → show Login / Sign Up and remove any skeleton/profile
    setAuthLinksVisible(true);
    updateLandingCTAs(false);
    clearProfilePlaceholder();
    return;
  }

  // logged in → ensure auth-links are hidden and GetStarted goes to pharma
  setAuthLinksVisible(false);
  updateLandingCTAs(true);

  // Get display name from Firestore if possible
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

  if (!displayName) displayName = user.email ? user.email.split("@")[0] : "User";

  try {
    localStorage.setItem("pharmaName", displayName);
  } catch (e) {
    console.warn("localStorage error:", e.message);
  }

  renderProfileUI(displayName);
});
