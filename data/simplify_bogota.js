const fs = require('fs');

function perpDist(p, a, b) {
  const [x, y] = p, [x1, y1] = a, [x2, y2] = b;
  const dx = x2 - x1, dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(x - x1, y - y1);
  const t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy);
  const projX = x1 + t * dx, projY = y1 + t * dy;
  return Math.hypot(x - projX, y - projY);
}
function rdp(points, epsilon) {
  if (points.length < 3) return points;
  let maxDist = 0, index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpDist(points[i], points[0], points[points.length - 1]);
    if (d > maxDist) { maxDist = d; index = i; }
  }
  if (maxDist > epsilon) {
    const left = rdp(points.slice(0, index + 1), epsilon);
    const right = rdp(points.slice(index), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [points[0], points[points.length - 1]];
}
function round(n) { return Math.round(n * 1e5) / 1e5; }

const g = JSON.parse(fs.readFileSync(__dirname + '/bogota_localidades.geojson', 'utf8'));
const EPS = 0.0004;
let before = 0, after = 0;
g.features.forEach(f => {
  const geom = f.geometry;
  function simplifyRing(ring) {
    before += ring.length;
    let s = rdp(ring, EPS);
    if (s.length < 4) s = ring.filter((_, i) => i % Math.ceil(ring.length / 4) === 0);
    s = s.map(p => [round(p[0]), round(p[1])]);
    after += s.length;
    return s;
  }
  if (geom.type === 'Polygon') geom.coordinates = geom.coordinates.map(simplifyRing);
  else if (geom.type === 'MultiPolygon') geom.coordinates = geom.coordinates.map(poly => poly.map(simplifyRing));
});
fs.writeFileSync(__dirname + '/bogota_localidades_simplified.geojson', JSON.stringify(g));
console.log('points before:', before, 'after:', after, 'file size:', fs.statSync(__dirname + '/bogota_localidades_simplified.geojson').size);
