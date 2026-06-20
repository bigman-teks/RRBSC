// ============================================================
// ROYAL RANGERS BAYELSA — auth.js
// Firebase Authentication: login, register, logout, reset
// ============================================================

// Retries a Firestore write once after a short delay if it fails with
// permission-denied — this covers the rare race condition where a brand
// new auth session hasn't fully propagated before the write fires.
async function writeWithRetry(writeFn, retries = 2, delayMs = 700) {
  try {
    return await writeFn();
  } catch (err) {
    console.warn("writeWithRetry caught:", err.code, err.message, "| retries left:", retries);
    if (err.code === "permission-denied" && retries > 0) {
      await new Promise(res => setTimeout(res, delayMs));
      return writeWithRetry(writeFn, retries - 1, delayMs);
    }
    throw err;
  }
}

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
  console.log("=== registerMember() started ===", formData.email);

  const { email, password, firstName, lastName, dob, gender, phone,
          address, church, outpost, district, rank } = formData;

  if (!email || !password || !firstName || !lastName) throw new Error("Please fill all required fields.");
  if (password.length < 6) throw new Error("Password must be at least 6 characters.");

  // Create auth user
  console.log("Step 1: Creating auth user...");
  const cred = await auth.createUserWithEmailAndPassword(email, password);
  const uid = cred.user.uid;
  console.log("Step 1 done. UID:", uid);

  // Force-refresh the ID token so Firestore security rules immediately
  // recognize this user as authenticated. Without this, the very next
  // Firestore write can intermittently fail with "permission-denied"
  // because the new auth session hasn't fully propagated yet.
  console.log("Step 2: Refreshing ID token...");
  await cred.user.getIdToken(true);
  console.log("Step 2 done.");

  // Upload photo if provided
  let photoURL = "";
  if (photoFile) {
    console.log("Step 3: Uploading photo...");
    try {
      const ref = storage.ref(`profile_photos/${uid}/${photoFile.name}`);
      await ref.put(photoFile);
      photoURL = await ref.getDownloadURL();
      console.log("Step 3 done. Photo URL:", photoURL);
    } catch (photoErr) {
      console.error("Step 3 FAILED (photo upload):", photoErr.code, photoErr.message);
      // Don't let a photo failure block the whole registration —
      // continue without a photo rather than throwing.
      photoURL = "";
    }
  } else {
    console.log("Step 3 skipped: no photo provided.");
  }

  // Generate membership ID
  console.log("Step 4: Generating membership ID...");
  const membershipID = await generateMembershipID();
  console.log("Step 4 done. Membership ID:", membershipID);

  // Save to Firestore — with a short retry in case the auth session
  // hasn't fully propagated to the security rules engine yet.
  const memberData = {
    uid, email, firstName, lastName,
    fullName: `${firstName} ${lastName}`,
    dob: dob || "",
    gender: gender || "",
    phone: phone || "",
    address: address || "",
    church: church || "",
    outpost: outpost || "",
    district: district || "",
    rank: rank || "Lance Corporal",
    membershipID,
    photoURL,
    role: "member",
    status: "pending",
    certifications: [],
    trainingRecords: [],
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
    birthday: dob ? dob.slice(5) : "" // MM-DD for birthday reminders
  };

  console.log("Step 5: Writing member document to Firestore...", memberData);
  await writeWithRetry(() => db.collection("members").doc(uid).set(memberData));
  console.log("Step 5 done. Member document written successfully.");

  // Write safe public verification record (no sensitive data — for QR scan lookups)
  const publicData = {
    uid, membershipID,
    fullName: `${firstName} ${lastName}`,
    rank: rank || "Lance Corporal",
    district: district || "",
    outpost: outpost || "",
    photoURL,
    status: "pending",
    memberSince: firebase.firestore.FieldValue.serverTimestamp()
  };

  console.log("Step 6: Writing public_verify document...", publicData);
  await writeWithRetry(() => db.collection("public_verify").doc(membershipID).set(publicData));
  console.log("Step 6 done.");

  // Send email verification
  console.log("Step 7: Sending verification email...");
  try {
    await cred.user.sendEmailVerification();
    console.log("Step 7 done.");
  } catch (emailErr) {
    console.warn("Step 7 failed (non-blocking):", emailErr.code, emailErr.message);
  }

  // Notify admins
  console.log("Step 8: Creating admin notification...");
  try {
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
    console.log("Step 8 done.");
  } catch (notifErr) {
    console.warn("Step 8 failed (non-blocking):", notifErr.code, notifErr.message);
  }

  console.log("=== registerMember() COMPLETE ===", { uid, membershipID });
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

  // Keep public_verify in sync whenever any card-visible field changes,
  // so the QR scan result on verify.html always matches the printed card.
  const verifyFields = ["fullName", "rank", "district", "outpost", "photoURL", "status"];
  const hasVisibleChange = verifyFields.some(f => f in updates);
  if (hasVisibleChange) {
    try {
      const doc = await db.collection("members").doc(uid).get();
      const m = doc.data();
      if (m.membershipID) {
        await db.collection("public_verify").doc(m.membershipID).set({
          uid,
          membershipID: m.membershipID,
          fullName: m.fullName || "",
          rank: m.rank || "Lance Corporal",
          district: m.district || "",
          outpost: m.outpost || "",
          photoURL: m.photoURL || "",
          status: m.status || "pending"
        }, { merge: true });
      }
    } catch (e) {
      console.warn("public_verify sync skipped:", e.message);
    }
  }
}
