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
  DISTRICTS: ["Bayelsa North", "Bayelsa East", "Bayelsa Central"],
  RANKS: ["Recruit", "Ranger", "Ranger 1st Class", "Gold Ranger", "Staff Commander", "Commander"],
  ROLES: { SUPER_ADMIN: "super_admin", STATE_ADMIN: "state_admin", DISTRICT_ADMIN: "district_admin", OUTPOST_ADMIN: "outpost_admin", MEMBER: "member" }
};

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
  // Apply logo everywhere
  document.querySelectorAll(".app-logo").forEach(el => {
    if (APP_CONFIG.LOGO_URL && APP_CONFIG.LOGO_URL !== "PASTE_LOGO_LINK_HERE") {
      el.src = APP_CONFIG.LOGO_URL;
      el.style.display = "block";
    }
  });
  document.querySelectorAll(".app-name").forEach(el => el.textContent = APP_CONFIG.ORG_NAME);
  document.querySelectorAll(".app-state").forEach(el => el.textContent = APP_CONFIG.STATE);
}
