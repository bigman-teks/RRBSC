// ============================================================
// ROYAL RANGERS BAYELSA STATE COMMAND
// Firebase Configuration — Replace with your project values
// Firebase Console: https://console.firebase.google.com
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyCqYdd5Owp6ZDIzYu2ZFZ6lONtHH7QCHpk",
  authDomain: "royal-rangers-bayelsa.firebaseapp.com",
  databaseURL: "https://royal-rangers-bayelsa-default-rtdb.firebaseio.com",
  projectId: "royal-rangers-bayelsa",
  storageBucket: "royal-rangers-bayelsa.firebasestorage.app",
  messagingSenderId: "68712265617",
  appId: "1:68712265617:web:9e0eedf59fdd4ad7240c30"
};
// ============================================================
// LOGO CONFIGURATION — Admin can update via Admin Settings page
// ============================================================
const APP_CONFIG = {
  LOGO_URL: "PASTE_LOGO_LINK_HERE",  // e.g. https://i.imgur.com/yourlogo.png
  ORG_NAME: "Royal Rangers",
  STATE: "Bayelsa State Command",
  TAGLINE: "Building men of character, faith, and leadership.",
  CONTACT_EMAIL: "info@rrbayelsa.org",
  CONTACT_PHONE: "+234 800 000 0000",
  HQ_ADDRESS: "State Headquarters, Gloryland District, Yenagoa, Bayelsa State",
  PAYSTACK_PUBLIC_KEY: "pk_live_YOUR_PAYSTACK_PUBLIC_KEY",
  // Your real, permanent live site URL — used for QR codes & verification links.
  // Set this ONCE after your first deploy (e.g. "https://royal-rangers-bayelsa.web.app"
  // or your custom domain "https://www.rrbayelsa.org"). Do NOT leave this blank in production.
  SITE_URL: "https://YOUR-PROJECT-ID.web.app",
  DISTRICTS: ["Bayelsa North", "Bayelsa East", "Bayelsa Central"],
  RANKS: [
    "Lance Corporal",
    "Corporal",
    "Sergeant",
    "Staff Sergeant",
    "Warrant Officer",
    "Master Warrant Officer",
    "Second Lieutenant",
    "Lieutenant",
    "Captain",
    "Major",
    "Lieutenant Colonel",
    "Colonel",
    "Brigadier General",
    "Major General",
    "Lieutenant General",
    "General"
  ],
  ROLES: { SUPER_ADMIN: "super_admin", STATE_ADMIN: "state_admin", DISTRICT_ADMIN: "district_admin", OUTPOST_ADMIN: "outpost_admin", MEMBER: "member" }
};

// Returns the correct base URL for building shareable links (QR codes, verification, etc.)
// Falls back safely instead of ever returning a useless file:// path.
function getSiteBaseUrl() {
  if (window.location.protocol === "file:") {
    console.warn("⚠ You are opening this page directly from your file system (file://). " +
      "QR codes and verification links will not work until you serve this site " +
      "through a real web server or deploy it to Firebase Hosting.");
    return APP_CONFIG.SITE_URL && !APP_CONFIG.SITE_URL.includes("YOUR-PROJECT-ID")
      ? APP_CONFIG.SITE_URL
      : ""; // empty string makes the broken link obvious rather than silently wrong
  }
  // Normal case: page is served over http/https — use the real current origin
  return window.location.origin;
}

// Firebase SDK imports (loaded via CDN in HTML)
// firebase-app, firebase-auth, firebase-firestore, firebase-storage
let app, auth, db, storage;

function initFirebase() {
  app = firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  db = firebase.firestore();
  storage = firebase.storage();
  // Enable offline persistence
  db.enablePersistence().catch(err => console.warn("Persistence:", err.code));
}

// Save/load APP_CONFIG from Firestore (Admin-editable settings)
async function loadAppConfig() {
  try {
    const doc = await db.collection("settings").doc("app_config").get();
    if (doc.exists) Object.assign(APP_CONFIG, doc.data());
  } catch (e) {}

  // Apply logo everywhere — show image, hide fallback initials/icon
  // Reject file:// paths since they're local-only and will never load for other users
  const hasLogo = APP_CONFIG.LOGO_URL
    && APP_CONFIG.LOGO_URL !== "PASTE_LOGO_LINK_HERE"
    && !APP_CONFIG.LOGO_URL.startsWith("file://");
  document.querySelectorAll(".app-logo").forEach(el => {
    if (hasLogo) {
      el.src = APP_CONFIG.LOGO_URL;
      el.style.display = "block";
      el.onerror = () => { el.style.display = "none"; }; // hide if URL is broken
      // Hide any sibling fallback element (logo-fallback class)
      const fallback = el.parentElement?.querySelector(".logo-fallback");
      if (fallback) fallback.style.display = "none";
    }
  });
  document.querySelectorAll(".app-name").forEach(el => el.textContent = APP_CONFIG.ORG_NAME);
  document.querySelectorAll(".app-state").forEach(el => el.textContent = APP_CONFIG.STATE);
}
