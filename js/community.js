// community.js — Community layer: user stops, Firebase + Cloudinary
// ─────────────────────────────────────────────────────────────────

import { db, auth, googleProvider, ADMIN_EMAIL } from './firebase.js';
import {
  collection, addDoc, query, where, onSnapshot,
  serverTimestamp, doc, updateDoc, deleteDoc, orderBy
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  signInWithPopup, signOut, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

// ── CLOUDINARY CONFIG ────────────────────────────
const CLOUDINARY = {
  cloudName: 'dcxuzcwmw',
  uploadPreset: 'iera_odos_community', // θα το δημιουργήσουμε στο Cloudinary
};

// ── AUTH STATE ────────────────────────────────────
export let currentUser = null;
export let isAdmin = false;

onAuthStateChanged(auth, user => {
  currentUser = user;
  isAdmin = user ? user.email === ADMIN_EMAIL : false;
  updateAuthUI();
});

export async function loginWithGoogle() {
  try { await signInWithPopup(auth, googleProvider); }
  catch(e) { console.error('Login error:', e); }
}

export async function logout() {
  await signOut(auth);
}

function updateAuthUI() {
  const btn = document.getElementById('auth-btn');
  const info = document.getElementById('auth-info');
  if (!btn) return;
  if (currentUser) {
    btn.textContent = 'Αποσύνδεση';
    btn.onclick = logout;
    if (info) {
      info.textContent = currentUser.displayName || currentUser.email;
      info.style.display = 'block';
    }
  } else {
    btn.textContent = 'Σύνδεση με Google';
    btn.onclick = loginWithGoogle;
    if (info) info.style.display = 'none';
  }
}

// ── CLOUDINARY UPLOAD ─────────────────────────────
export async function uploadToCloudinary(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY.uploadPreset);
  formData.append('folder', 'community');

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/image/upload`,
    { method: 'POST', body: formData }
  );
  if (!res.ok) throw new Error('Upload failed');
  const data = await res.json();
  return data.secure_url;
}

// ── SUBMIT USER STOP ──────────────────────────────
export async function submitUserStop({ title, description, lat, lng, photoFile }) {
  if (!currentUser) { loginWithGoogle(); return; }

  let photoUrl = null;
  if (photoFile) {
    try {
      photoUrl = await uploadToCloudinary(photoFile);
    } catch(e) {
      console.error('Photo upload error:', e);
    }
  }

  await addDoc(collection(db, 'user_stops'), {
    title,
    description,
    lat,
    lng,
    photoUrl,
    status: 'pending',
    userId: currentUser.uid,
    userName: currentUser.displayName || 'Ανώνυμος',
    userPhoto: currentUser.photoURL || null,
    createdAt: serverTimestamp(),
  });
}

// ── LISTEN APPROVED STOPS ─────────────────────────
export function listenApprovedStops(callback) {
  const q = query(
    collection(db, 'user_stops'),
    where('status', '==', 'approved')
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// ── ADMIN ─────────────────────────────────────────
export async function approveStop(id) {
  await updateDoc(doc(db, 'user_stops', id), { status: 'approved' });
}
export async function rejectStop(id) {
  await deleteDoc(doc(db, 'user_stops', id));
}
