import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, deleteDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// If any of these are missing, Firebase silently "initializes" with a broken
// config and every Firestore read/write fails without a clear reason why.
// Fail loudly instead, so it's obvious this is a missing .env file, not a bug.
const missing = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length) {
  console.error(
    `[firebase] Missing config values: ${missing.join(", ")}.\n` +
    `Create a ".env" file in the project root (next to package.json) with these keys:\n\n` +
    `VITE_FIREBASE_API_KEY=...\n` +
    `VITE_FIREBASE_AUTH_DOMAIN=...\n` +
    `VITE_FIREBASE_PROJECT_ID=...\n` +
    `VITE_FIREBASE_STORAGE_BUCKET=...\n` +
    `VITE_FIREBASE_MESSAGING_SENDER_ID=...\n` +
    `VITE_FIREBASE_APP_ID=...\n\n` +
    `Copy these from Firebase Console > Project settings > General > Your apps > SDK setup and configuration.\n` +
    `Then restart "npm run dev" — Vite only reads .env on startup.`
  );
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const firebaseConfigured = missing.length === 0;

// Writes a throwaway doc and reads it straight back. This is the only way to
// know a save has truly reached Firestore — a write can "succeed" locally
// (no thrown error, UI shows Saved) while never actually landing on the
// server, e.g. if an ad blocker/privacy extension is quietly blocking
// requests to firestore.googleapis.com, or the security rules reject it.
export async function checkFirestoreConnection() {
  if (!firebaseConfigured) return false;
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