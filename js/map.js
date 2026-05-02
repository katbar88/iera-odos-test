/* map.js — Leaflet map, tile layers, markers, routes */

const tileLayers = {
  topo:      { url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', attr:'© Esri' },
  carto:     { url:'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', attr:'© OSM © CARTO' },
  osm:       { url:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attr:'© OpenStreetMap contributors' },
  satellite: { url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr:'© Esri' },
};

let map, currentTileLayer = null, markers = [], polylines = {};

function initMap() {
  map = L.map('map', { center:[38.005,23.635], zoom:12 });
  switchMapStyle('topo');
  drawAllPolylines();
  createMarkers();
}

/* ── TILE SWITCHER ─────────────────────── */
function changeTile(style) { switchMapStyle(style); }

function switchMapStyle(style) {
  if (currentTileLayer) map.removeLayer(currentTileLayer);
  const t = tileLayers[style] || tileLayers['topo'];
  currentTileLayer = L.tileLayer(t.url, { attribution:t.attr, subdomains:'abcd', maxZoom:19, className: t.className || '' }).addTo(map);
  currentTileLayer.bringToBack();
}

/* ── POLYLINES ─────────────────────────── */
function drawAllPolylines() {
  routes.forEach(route => {
    const coords = route.stopIds
      .map(id => stops.find(s => s.id === id))
      .filter(Boolean)
      .map(s => s.coords);
    polylines[route.id] = L.polyline(coords, {
      color: route.color, weight: 2.5, opacity: 0.75,
      dashArray: '8,10', lineCap:'round',
    }).addTo(map);
  });
  showRoutePolyline('all');
}

function showRoutePolyline(routeId) {
  Object.entries(polylines).forEach(([id, pl]) => {
    pl.setStyle({ opacity: id === routeId ? 0.78 : 0.12 });
  });
}

/* ── MARKERS ───────────────────────────── */
function createMarkers() {
  stops.forEach(s => {
    const icon = L.divIcon({
      className: '',
      html: `<div class="mk-wrap" id="mk-${s.id}"><div class="mk-ring"></div><div class="mk-core">${s.id}</div></div>`,
      iconSize:[38,38], iconAnchor:[19,19],
    });
    const m = L.marker(s.coords, { icon }).addTo(map)
      .bindTooltip(s[window.lang || 'el'].title, { direction:'top', offset:[0,-20] });
    m.on('click', () => openStop(s.id));
    markers.push({ id:s.id, marker:m });
  });
}

function setActiveMarker(id) {
  markers.forEach(m => {
    const el = document.getElementById(`mk-${m.id}`);
    if (el) el.classList.toggle('active', m.id === id);
  });
}

function clearActiveMarkers() {
  markers.forEach(m => {
    const el = document.getElementById(`mk-${m.id}`);
    if (el) el.classList.remove('active');
  });
}

function filterMarkersForRoute(routeId) {
  const route = routes.find(r => r.id === routeId);
  const ids = route ? route.stopIds : stops.map(s => s.id);
  markers.forEach(({ id, marker }) => {
    const el = document.getElementById(`mk-${id}`);
    if (el) {
      el.style.opacity = ids.includes(id) ? '1' : '0.2';
      el.style.pointerEvents = ids.includes(id) ? '' : 'none';
    }
  });
}

function updateMarkerTooltips(lang) {
  markers.forEach(({ id, marker }) => {
    marker.setTooltipContent(stops.find(s => s.id === id)[lang].title);
  });
}

function panMapTo(coords) {
  map.panTo(coords, { animate:true, duration:0.5 });
}

function fitRouteOnMap(routeId) {
  const route = routes.find(r => r.id === routeId);
  if (!route) return;
  const coords = route.stopIds
    .map(id => stops.find(s => s.id === id))
    .filter(Boolean)
    .map(s => s.coords);
  if (coords.length) map.fitBounds(L.latLngBounds(coords), { padding:[40,40] });
}
