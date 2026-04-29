// community-layer.js — Map layer for community stops
// Depends on: community.js, map.js (map global), Leaflet

import { currentUser, loginWithGoogle, submitUserStop, listenApprovedStops } from './community.js';

let layerVisible = true;
let communityMarkers = [];
let unsubStops = null;
let addMode = false;
let pendingLatLng = null;
let selectedFile = null;

// ── INIT ──────────────────────────────────────────
export function initCommunityLayer() {
  renderAddModal();
  setupToggle();
  setupAddButton();

  // Listen for approved stops from Firebase
  unsubStops = listenApprovedStops(stops => {
    clearCommunityMarkers();
    stops.forEach(s => addCommunityMarker(s));
  });

  // Map click for adding
  map.on('click', onMapClick);
}

// ── TOGGLE ────────────────────────────────────────
function setupToggle() {
  const toggle = document.getElementById('community-toggle');
  if (!toggle) return;
  toggle.addEventListener('click', () => {
    layerVisible = !layerVisible;
    toggle.classList.toggle('active', layerVisible);
    communityMarkers.forEach(({ marker }) => {
      layerVisible ? marker.addTo(map) : marker.remove();
    });
  });
  toggle.classList.add('active');
}

// ── ADD BUTTON ────────────────────────────────────
function setupAddButton() {
  const btn = document.getElementById('add-stop-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (!currentUser) { loginWithGoogle(); return; }
    addMode = !addMode;
    btn.classList.toggle('adding', addMode);
    btn.textContent = addMode ? '✕ Ακύρωση' : '+ Προσθήκη';
    document.getElementById('add-hint').style.display = addMode ? 'block' : 'none';
    if (!addMode) { pendingLatLng = null; }
  });
}

// ── MAP CLICK ─────────────────────────────────────
function onMapClick(e) {
  if (!addMode) return;
  pendingLatLng = e.latlng;
  openAddModal(e.latlng);
  addMode = false;
  const btn = document.getElementById('add-stop-btn');
  if (btn) { btn.classList.remove('adding'); btn.innerHTML = '+'; }
  document.getElementById('add-hint').style.display = 'none';
}

// ── ADD MODAL ─────────────────────────────────────
function renderAddModal() {
  const modal = document.createElement('div');
  modal.id = 'add-stop-modal';
  modal.innerHTML = `
    <div id="add-stop-box">
      <div class="modal-header">
        <div class="modal-title">Νέο σημείο κοινότητας</div>
        <button class="modal-close" onclick="closeCommunityModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="modal-coords" id="modal-coords">📍 Επιλεγμένη θέση</div>
        <div class="form-group">
          <label>Τίτλος *</label>
          <input id="cm-title" placeholder="π.χ. Παλιό εργοστάσιο, Βυζαντινό τείχος..."/>
        </div>
        <div class="form-group">
          <label>Περιγραφή</label>
          <textarea id="cm-desc" placeholder="Πείτε μας τι βρήκατε, τι γνωρίζετε, γιατί είναι σημαντικό για την Ιερά Οδό..."></textarea>
        </div>
        <div class="form-group">
          <label>Φωτογραφία (προαιρετική)</label>
          <img id="cm-photo-preview" class="photo-preview"/>
          <div class="photo-remove" id="cm-photo-remove" onclick="removeCommunityPhoto()">✕ Αφαίρεση φωτογραφίας</div>
          <div class="photo-upload-area" id="cm-upload-area">
            <input type="file" accept="image/*" id="cm-photo-input" onchange="previewCommunityPhoto(this)"/>
            <div class="photo-upload-icon">📷</div>
            <div class="photo-upload-text">Κάντε κλικ ή σύρετε φωτογραφία</div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-modal-cancel" onclick="closeCommunityModal()">Ακύρωση</button>
        <button class="btn-modal-submit" id="cm-submit" onclick="submitCommunityStop()">Υποβολή →</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

function openAddModal(latlng) {
  const modal = document.getElementById('add-stop-modal');
  document.getElementById('modal-coords').textContent =
    `📍 ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
  document.getElementById('cm-title').value = '';
  document.getElementById('cm-desc').value = '';
  document.getElementById('cm-photo-preview').style.display = 'none';
  document.getElementById('cm-photo-remove').style.display = 'none';
  document.getElementById('cm-upload-area').style.display = 'block';
  selectedFile = null;
  modal.classList.add('open');
}

