/* app.js — UI logic: sidebar, routes, detail panel, audio, language */

let lang = 'el', activeRoute = 'all', activeStop = null;
let playing = false, progress = 0, audioInterval = null;

/* ── ROUTE SWITCHING ────────────────────── */
function switchRoute(routeId) {
  activeRoute = routeId;
  activeStop  = null;

  // update tab buttons
  document.querySelectorAll('.route-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.route === routeId);
  });

  // update polylines & markers
  showRoutePolyline(routeId);
  filterMarkersForRoute(routeId);
  clearActiveMarkers();

  // update sidebar header
  const route = routes.find(r => r.id === routeId);
  document.getElementById('sb-route-name').textContent = route[lang].name;
  const ids = route.stopIds;
  document.getElementById('sb-route-sub').textContent  =
    `${ids.length} ${lang === 'el' ? 'στάσεις' : 'stops'}`;

  // re-render stop list
  renderSidebar();

  // close detail panel
  document.getElementById('detail').classList.remove('open');
  const dr2 = document.getElementById('det-resize');
  if (dr2) dr2.classList.remove('visible');
  resetAudio();

  // fit map to route
  fitRouteOnMap(routeId);
}

/* ── SIDEBAR ────────────────────────────── */
function renderSidebar() {
  const route  = routes.find(r => r.id === activeRoute);
  const ids    = route ? route.stopIds : stops.map(s => s.id);
  const subset = ids.map(id => stops.find(s => s.id === id)).filter(Boolean);

  document.getElementById('stops-list').innerHTML = subset.map((s, i) => `
    <div class="stop-item ${activeStop === s.id ? 'active' : ''}" onclick="openStop(${s.id})">
      <div class="stop-num">${i + 1}</div>
      <div class="stop-info">
        <div class="stop-name">${s[lang].title}</div>
        <div class="stop-sub">${s[lang].sub}</div>
      </div>
      <div class="stop-chev">›</div>
    </div>`).join('');
}

