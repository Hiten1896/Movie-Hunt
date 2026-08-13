import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js';
import { getFirestore, doc, setDoc, deleteDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js';
import { getAuth, signInAnonymously, signInWithCustomToken } from 'https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js';

const rawConfig = window.ENV || window.__firebase_config || {};
const firebaseConfig = {
    apiKey: rawConfig.FIREBASE_API_KEY || "",
    authDomain: rawConfig.FIREBASE_AUTH_DOMAIN || "",
    projectId: rawConfig.FIREBASE_PROJECT_ID || "",
    storageBucket: rawConfig.FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: rawConfig.FIREBASE_MESSAGING_SENDER_ID || "",
    appId: rawConfig.FIREBASE_APP_ID || ""
};

let db = null;
let auth = null;
let isConfigured = false;

if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        isConfigured = true;

        if (window.__initial_auth_token) {
            signInWithCustomToken(auth, window.__initial_auth_token).catch(() => {});
        } else {
            signInAnonymously(auth).catch(() => {});
        }
    } catch (e) {
        isConfigured = false;
    }
}

window.getFirebase = () => {
    if (!isConfigured) {
        return {
            isReady: false,
            doc: null,
            setDoc: async () => false,
            deleteDoc: async () => false,
            onSnapshot: () => () => {}
        };
    }
    return {
        isReady: true,
        doc,
        setDoc,
        deleteDoc,
        onSnapshot,
        db,
        auth
    };
};