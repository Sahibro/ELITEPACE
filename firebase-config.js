// ============================================================
// FIREBASE CONFIGURATION
// Replace with YOUR Firebase project credentials
// Get free credentials: console.firebase.google.com
// ============================================================

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
try {
  firebase.initializeApp(firebaseConfig);
  window.db = firebase.database();
  window.FIREBASE_READY = true;
  console.log("✅ Firebase connected successfully");
} catch (error) {
  console.warn("⚠️ Firebase not configured. Using local demo mode.");
  window.FIREBASE_READY = false;
  window.db = null;
}