/* ── DETAIL PANEL ───────────────────────── */
function openStop(id) {
  activeStop = id;
  const s = stops.find(x => x.id === id);
  const route = routes.find(r => r.id === activeRoute);
  const ids = route ? route.stopIds : stops.map(s => s.id);
  const pos = ids.indexOf(id) + 1;

  // Photo gallery
  const pw = document.getElementById('det-photo-wrap');
  const photos = s.photos && s.photos.length > 0 ? s.photos : [];
  const captions = s.captions || [];
  if (photos.length > 0) {
    const firstCaption = captions[0] || '';
    pw.innerHTML = `
      <div class="gallery-wrap">
        <img class="det-photo" id="gallery-img" src="${photos[0]}" alt="${s[lang].title}"/>
        <div class="det-grad"></div>
        ${photos.length > 1 ? `
          <button class="gallery-arrow gallery-prev" onclick="galleryNav(-1)" id="gallery-prev" style="display:none">‹</button>
          <button class="gallery-arrow gallery-next" onclick="galleryNav(1)" id="gallery-next">›</button>
          <div class="gallery-counter" id="gallery-counter">1 / ${photos.length}</div>
        ` : ''}
      </div>
      <div class="gallery-caption" id="gallery-caption" style="display:${firstCaption ? '' : 'none'}">${firstCaption}</div>`;
    window._galleryPhotos = photos;
    window._galleryIndex = 0;
    window._galleryCaptions = captions;
  } else {
    pw.innerHTML = `<div class="det-photo-ph"><div class="det-ph-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div><div class="det-ph-label">${T[lang].photo}</div></div><div class="det-grad"></div>`;
    window._galleryPhotos = [];
    window._galleryIndex = 0;
  }

  // Video gallery
  const vs = document.getElementById('sec-video');
  const vids = s.videos && s.videos.length > 0 ? s.videos : [];
  if (vids.length > 0) {
    vs.style.display = '';
    window._videoList = vids;
    window._videoIndex = 0;
    vs.innerHTML = `
      <div class="det-media-lbl" data-key="video">${T[lang].video}</div>
      <div class="video-gallery-wrap" style="position:relative;">
        <iframe id="video-frame" src="${vids[0]}" width="100%" height="200"
          style="border:none;border-radius:6px;display:block;" allowfullscreen></iframe>
        ${vids.length > 1 ? `
          <button class="gallery-arrow gallery-prev" id="vid-prev" onclick="videoNav(-1)" style="display:none">‹</button>
          <button class="gallery-arrow gallery-next" id="vid-next" onclick="videoNav(1)">›</button>
          <div class="gallery-counter" id="vid-counter">1 / ${vids.length}</div>
        ` : ''}
      </div>`;
  } else {
    vs.style.display = 'none';
  }

  // Panorama button — show if stop has panorama URL
  const panSec = document.getElementById('sec-panorama');
  if (panSec) {
    if (s.panorama) {
      panSec.style.display = '';
    } else {
      panSec.style.display = 'none';
    }
  }

  // Street View — hide if streetview:false
  const allMedia = document.querySelectorAll('#detail .det-media');
  allMedia.forEach(m => {
    if (m.querySelector('[onclick="openStreetView()"]')) {
      m.style.display = s.streetview === false ? 'none' : '';
    }
  });

  // Audio — language specific
  document.getElementById('a-caption').textContent = s[lang].audio;
  const audioEl = document.getElementById('audio-el');
  if (audioEl) {
    const audioSrc = lang === 'en' && s.audio_en ? s.audio_en : s.audio;
    if (audioSrc) audioEl.src = audioSrc;
  }

  // Text
  const routeColor = routes.find(r => r.id === activeRoute)?.color || '#6b5a28';
  document.getElementById('det-num').textContent       = pos;
  document.getElementById('det-num').style.background  = routeColor;
  document.getElementById('det-badge-txt').textContent = `${T[lang].stop} ${pos} / ${ids.length}`;
  document.getElementById('det-badge-txt').style.color  = routeColor;
  document.getElementById('det-title').textContent     = s[lang].title;
  document.getElementById('det-sub').textContent       = s[lang].sub;

  // Format description — with source attribution styling
  const d = s[lang];
  let descHtml = '';
  if (d.source) {
    // get the sub element color to reuse for the source label
    const subColor = getComputedStyle(document.getElementById('det-sub')).color;
    // strip the plain-text "Πηγή:…" line that lives in desc (everything before it)
    const mainText = d.desc.split('\n\nΠηγή:')[0];
    descHtml  = mainText;
    descHtml += `<br><em style="color:${subColor};font-style:italic;font-size:0.88em;">${lang === 'en' ? 'Source' : 'Πηγή'}: ${d.source}</em>`;
    if (d.desc_extra) descHtml += '<br>' + d.desc_extra;
  } else {
    descHtml = d.desc;
  }
  // bold section markers
  const formattedDesc = descHtml
    .replace(/(ΤΟ ΠΑΡΕΛΘΟΝ:)/g, '<strong>$1</strong>')
    .replace(/(ΤΟ ΠΑΡΟΝ:)/g,    '<strong>$1</strong>')
    .replace(/(THE PAST:)/g,    '<strong>$1</strong>')
    .replace(/(THE PRESENT:)/g, '<strong>$1</strong>');
  document.getElementById('det-desc').innerHTML = formattedDesc;

  document.getElementById('nav-pos').textContent       = `${pos} / ${ids.length}`;
  document.getElementById('btn-prev').disabled         = pos === 1;
  document.getElementById('btn-next').disabled         = pos === ids.length;

  resetAudio();
  document.getElementById('detail').classList.add('open');
  const dr = document.getElementById('det-resize');
  if (dr) { setTimeout(() => { dr.style.display = 'block'; dr.classList.add('visible'); if(typeof positionDetHandle === 'function') positionDetHandle(); }, 420); }
  renderSidebar();
  setActiveMarker(id);
  panMapTo(s.coords);
}


function galleryNav(dir) {
  const photos = window._galleryPhotos;
  if (!photos || photos.length <= 1) return;
  window._galleryIndex = (window._galleryIndex + dir + photos.length) % photos.length;
  const idx = window._galleryIndex;
  const img = document.getElementById('gallery-img');
  const counter = document.getElementById('gallery-counter');
  const prev = document.getElementById('gallery-prev');
  const next = document.getElementById('gallery-next');
  if (img) img.src = photos[idx];
  if (counter) counter.textContent = `${idx + 1} / ${photos.length}`;
  const cap = document.getElementById('gallery-caption');
  if (cap) {
    const capText = (window._galleryCaptions || [])[idx];
    cap.textContent = capText || '';
    cap.style.display = capText ? '' : 'none';
  }
  if (prev) prev.style.display = idx === 0 ? 'none' : 'flex';
  if (next) next.style.display = idx === photos.length - 1 ? 'none' : 'flex';
}



function videoNav(dir) {
  const vids = window._videoList;
  if (!vids || vids.length <= 1) return;
  window._videoIndex = (window._videoIndex + dir + vids.length) % vids.length;
  const idx = window._videoIndex;
  const frame = document.getElementById('video-frame');
  const counter = document.getElementById('vid-counter');
  const prev = document.getElementById('vid-prev');
  const next = document.getElementById('vid-next');
  if (frame) frame.src = vids[idx];
  if (counter) counter.textContent = `${idx + 1} / ${vids.length}`;
  if (prev) prev.style.display = idx === 0 ? 'none' : 'flex';
  if (next) next.style.display = idx === vids.length - 1 ? 'none' : 'flex';
}

