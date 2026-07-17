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

// ---- Geometry: filter to Medellín only, simplify ----
const raw = JSON.parse(fs.readFileSync(path + '/medellin_comunas_raw.geojson', 'utf8'));
const EPS = 0.00015;
const features = raw.features.filter(f => f.properties.MUNICIPIO === 'MEDELLIN').map(f => {
  const geom = f.geometry;
  let coords;
  if (geom.type === 'Polygon') coords = geom.coordinates.map(r => simplifyRing(r, EPS));
  else if (geom.type === 'MultiPolygon') coords = geom.coordinates.map(poly => poly.map(r => simplifyRing(r, EPS)));
  return {
    type: 'Feature',
    properties: { key: String(parseInt(f.properties.NUMERO_COM, 10)), nombre: f.properties.NOMBRE_COM },
    geometry: { type: geom.type, coordinates: coords },
  };
});
fs.writeFileSync(path + '/medellin_comunas.geojson', JSON.stringify({ type: 'FeatureCollection', features }));
console.log('geojson features:', features.length, 'size:', fs.statSync(path + '/medellin_comunas.geojson').size);

// ---- CSV data: aggregate by comuna + conducta, keep full yearly history ----
const CONDUCTA_MAP = {
  'Extorsión': 'extorsion',
  'Homicidio': 'homicidios',
  'Hurto a persona': 'hurto_persona',
  'Hurto de carro': 'hurto_carro',
  'Hurto de moto': 'hurto_moto',
  'Hurto a residencia': 'hurto_residencia',
  'Hurto de semoviente': 'hurto_semoviente',
};

const lines = fs.readFileSync(path + '/medellin_comunas.csv', 'utf8').split('\n').filter(Boolean).slice(1);
const comunaNames = {};
features.forEach(f => { comunaNames[f.properties.key] = f.properties.nombre; });

const porComuna = {}; // { comunaKey: { [cat]: total (todos los años) } }
const porAnio = {};   // { cat: { anio: total nacional-comuna (solo Medellín) } }

lines.forEach(line => {
  const parts = line.split(',');
  const anio = parts[0].trim();
  const conducta = parts[1].trim();
  const comunaRaw = parts[2].trim();
  const cantidad = parseFloat(parts[3]) || 0;
  const cat = CONDUCTA_MAP[conducta];
  if (!cat) return;
  const comunaKey = String(parseInt(comunaRaw, 10));
  if (!(comunaKey >= '1' && comunaNames[comunaKey])) return; // descarta corregimientos y SIN DATO para el mapa

  if (!porComuna[comunaKey]) porComuna[comunaKey] = {};
  porComuna[comunaKey][cat] = (porComuna[comunaKey][cat] || 0) + cantidad;

  if (!porAnio[cat]) porAnio[cat] = {};
  porAnio[cat][anio] = (porAnio[cat][anio] || 0) + cantidad;
});

const localidades = features.map(f => {
  const key = f.properties.key;
  const vals = porComuna[key] || {};
  return {
    key, nombre: f.properties.nombre,
    homicidios: vals.homicidios || 0,
    extorsion: vals.extorsion || 0,
    hurto: (vals.hurto_persona || 0) + (vals.hurto_carro || 0) + (vals.hurto_moto || 0) + (vals.hurto_residencia || 0) + (vals.hurto_semoviente || 0),
  };
});

const historicoNacionalMedellin = {};
Object.keys(porAnio).forEach(cat => {
  historicoNacionalMedellin[cat] = Object.keys(porAnio[cat]).sort().map(anio => ({ anio, total: porAnio[cat][anio] }));
});

fs.writeFileSync(path + '/medellin_data.json', JSON.stringify({
  meta: { fuente: 'MEData - Municipio de Medellín', periodo: '2003-2023 (histórico acumulado, última data disponible)' },
  localidades,
  historicoNacional: historicoNacionalMedellin,
}));
console.log('comunas con datos:', localidades.length);
console.log(localidades.map(l => l.nombre + ':H' + l.homicidios).join(', '));
