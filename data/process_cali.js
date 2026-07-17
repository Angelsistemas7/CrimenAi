const fs = require('fs');
const path = __dirname;

function perpDist(p, a, b) {
  const [x, y] = p, [x1, y1] = a, [x2, y2] = b;
  const dx = x2 - x1, dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(x - x1, y - y1);
  const t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy);
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}
function rdp(points, epsilon) {
  if (points.length < 3) return points;
  let maxDist = 0, index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpDist(points[i], points[0], points[points.length - 1]);
    if (d > maxDist) { maxDist = d; index = i; }
  }
  if (maxDist > epsilon) {
    return rdp(points.slice(0, index + 1), epsilon).slice(0, -1).concat(rdp(points.slice(index), epsilon));
  }
  return [points[0], points[points.length - 1]];
}
function round(n) { return Math.round(n * 1e5) / 1e5; }
function simplifyRing(ring, eps) {
  let s = rdp(ring, eps);
  if (s.length < 4) s = ring.filter((_, i) => i % Math.ceil(ring.length / 4) === 0);
  return s.map(p => [round(p[0]), round(p[1])]);
}

const raw = JSON.parse(fs.readFileSync(path + '/cali_homicidios_raw.geojson', 'utf8'));
const EPS = 0.0002;
const features = [];
const localidades = [];
raw.features.forEach(f => {
  const p = f.properties;
  const geom = f.geometry;
  if (!geom) return;
  let coords;
  if (geom.type === 'Polygon') coords = geom.coordinates.map(r => simplifyRing(r, EPS));
  else if (geom.type === 'MultiPolygon') coords = geom.coordinates.map(poly => poly.map(r => simplifyRing(r, EPS)));
  else return;
  const key = String(p.comuna);
  features.push({ type: 'Feature', properties: { key, nombre: 'Comuna ' + p.comuna }, geometry: { type: geom.type, coordinates: coords } });
  localidades.push({ key, nombre: 'Comuna ' + p.comuna, homicidios: p.Homicidios_2024 || 0 });
});

fs.writeFileSync(path + '/cali_comunas.geojson', JSON.stringify({ type: 'FeatureCollection', features }));
fs.writeFileSync(path + '/cali_data.json', JSON.stringify({
  meta: { fuente: 'Observatorio de Seguridad - Alcaldía de Santiago de Cali', periodo: 'Año 2024 (única serie disponible: homicidios)' },
  localidades,
}));
console.log('features:', features.length, 'geojson size:', fs.statSync(path + '/cali_comunas.geojson').size);
console.log(localidades.map(l => l.nombre + ':' + l.homicidios).join(', '));
