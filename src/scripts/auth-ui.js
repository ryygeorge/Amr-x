// scripts/auth-ui.js
import { supabase } from "./supabase-init.js";

/* =========================
   STATE & CONSTANTS
========================= */

let profileChip = null;
let profileMenu = null;
let styleInjected = false;

const PROFILE_PLACEHOLDER_ID = "profilePlaceholder";

/* =========================
   AUTH UI HELPERS
========================= */

function setAuthLinksVisible(isVisible) {
  document.querySelectorAll(".auth-link").forEach(el => {
    el.style.display = isVisible ? "" : "none";
  });
}

function updateLandingCTAs(isLoggedIn) {
  const heroGetStarted = document.getElementById("heroGetStarted");
  const overviewGetStarted = document.getElementById("overviewGetStarted");
  const heroLoginCta = document.getElementById("heroLoginCta");

  if (heroGetStarted) heroGetStarted.href = isLoggedIn ? "pharma.html" : "choose.html";
  if (overviewGetStarted) overviewGetStarted.href = isLoggedIn ? "pharma.html" : "choose.html";
  if (heroLoginCta) heroLoginCta.style.display = isLoggedIn ? "none" : "";
}

/* =========================
   STYLES (unchanged logic)
========================= */

function injectProfileStyles() {
  if (styleInjected) return;
  styleInjected = true;

  const style = document.createElement("style");
  style.textContent = `
    #${PROFILE_PLACEHOLDER_ID} {
      position: absolute !important;
      right: 20px;
      top: 50%;
      transform: translateY(-50%);
      pointer-events: none;
      display: flex;
      align-items: center;
    }

    .profile-chip {
      display:inline-flex;
      align-items:center;
      gap:8px;
      padding-inline:12px;
      cursor:pointer;
      border-radius:999px;
      pointer-events:auto;
      background:transparent;
      border:none;
      color:#e5e7eb;
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
      font-weight:700;
    }

    .profile-menu {
      position:absolute;
      top:calc(100% + 8px);
      right:0;
      min-width:190px;
      padding:10px;
      border-radius:14px;
      background:#020617;
      border:1px solid rgba(51,65,85,0.9);
      display:none;
      z-index:99;
    }

    .profile-logout-btn {
      width:100%;
      margin-top:8px;
      border-radius:999px;
      border:none;
      padding:7px;
      font-weight:600;
      cursor:pointer;
      background:#ef4444;
      color:white;
    }
  `;
  document.head.appendChild(style);
}

/* =========================
   PROFILE UI
========================= */

function clearProfile() {
  const placeholder = document.getElementById(PROFILE_PLACEHOLDER_ID);
  if (placeholder) placeholder.innerHTML = "";
  profileChip = null;
  profileMenu = null;
}

function renderProfileUI(displayName) {
  injectProfileStyles();

  const placeholder =
    document.getElementById(PROFILE_PLACEHOLDER_ID) ||
    (() => {
      const div = document.createElement("div");
      div.id = PROFILE_PLACEHOLDER_ID;
      document.body.appendChild(div);
      return div;
    })();

  clearProfile();
  placeholder.style.pointerEvents = "auto";
  const firstName = displayName.split(" ")[0];
  const initial = firstName.charAt(0).toUpperCase();

  const chip = document.createElement("button");
  chip.className = "profile-chip";
  chip.innerHTML = `
    <span class="profile-initial">${initial}</span>
    <span>${firstName}</span>
  `;

  const menu = document.createElement("div");
  menu.className = "profile-menu";
  menu.innerHTML = `
    <div>Signed in as<br><strong>${displayName}</strong></div>
  `;

  const logoutBtn = document.createElement("button");
  logoutBtn.className = "profile-logout-btn";
  logoutBtn.textContent = "Logout";

  logoutBtn.onclick = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("pharmaName");
    window.location.href = "index.html";
  };

  menu.appendChild(logoutBtn);

  chip.onclick = (e) => {
    e.stopPropagation();
    menu.style.display = menu.style.display === "block" ? "none" : "block";
  };

  document.addEventListener("click", () => {
    menu.style.display = "none";
  });

  placeholder.appendChild(chip);
  placeholder.appendChild(menu);

  profileChip = chip;
  profileMenu = menu;
}

/* =========================
   AUTH STATE HANDLING
========================= */

async function handleSession(session) {
  if (!session?.user) {
    setAuthLinksVisible(true);
    updateLandingCTAs(false);
    clearProfile();
    return;
  }

  setAuthLinksVisible(false);
  updateLandingCTAs(true);

  const user = session.user;
  const displayName =
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "User";

  localStorage.setItem("pharmaName", displayName);
  renderProfileUI(displayName);
}

/* =========================
   INIT
========================= */

// Instant skeleton (fast UX)
const cached = localStorage.getItem("pharmaName");
if (cached) {
  setAuthLinksVisible(false);
  updateLandingCTAs(true);
  renderProfileUI(cached);
}

// Initial session
const {
  data: { session }
} = await supabase.auth.getSession();

handleSession(session);

// Listen for auth changes
supabase.auth.onAuthStateChange((_event, session) => {
  handleSession(session);
});
