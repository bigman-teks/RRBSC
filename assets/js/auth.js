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
// REGISTER
async function registerMember(formData, photoFile) {
  try {

    const {
      email,
      password,
      firstName,
      lastName,
      dob,
      gender,
      phone,
      address,
      church,
      outpost,
      district,
      rank
    } = formData;

    console.log("STEP 1: Creating auth user");

    const cred = await auth.createUserWithEmailAndPassword(
      email,
      password
    );

    const uid = cred.user.uid;

    console.log("STEP 2: Auth user created", uid);

    // Photo Upload
    let photoURL = "";

    if (photoFile) {
      try {
        console.log("STEP 3: Uploading photo");

        const ref = storage.ref(
          `profile_photos/${uid}/${photoFile.name}`
        );

        await ref.put(photoFile);

        photoURL = await ref.getDownloadURL();

        console.log("Photo uploaded");
      } catch (photoError) {
        console.warn("Photo upload failed:", photoError);
      }
    }

    // Membership ID
    let membershipID;

    try {
      console.log("STEP 4: Generating membership ID");

      membershipID = await generateMembershipID();

    } catch (counterError) {

      console.warn("Counter error:", counterError);

      membershipID =
        "RR-BY-" + Date.now().toString().slice(-6);
    }

    console.log("Membership ID:", membershipID);

    // Firestore Save
    console.log("STEP 5: Saving member document");

    const memberData = {
      uid,
      email,
      firstName,
      lastName,
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
      birthday: dob ? dob.slice(5) : "",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastLogin: firebase.firestore.FieldValue.serverTimestamp()
    };

    alert("STEP 5: About to save member document");
    await db
      .collection("members")
      .doc(uid)
      .set(memberData);

    console.log("STEP 6: Member document saved");

    // Notification (optional)
    try {
      await db.collection("notifications").add({
        type: "new_member",
        title: "New Member Registration",
        message: `${firstName} ${lastName} (${membershipID}) registered.`,
        targetRole: "state_admin",
        read: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      console.log("Notification created");

    } catch (notifyError) {
      console.warn("Notification error:", notifyError);
    }

    // Verification Email
    try {
      await cred.user.sendEmailVerification();
      console.log("Verification email sent");
    } catch (verifyError) {
      console.warn("Verification email error:", verifyError);
    }

    return {
      uid,
      membershipID
    };

  } catch (error) {

    console.error(
      "REGISTRATION ERROR:",
      error.code,
      error.message
    );

    throw error;
  }
}

// LOGIN
async function loginMember(email, password) {
  const cred = await auth.signInWithEmailAndPassword(email, password);
  const uid = cred.user.uid;

  let docRef = db.collection("members").doc(uid);
  let doc = await docRef.get();

  if (!doc.exists) {
    const userData = {
      uid,
      email: cred.user.email,
      fullName: cred.user.displayName || "Administrator",
      role: "super_admin",
      status: "approved",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await docRef.set(userData);
    return userData;
  }

  return doc.data();
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
