const fs = require('fs');
const path = require('path');
const geojsonvt = require('geojson-vt').default || require('geojson-vt');
const vtpbf = require('vt-pbf');

// 1. Konfigurasi
const INPUT_FILE = 'data.geojson';
const OUTPUT_DIR = 'tiles';
const LAYER_NAME = 'layer_utama';
const MIN_ZOOM = 12;
const MAX_ZOOM = 16;

// 2. Baca file GeoJSON
const geojson = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));

// 3. Buat indeks vektor tile
const tileIndex = new geojsonvt(geojson, {
  maxZoom: MAX_ZOOM,
  tolerance: 3,
  extent: 4096,
  buffer: 64
});

// Fungsi konversi koordinat Lon/Lat ke nomor Tile X/Y
function lon2tile(lon, zoom) {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}
function lat2tile(lat, zoom) {
  return Math.floor(
    ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
      Math.pow(2, zoom)
  );
}

// Cari batas koordinat (Bounding Box) dari GeoJSON
let minLon = 180, minLat = 90, maxLon = -180, maxLat = -90;
function scanCoords(coords) {
  if (typeof coords[0] === 'number') {
    if (coords[0] < minLon) minLon = coords[0];
    if (coords[0] > maxLon) maxLon = coords[0];
    if (coords[1] < minLat) minLat = coords[1];
    if (coords[1] > maxLat) maxLat = coords[1];
  } else {
    coords.forEach(scanCoords);
  }
}
geojson.features.forEach((f) => scanCoords(f.geometry.coordinates));

// 4. Generate file {z}/{x}/{y}.pbf (tanpa gzip agar kompatibel dengan GitHub Pages)
let totalTiles = 0;
for (let z = MIN_ZOOM; z <= MAX_ZOOM; z++) {
  const minX = lon2tile(minLon, z);
  const maxX = lon2tile(maxLon, z);
  const minY = lat2tile(maxLat, z);
  const maxY = lat2tile(minLat, z);

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      const tile = tileIndex.getTile(z, x, y);
      if (tile && tile.features.length > 0) {
        const pbfBuffer = Buffer.from(vtpbf.fromGeojsonVt({ [LAYER_NAME]: tile }));
        const dir = path.join(OUTPUT_DIR, String(z), String(x));
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, `${y}.pbf`), pbfBuffer);
        totalTiles++;
      }
    }
  }
}

console.log(`Selesai! Berhasil membuat ${totalTiles} file vector tile di folder /${OUTPUT_DIR}`);