// ============================================================
// ROYAL RANGERS BAYELSA — auth.js
// Firebase Authentication: login, register, logout, reset
// ============================================================

// Generate unique membership ID: RR-BY-XXXX
async function generateMembershipID() {
  const counterRef = db.collection("settings").doc("member_counter");
  return db.runTransaction(async tx => {
    const doc = await tx.get(counterRef);
    const next = (doc.exists ? doc.data().count : 0) + 1;
    tx.set(counterRef, { count: next }, { merge: true });
    return "RR-BY-" + String(next).padStart(4, "0");
  });
}

// REGISTER
async function registerMember(formData, photoFile) {
  const { email, password, firstName, lastName, dob, gender, phone,
          address, church, outpost, district, rank } = formData;

  if (!email || !password || !firstName || !lastName) throw new Error("Please fill all required fields.");
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");

  // Create auth user
  const cred = await auth.createUserWithEmailAndPassword(email, password);
  const uid = cred.user.uid;

  // Upload photo if provided
  let photoURL = "";
  if (photoFile) {
    const ref = storage.ref(`profile_photos/${uid}/${photoFile.name}`);
    await ref.put(photoFile);
    photoURL = await ref.getDownloadURL();
  }

  // Generate membership ID
  const membershipID = await generateMembershipID();

  // Save to Firestore
  await db.collection("members").doc(uid).set({
    uid, email, firstName, lastName,
    fullName: `${firstName} ${lastName}`,
    dob: dob || "",
    gender: gender || "",
    phone: phone || "",
    address: address || "",
    church: church || "",
    outpost: outpost || "",
    district: district || "",
    rank: rank || "Recruit",
    membershipID,
    photoURL,
    role: "member",
    status: "pending",
    certifications: [],
    trainingRecords: [],
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
    birthday: dob ? dob.slice(5) : "" // MM-DD for birthday reminders
  });

  // Send email verification
  await cred.user.sendEmailVerification();

  // Notify admins
  await db.collection("notifications").add({
    type: "new_member",
    title: "New Member Registration",
    message: `${firstName} ${lastName} (${membershipID}) registered and awaiting approval.`,
    global: false,
    targetRole: "state_admin",
    userId: "admins",
    read: false,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  return { uid, membershipID };
}

// LOGIN
async function loginMember(email, password) {
  if (!email || !password) throw new Error("Email and password are required.");
  const cred = await auth.signInWithEmailAndPassword(email, password);
  const uid = cred.user.uid;

  // Update last login
  await db.collection("members").doc(uid).update({
    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
  });

  // Get user role for redirect
  const doc = await db.collection("members").doc(uid).get();
  if (!doc.exists) throw new Error("Member record not found.");
  const data = doc.data();
  return data;
}

// LOGOUT
async function signOut() {
  await auth.signOut();
  window.location.href = "login.html";
}

// PASSWORD RESET
async function resetPassword(email) {
  if (!email) throw new Error("Please enter your email address.");
  await auth.sendPasswordResetEmail(email);
}

// GET CURRENT USER DATA
async function getCurrentUserData() {
  const user = auth.currentUser;
  if (!user) return null;
  const doc = await db.collection("members").doc(user.uid).get();
  return doc.exists ? { uid: user.uid, ...doc.data() } : null;
}

// REQUIRE AUTH — redirect if not logged in
function requireAuth(redirectTo = "login.html") {
  return new Promise(resolve => {
    const unsub = auth.onAuthStateChanged(async user => {
      unsub();
      if (!user) { window.location.href = redirectTo; return; }
      const data = await getCurrentUserData();
      resolve(data);
    });
  });
}

// REQUIRE ROLE
function requireRole(userData, allowedRoles, redirectTo = "dashboard.html") {
  if (!allowedRoles.includes(userData.role)) {
    alert("Access denied. Insufficient permissions.");
    window.location.href = redirectTo;
    return false;
  }
  return true;
}

// UPDATE PROFILE
async function updateMemberProfile(uid, updates, newPhotoFile) {
  if (newPhotoFile) {
    const ref = storage.ref(`profile_photos/${uid}/${Date.now()}_${newPhotoFile.name}`);
    await ref.put(newPhotoFile);
    updates.photoURL = await ref.getDownloadURL();
  }
  updates.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
  if (updates.firstName && updates.lastName) {
    updates.fullName = `${updates.firstName} ${updates.lastName}`;
  }
  await db.collection("members").doc(uid).update(updates);
}
