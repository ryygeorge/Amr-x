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

const PROFILE_PLACEHOLDER_ID = "profilePlaceholder";

/* small helpers */
function addHidden(el) { if (!el) return; el.classList.add("hidden"); }
function removeHidden(el) { if (!el) return; el.classList.remove("hidden"); }

function setAuthLinksVisible(isVisible) {
  const els = document.querySelectorAll(".auth-link");
  els.forEach(el => {
    if (isVisible) removeHidden(el);
    else addHidden(el);
  });
}

function updateLandingCTAs(isLoggedIn) {
  const heroGetStarted = document.getElementById("heroGetStarted");
  const heroLoginCta = document.getElementById("heroLoginCta");
  const overviewGetStarted = document.getElementById("overviewGetStarted");

  if (heroGetStarted) heroGetStarted.href = isLoggedIn ? "pharma.html" : "choose.html";
  if (overviewGetStarted) overviewGetStarted.href = isLoggedIn ? "pharma.html" : "choose.html";
  if (heroLoginCta) {
    if (isLoggedIn) addHidden(heroLoginCta);
    else removeHidden(heroLoginCta);
  }
}

function removeExistingProfileNodes() {
  if (profileChip && profileChip.parentElement) profileChip.parentElement.removeChild(profileChip);
  if (profileMenu && profileMenu.parentElement) profileMenu.parentElement.removeChild(profileMenu);
  profileChip = null;
  profileMenu = null;
}

function ensurePlaceholder() {
  let placeholder = document.getElementById(PROFILE_PLACEHOLDER_ID);
  if (!placeholder) {
    const headerWrapper = document.querySelector(".topbar") || document.querySelector(".navbar");
    const wrap = document.createElement("div");
    wrap.id = PROFILE_PLACEHOLDER_ID;
    wrap.className = "amrx-profile-fallback";
    if (headerWrapper) headerWrapper.appendChild(wrap);
    else document.body.appendChild(wrap);
    placeholder = wrap;
  }
  return placeholder;
}

function renderImmediateSkeleton(cachedName) {
  try {
    const firstName = String(cachedName || "User").split(" ")[0];
    const initial = firstName.charAt(0).toUpperCase() || "U";

    const placeholder = ensurePlaceholder();

    if (placeholder.querySelector(".profile-chip")) return;

    const div = document.createElement("div");
    div.className = "profile-chip profile-skeleton";
    div.setAttribute("aria-hidden", "true");
    div.innerHTML = `<span class="profile-initial">${initial}</span><span class="profile-name">${firstName}</span>`;

    placeholder.style.pointerEvents = "none";
    placeholder.appendChild(div);

    profileChip = div;
  } catch (e) {
    console.warn("Profile skeleton render failed:", e.message);
  }
}

function renderProfileUI(displayName) {
  if (document.body.dataset.hideProfile === "true") return;

  const placeholder = ensurePlaceholder();
  const headerWrapper = document.querySelector(".topbar") || document.querySelector(".navbar");

  const firstName = String(displayName || "User").split(" ")[0];
  const initial = firstName.charAt(0).toUpperCase() || "U";

  const existing = placeholder.querySelector(".profile-chip");
  if (existing) placeholder.removeChild(existing);

  if (profileChip && profileChip.tagName === "BUTTON") {
    const initEl = profileChip.querySelector(".profile-initial");
    const nameEl = profileChip.querySelector(".profile-name");
    if (initEl) initEl.textContent = initial;
    if (nameEl) nameEl.textContent = firstName;
    placeholder.style.pointerEvents = "auto";
    return;
  }

  removeExistingProfileNodes();

  const chip = document.createElement("button");
  chip.type = "button";
  chip.id = "profileChip";
  chip.className = "nav-link profile-chip";
  chip.innerHTML = `<span class="profile-initial">${initial}</span><span class="profile-name">${firstName}</span>`;

  chip.tabIndex = 0;
  chip.setAttribute("aria-haspopup", "true");
  chip.setAttribute("aria-expanded", "false");
  chip.setAttribute("title", `Signed in as ${displayName}`);

  placeholder.style.pointerEvents = "auto";
  placeholder.appendChild(chip);
  profileChip = chip;

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
  if (headerWrapper) headerWrapper.appendChild(menu);
  else document.body.appendChild(menu);

  profileMenu = menu;

  function setMenuOpen(isOpen) {
    chip.setAttribute("aria-expanded", isOpen ? "true" : "false");
    profileMenu.style.display = isOpen ? "block" : "none";
  }

  chip.addEventListener("click", (e) => {
    e.stopPropagation();
    setMenuOpen(profileMenu.style.display !== "block");
  });

  chip.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setMenuOpen(profileMenu.style.display !== "block");
    } else if (e.key === "Escape") {
      setMenuOpen(false);
      chip.blur();
    }
  });

  document.addEventListener("click", (e) => {
    if (!profileMenu || !profileChip) return;
    if (profileMenu.style.display === "block" && !profileMenu.contains(e.target) && !profileChip.contains(e.target)) {
      setMenuOpen(false);
    }
  });
}

function clearProfilePlaceholder() {
  const placeholder = document.getElementById(PROFILE_PLACEHOLDER_ID);
  if (placeholder) placeholder.innerHTML = "";
  removeExistingProfileNodes();
}

/* Fast skeleton if cached */
try {
  const cached = localStorage.getItem("pharmaName");
  if (cached) {
    renderImmediateSkeleton(cached);
    setAuthLinksVisible(false);
    const heroGetStarted = document.getElementById("heroGetStarted");
    const overviewGetStarted = document.getElementById("overviewGetStarted");
    if (heroGetStarted) heroGetStarted.href = "pharma.html";
    if (overviewGetStarted) overviewGetStarted.href = "pharma.html";
  }
} catch (e) {
  console.warn("localStorage read error:", e.message);
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    setAuthLinksVisible(true);
    updateLandingCTAs(false);
    clearProfilePlaceholder();
    return;
  }

  setAuthLinksVisible(false);
  updateLandingCTAs(true);

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
