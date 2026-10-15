import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, deleteDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.WEB_FIREBASE_API_KEY,
  authDomain: import.meta.env.WEB_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.WEB_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.WEB_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.WEB_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.WEB_FIREBASE_APP_ID,
};

// Do not initialize Firebase with an incomplete config; show setup guidance instead.
const missing = Object.entries(firebaseConfig)
  .filter(([, value]) => !value?.trim())
  .map(([key]) => key);

if (missing.length) {
  console.error(
    `[firebase] Missing config values: ${missing.join(", ")}.\n` +
    `Copy ".env.example" to ".env" in the project root (next to package.json), then add these values:\n\n` +
    `WEB_FIREBASE_API_KEY=...\n` +
    `WEB_FIREBASE_AUTH_DOMAIN=...\n` +
    `WEB_FIREBASE_PROJECT_ID=...\n` +
    `WEB_FIREBASE_STORAGE_BUCKET=...\n` +
    `WEB_FIREBASE_MESSAGING_SENDER_ID=...\n` +
    `WEB_FIREBASE_APP_ID=...\n\n` +
    `Copy these from Firebase Console > Project settings > General > Your apps > SDK setup and configuration.\n` +
    `Then restart "npm run dev" — Vite only reads .env on startup.`
  );
}

export const firebaseConfigured = missing.length === 0;
const app = firebaseConfigured
  ? (getApps()[0] ?? initializeApp(firebaseConfig))
  : null;
export const db = app ? getFirestore(app) : null;

export function requireFirestore() {
  if (!db) {
    throw new Error(
      "Firebase is not configured. Add the WEB_FIREBASE_* values to .env and restart the app."
    );
  }
  return db;
}

// Writes a throwaway doc and reads it straight back. This is the only way to
// know a save has truly reached Firestore — a write can "succeed" locally
// (no thrown error, UI shows Saved) while never actually landing on the
// server, e.g. if an ad blocker/privacy extension is quietly blocking
// requests to firestore.googleapis.com, or the security rules reject it.
export async function checkFirestoreConnection() {
  if (!db) return false;
  try {
    const ref = doc(db, "_healthcheck", "ping");
    await setDoc(ref, { ts: Date.now() });
    const snap = await getDoc(ref);
    await deleteDoc(ref).catch(() => {});
    return snap.exists();
  } catch (e) {
    console.error("[firebase] connection check failed:", e);
    return false;
  }
}