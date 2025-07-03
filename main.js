
var map = L.map('map').setView([20, 0], 2);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
const geod = GeographicLib.Geodesic.WGS84;
var points = [];
var useMiles = false;

function updateSidebar() {
  const list = document.getElementById('points-list');
  list.innerHTML = '';
  points.forEach((p, i) => {
    const li = document.createElement('li');
    li.textContent = `Point ${i+1}: ${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}`;
    list.appendChild(li);
  });
}

function clearMapAndPoints() {
  map.eachLayer(layer => {
    if (layer instanceof L.Marker || layer instanceof L.Polyline) {
      map.removeLayer(layer);
    }
  });
  points = [];
  document.getElementById('distance-display').innerHTML = '';
  updateSidebar();

  // Clear input fields
  document.getElementById('address1').value = '';
  document.getElementById('address2').value = '';
  document.getElementById('lat1').value = '';
  document.getElementById('lon1').value = '';
  document.getElementById('lat2').value = '';
  document.getElementById('lon2').value = '';
}


function computeArc() {
  if (points.length !== 2) return;
  const g = geod.InverseLine(points[0].lat, points[0].lon, points[1].lat, points[1].lon);
  const npts = 100;
  const rawPath = [];
  for (let i = 0; i <= npts; i++) {
    const s = i * g.s13 / npts;
    const p = g.Position(s);
    rawPath.push({ lat: p.lat2, lon: p.lon2 });
  }
  const baseLon = rawPath[0].lon;
  const path = rawPath.map(p => {
    let lon = p.lon;
    while (lon - baseLon > 180) lon -= 360;
    while (lon - baseLon < -180) lon += 360;
    return [p.lat, lon];
  });

  L.polyline(path, { color: 'red' }).addTo(map);
  map.fitBounds(L.latLngBounds(path), { padding: [20, 20] });

  const km = g.s13 / 1000;
  const mi = g.s13 / 1609.344;
  document.getElementById('distance-display').innerText = useMiles ? `${mi.toFixed(2)} miles` : `${km.toFixed(2)} km`;
}

map.on('click', function(e) {
  if (points.length === 2) clearMapAndPoints();
  points.push({ lat: e.latlng.lat, lon: e.latlng.lng });
  L.marker(e.latlng).addTo(map);
  updateSidebar();
  if (points.length === 2) computeArc();
});

document.getElementById('toggle-units-btn').addEventListener('click', () => {
  useMiles = !useMiles;
  document.getElementById('toggle-units-btn').innerText = useMiles ? 'Show in km' : 'Show in miles';
  computeArc();
});

document.querySelectorAll('input[name="input-mode"]').forEach(input => {
  input.addEventListener('change', function() {
    document.getElementById('address-inputs').style.display = this.value === 'address' ? '' : 'none';
    document.getElementById('coords-inputs').style.display = this.value === 'coords' ? '' : 'none';
    clearMapAndPoints();
  });
});

function normalizeLon(lon) {
  // Wrap longitude into [-180, 180]
  return ((lon + 180) % 360 + 360) % 360 - 180;
}

document.getElementById('find-address-btn').addEventListener('click', () => {
  const addr1 = document.getElementById('address1').value;
  const addr2 = document.getElementById('address2').value;

  if (!addr1 || !addr2) {
    alert('Enter both addresses');
    return;
  }

  clearMapAndPoints();

  Promise.all([
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr1)}`).then(r => r.json()),
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr2)}`).then(r => r.json())
  ]).then(results => {
    if (results[0].length === 0 || results[1].length === 0) {
      alert('Address not found');
      return;
    }

    const p1 = {
      lat: parseFloat(results[0][0].lat),
      lon: normalizeLon(parseFloat(results[0][0].lon))
    };

    const p2 = {
      lat: parseFloat(results[1][0].lat),
      lon: normalizeLon(parseFloat(results[1][0].lon))
    };

    points = [p1, p2];

    L.marker([p1.lat, p1.lon]).addTo(map);
    L.marker([p2.lat, p2.lon]).addTo(map);

    updateSidebar();
    computeArc();

    const bounds = L.latLngBounds(points.map(p => [p.lat, p.lon]));
    map.fitBounds(bounds, { padding: [20, 20] });
  });
});

document.getElementById('find-coords-btn').addEventListener('click', () => {
  let lat1 = parseFloat(document.getElementById('lat1').value);
  let lon1 = normalizeLon(parseFloat(document.getElementById('lon1').value));
  let lat2 = parseFloat(document.getElementById('lat2').value);
  let lon2 = normalizeLon(parseFloat(document.getElementById('lon2').value));

  if ([lat1, lon1, lat2, lon2].some(isNaN)) {
    alert('Enter valid coordinates');
    return;
  }

  clearMapAndPoints();

  points = [{ lat: lat1, lon: lon1 }, { lat: lat2, lon: lon2 }];

  L.marker([lat1, lon1]).addTo(map);
  L.marker([lat2, lon2]).addTo(map);

  updateSidebar();
  computeArc();
});