window.closeCommunityModal = function() {
  document.getElementById('add-stop-modal').classList.remove('open');
  pendingLatLng = null;
};

window.previewCommunityPhoto = function(input) {
  const file = input.files[0];
  if (!file) return;
  selectedFile = file;
  const reader = new FileReader();
  reader.onload = e => {
    const preview = document.getElementById('cm-photo-preview');
    preview.src = e.target.result;
    preview.style.display = 'block';
    document.getElementById('cm-photo-remove').style.display = 'block';
    document.getElementById('cm-upload-area').style.display = 'none';
  };
  reader.readAsDataURL(file);
};

window.removeCommunityPhoto = function() {
  selectedFile = null;
  document.getElementById('cm-photo-preview').style.display = 'none';
  document.getElementById('cm-photo-remove').style.display = 'none';
  document.getElementById('cm-upload-area').style.display = 'block';
  document.getElementById('cm-photo-input').value = '';
};

window.submitCommunityStop = async function() {
  const title = document.getElementById('cm-title').value.trim();
  if (!title) {
    document.getElementById('cm-title').style.borderColor = '#a04030';
    return;
  }
  if (!pendingLatLng) return;

  const btn = document.getElementById('cm-submit');
  btn.disabled = true;
  btn.textContent = 'Υποβολή...';

  try {
    await submitUserStop({
      title,
      description: document.getElementById('cm-desc').value.trim(),
      lat: pendingLatLng.lat,
      lng: pendingLatLng.lng,
      photoFile: selectedFile,
    });
    closeCommunityModal();
    alert('✓ Το σημείο υποβλήθηκε! Θα εμφανιστεί μετά από έγκριση.');
  } catch(e) {
    console.error(e);
    alert('Σφάλμα κατά την υποβολή. Δοκιμάστε ξανά.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Υποβολή →';
  }
};

// ── MARKERS ───────────────────────────────────────
function addCommunityMarker(stop) {
  const icon = L.divIcon({
    className: '',
    html: `<div class="cmk-wrap" id="cmk-${stop.id}">
             <div class="cmk-ring"></div>
             <div class="cmk-core">
               <svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
             </div>
           </div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });

  const marker = L.marker([stop.lat, stop.lng], { icon })
    .addTo(layerVisible ? map : L.layerGroup())
    .bindPopup(buildPopupContent(stop), {
      maxWidth: 260,
      className: 'cmk-popup-wrapper',
    });

  if (!layerVisible) marker.remove();
  communityMarkers.push({ id: stop.id, marker });
}

function buildPopupContent(stop) {
  const date = stop.createdAt?.toDate
    ? stop.createdAt.toDate().toLocaleDateString('el-GR')
    : '';
  const photoHtml = stop.photoUrl
    ? `<img src="${stop.photoUrl}" style="width:100%;height:130px;object-fit:cover;display:block;" alt=""/>`
    : '';
  const avatarHtml = stop.userPhoto
    ? `<img src="${stop.userPhoto}" style="width:18px;height:18px;border-radius:50%;vertical-align:middle;margin-right:4px;"/>`
    : `<span style="display:inline-flex;width:18px;height:18px;border-radius:50%;background:var(--olive3);border:1px solid var(--olive);align-items:center;justify-content:center;font-size:9px;color:var(--olive);margin-right:4px;">${(stop.userName||'?')[0]}</span>`;

  return `<div class="cmk-popup">
    ${photoHtml}
    <div class="cmk-popup-body">
      <div class="cmk-popup-badge"><div class="cmk-popup-badge-dot"></div>Σημείο κοινότητας</div>
      <div class="cmk-popup-title">${stop.title}</div>
      ${stop.description ? `<div class="cmk-popup-desc">${stop.description}</div>` : ''}
      <div class="cmk-popup-meta">${avatarHtml}${stop.userName || 'Ανώνυμος'}${date ? ' · ' + date : ''}</div>
    </div>
  </div>`;
}

function clearCommunityMarkers() {
  communityMarkers.forEach(({ marker }) => marker.remove());
  communityMarkers = [];
}
