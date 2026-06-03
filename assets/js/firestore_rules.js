rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isAuth() { return request.auth != null; }
    function uid() { return request.auth.uid; }
    function userDoc() { return get(/databases/$(database)/documents/members/$(uid())); }
    function role() { return userDoc().data.role; }
    function isSuperAdmin() { return isAuth() && role() == "super_admin"; }
    function isStateAdmin() { return isAuth() && (role() == "super_admin" || role() == "state_admin"); }
    function isDistrictAdmin() { return isAuth() && (role() in ["super_admin","state_admin","district_admin"]); }
    function isAnyAdmin() { return isAuth() && role() in ["super_admin","state_admin","district_admin","outpost_admin"]; }
    function isOwner(uid) { return isAuth() && request.auth.uid == uid; }

    // APP SETTINGS — only super admin writes
    match /settings/{doc} {
      allow read: if isAuth();
      allow write: if isSuperAdmin();
    }

    // MEMBERS collection
    match /members/{memberId} {
      allow read: if isAuth();
      allow create: if isAuth() && request.auth.uid == memberId;
      allow update: if isOwner(memberId) || isAnyAdmin();
      allow delete: if isStateAdmin();
    }

    // EVENTS collection
    match /events/{eventId} {
      allow read: if true; // Public
      allow write: if isAnyAdmin();
      // Registrations subcollection
      match /registrations/{regId} {
        allow read: if isAnyAdmin() || isOwner(regId);
        allow create: if isAuth();
        allow update, delete: if isAnyAdmin();
      }
    }

    // NEWS & ANNOUNCEMENTS
    match /news/{newsId} {
      allow read: if true;
      allow write: if isAnyAdmin();
    }

    // TRAINING MANUALS
    match /manuals/{manualId} {
      allow read: if isAuth();
      allow write: if isStateAdmin();
    }

    // ACTIVITIES / PLAN OF WORK
    match /activities/{actId} {
      allow read: if isAuth();
      allow write: if isAnyAdmin();
    }

    // NOTIFICATIONS
    match /notifications/{notifId} {
      allow read: if isAuth() && (resource.data.userId == uid() || resource.data.global == true);
      allow create: if isAnyAdmin();
      allow update: if isOwner(resource.data.userId);
      allow delete: if isSuperAdmin();
    }

    // ATTENDANCE
    match /attendance/{recordId} {
      allow read: if isAnyAdmin() || isOwner(resource.data.memberId);
      allow write: if isAnyAdmin();
    }

    // PAYMENTS
    match /payments/{payId} {
      allow read: if isStateAdmin() || isOwner(resource.data.memberId);
      allow create: if isAuth();
      allow update: if isStateAdmin();
      allow delete: if isSuperAdmin();
    }

    // EXCOS
    match /excos/{excoId} {
      allow read: if true;
      allow write: if isStateAdmin();
    }

    // GALLERY
    match /gallery/{photoId} {
      allow read: if true;
      allow write: if isAnyAdmin();
    }

    // DISTRICTS & OUTPOSTS
    match /districts/{districtId} {
      allow read: if isAuth();
      allow write: if isStateAdmin();
      match /outposts/{outpostId} {
        allow read: if isAuth();
        allow write: if isDistrictAdmin();
      }
    }
  }
}