function openPanorama() {
  const modal = document.getElementById('pan-modal');
  const frame = document.getElementById('pan-frame');
  if (!frame.src) frame.src = 'https://www.efada.gr/Iera-Odos/Index.htm';
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closePanorama() {
  document.getElementById('pan-modal').style.display = 'none';
  document.body.style.overflow = '';
}

function closeDetail() {
  document.getElementById('detail').classList.remove('open');
  const dr = document.getElementById('det-resize');
  if (dr) { dr.style.display = 'none'; dr.classList.remove('visible'); }
  activeStop = null;
  clearActiveMarkers();
  renderSidebar();
  resetAudio();
}

function navStop(dir) {
  if (!activeStop) return;
  const route = routes.find(r => r.id === activeRoute);
  const ids = route ? route.stopIds : stops.map(s => s.id);
  const idx = ids.indexOf(activeStop);
  const next = ids[idx + dir];
  if (next !== undefined) openStop(next);
}

/* ── STREET VIEW ────────────────────────── */
function openStreetView() {
  if (!activeStop) return;
  const s = stops.find(x => x.id === activeStop);
  if (s.maps_url) {
    window.open(s.maps_url, '_blank');
  } else {
    const [lat, lng] = s.coords;
    window.open(`https://www.google.com/maps/@${lat},${lng},3a,80y,0h,90t/data=!3m6!1e1!3m4!1sAF1QipN!2e10!7i13312!8i6656`, '_blank');
  }
}

/* ── LANGUAGE ───────────────────────────── */
function setLang(l) {
  lang = l;
  window.lang = l;
  document.getElementById('btn-el').classList.toggle('active', l === 'el');
  document.getElementById('btn-en').classList.toggle('active', l === 'en');

  // route tabs
  routes.forEach(r => {
    const btn = document.querySelector(`.route-tab[data-route="${r.id}"]`);
    if (btn) btn.textContent = r[l].name;
  });

  // sidebar header
  const route = routes.find(r => r.id === activeRoute);
  document.getElementById('sb-route-name').textContent = route[l].name;

  // legend
  const leg = document.getElementById('lbl-leg2');
  if (leg) leg.textContent = T[l].leg2;

  // Nav buttons
  const lp = document.getElementById('lbl-prev');
  if (lp) lp.textContent = T[l].prev;
  const ln = document.getElementById('lbl-next');
  if (ln) ln.textContent = T[l].next;

  // Community bar
  const ct = document.getElementById('community-toggle');
  if (ct) ct.innerHTML = `<div class="toggle-dot"></div>${T[l].community}`;
  const ab = document.getElementById('add-stop-btn');
  if (ab) ab.textContent = T[l].add;
  const hint = document.getElementById('add-hint');
  if (hint) hint.textContent = T[l].hint;

  // Panorama button
  const panTitle = document.getElementById('pan-btn-title');
  if (panTitle) panTitle.textContent = T[l].panorama;
  const panSub = document.getElementById('pan-btn-sub');
  if (panSub) panSub.textContent = T[l].panoramasub;

  // Street View button
  const svt = document.getElementById('sv-btn-title');
  if (svt) svt.textContent = T[l].svbtn;
  const svs = document.getElementById('sv-btn-sub');
  if (svs) svs.textContent = T[l].svbtn2;

  // Tile selector options
  const tileSelect = document.getElementById('tile-select');
  if (tileSelect) {
    Array.from(tileSelect.options).forEach(opt => {
      opt.textContent = opt.dataset[l] || opt.textContent;
    });
  }

  // Audio label
  const al = document.querySelector('.det-media-lbl[data-key="audio"]');
  if (al) al.textContent = T[l].audio;

  updateMarkerTooltips(l);
  renderSidebar();
  if (activeStop) {
    resetAudio();
    openStop(activeStop);
  }
}

/* ── AUDIO ──────────────────────────────── */
function resetAudio() {
  if (audioInterval) { clearInterval(audioInterval); audioInterval = null; }
  playing = false; progress = 0;
  const audioEl = document.getElementById('audio-el');
  if (audioEl) audioEl.pause();
  const btn = document.querySelector('.a-play');
  if (btn) btn.innerHTML = iconPlay();
  const fill = document.getElementById('a-fill');
  if (fill) fill.style.width = '0%';
  const time = document.getElementById('a-time');
  if (time) time.textContent = '0:00 / 0:00';
}

function togglePlay(btn) {
  const s = activeStop ? stops.find(x => x.id === activeStop) : null;
  const audioEl = document.getElementById('audio-el');
  if (s && s.audio && audioEl) {
    if (playing) { audioEl.pause(); playing = false; btn.innerHTML = iconPlay(); }
    else {
      audioEl.play(); playing = true; btn.innerHTML = iconPause();
      audioEl.ontimeupdate = () => updateAudioUI(audioEl.currentTime, audioEl.duration);
      audioEl.onended = () => { playing = false; btn.innerHTML = iconPlay(); };
    }
  } else {
    playing = !playing;
    btn.innerHTML = playing ? iconPause() : iconPlay();
    if (playing) {
      audioInterval = setInterval(() => {
        progress = Math.min(progress + 0.5, 100);
        const tot = 185, cur = Math.floor((progress / 100) * tot);
        updateAudioUI(cur, tot);
        if (progress >= 100) { clearInterval(audioInterval); playing = false; progress = 0; btn.innerHTML = iconPlay(); }
      }, 120);
    } else { clearInterval(audioInterval); }
  }
}

function updateAudioUI(cur, tot) {
  const f = document.getElementById('a-fill');
  const t = document.getElementById('a-time');
  if (f) f.style.width = tot ? `${(cur / tot) * 100}%` : '0%';
  if (t) t.textContent = `${fmt(cur)} / ${fmt(tot)}`;
}
function fmt(s) { s = Math.floor(s); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; }
function iconPlay()  { return `<svg width="11" height="13" viewBox="0 0 11 13"><path d="M0 0L11 6.5L0 13Z"/></svg>`; }
function iconPause() { return `<svg width="10" height="13" viewBox="0 0 10 13" fill="#f5f0e6"><rect x="0" y="0" width="3" height="13"/><rect x="7" y="0" width="3" height="13"/></svg>`; }

/* ── BOOT ───────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  // build route tabs dynamically
  const tabContainer = document.getElementById('route-tabs');
  routes.forEach(r => {
    const btn = document.createElement('button');
    btn.className = 'route-tab' + (r.id === 'all' ? ' active' : '');
    btn.dataset.route = r.id;
    btn.style.setProperty('--rt-color', r.color);
    btn.textContent = r['el'].name;
    btn.onclick = () => switchRoute(r.id);
    tabContainer.appendChild(btn);
  });

  initMap();
  switchRoute('all');
  setLang('el');

  // Sidebar resize
  const handle = document.getElementById('sb-resize');
  const sidebar = document.getElementById('sidebar');
  if (handle && sidebar) {
    let dragging = false, startX = 0, startW = 0;
    handle.addEventListener('mousedown', e => {
      dragging = true;
      startX = e.clientX;
      startW = sidebar.offsetWidth;
      handle.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });
    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      const newW = Math.min(500, Math.max(160, startW + e.clientX - startX));
      sidebar.style.width = newW + 'px';
      // update community bar position
      const cb = document.getElementById('community-bar');
      const leg = document.getElementById('legend');
      if (cb) cb.style.left = (newW + 2) + 'px';
      if (leg) leg.style.left = (newW + 2) + 'px';
    });
    document.addEventListener('mouseup', () => {
      dragging = false;
      handle.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (map) map.invalidateSize();
    });
  }

  // Detail panel resize
  const detHandle = document.getElementById('det-resize');
  const detPanel = document.getElementById('detail');
  if (detHandle && detPanel) {
    let detDragging = false, detStartX = 0, detStartW = 0;

    function positionDetHandle() {
      const w = detPanel.offsetWidth;
      detHandle.style.right = w + 'px';
    }
    positionDetHandle();

    detHandle.addEventListener('mousedown', e => {
      if (!detPanel.classList.contains('open')) return;
      detDragging = true;
      detStartX = e.clientX;
      detStartW = detPanel.offsetWidth;
      detHandle.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });
    document.addEventListener('mousemove', e => {
      if (!detDragging) return;
      const newW = Math.min(700, Math.max(320, detStartW + (detStartX - e.clientX)));
      detPanel.style.width = newW + 'px';
      positionDetHandle();
    });
    document.addEventListener('mouseup', () => {
      if (detDragging) {
        detDragging = false;
        detHandle.classList.remove('dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        if (map) map.invalidateSize();
      }
    });

    // Reposition on open/close
    const origOpen = window.openStop;
    window.openStop = function(id) {
      origOpen(id);
      setTimeout(positionDetHandle, 400);
    };
  }
});
