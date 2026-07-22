// Fusión v2: 10 categorías de delito (Policía Nacional / SIEDCO) + Delitos Informáticos (Fiscalía/SPOA)
// histórico anual completo (2003/2010-2026) por departamento, para la barra histórica del dashboard.
//
// NOTA: los archivos JSON crudos que este script lee (hist_nacional_*.json, hist_depto_*.json,
// top_municipios_*.json, etc.) fueron eliminados tras generar colombia_crimen.json para no ocupar
// espacio en disco. Para volver a ejecutar este script hay que re-descargar esos archivos desde
// datos.gov.co (ver las consultas SoQL documentadas en la conversación de origen del proyecto).
// colombia_crimen.json (el resultado final ya fusionado) y js/data.js SÍ están completos y vigentes.
const fs = require('fs');
const path = __dirname;

function load(name) {
  return JSON.parse(fs.readFileSync(path + '/' + name, 'utf8'));
}
function tryLoad(name) {
  try { return load(name); } catch (e) { console.error('missing', name); return []; }
}

const DEPARTAMENTOS = [
  { key: 'AMAZONAS', nombre: 'Amazonas', lat: -1.44, lon: -71.57, capital: 'Leticia' },
  { key: 'ANTIOQUIA', nombre: 'Antioquia', lat: 6.55, lon: -75.83, capital: 'Medellín' },
  { key: 'ARAUCA', nombre: 'Arauca', lat: 6.70, lon: -70.76, capital: 'Arauca' },
  { key: 'ATLANTICO', nombre: 'Atlántico', lat: 10.68, lon: -74.96, capital: 'Barranquilla' },
  { key: 'BOGOTA', nombre: 'Bogotá D.C.', lat: 4.65, lon: -74.10, capital: 'Bogotá' },
  { key: 'BOLIVAR', nombre: 'Bolívar', lat: 8.68, lon: -74.02, capital: 'Cartagena' },
  { key: 'BOYACA', nombre: 'Boyacá', lat: 5.45, lon: -73.36, capital: 'Tunja' },
  { key: 'CALDAS', nombre: 'Caldas', lat: 5.30, lon: -75.50, capital: 'Manizales' },
  { key: 'CAQUETA', nombre: 'Caquetá', lat: 0.87, lon: -73.85, capital: 'Florencia' },
  { key: 'CASANARE', nombre: 'Casanare', lat: 5.75, lon: -71.58, capital: 'Yopal' },
  { key: 'CAUCA', nombre: 'Cauca', lat: 2.45, lon: -76.61, capital: 'Popayán' },
  { key: 'CESAR', nombre: 'Cesar', lat: 9.34, lon: -73.65, capital: 'Valledupar' },
  { key: 'CHOCO', nombre: 'Chocó', lat: 5.70, lon: -76.66, capital: 'Quibdó' },
  { key: 'CORDOBA', nombre: 'Córdoba', lat: 8.30, lon: -75.65, capital: 'Montería' },
  { key: 'CUNDINAMARCA', nombre: 'Cundinamarca', lat: 5.03, lon: -74.03, capital: 'Bogotá' },
  { key: 'GUAINIA', nombre: 'Guainía', lat: 2.58, lon: -68.53, capital: 'Inírida' },
  { key: 'GUAVIARE', nombre: 'Guaviare', lat: 2.04, lon: -72.63, capital: 'San José del Guaviare' },
  { key: 'HUILA', nombre: 'Huila', lat: 2.54, lon: -75.53, capital: 'Neiva' },
  { key: 'GUAJIRA', nombre: 'La Guajira', lat: 11.54, lon: -72.91, capital: 'Riohacha' },
  { key: 'MAGDALENA', nombre: 'Magdalena', lat: 10.24, lon: -74.19, capital: 'Santa Marta' },
  { key: 'META', nombre: 'Meta', lat: 3.27, lon: -73.09, capital: 'Villavicencio' },
  { key: 'NARINO', nombre: 'Nariño', lat: 1.29, lon: -77.36, capital: 'Pasto' },
  { key: 'NORTE DE SANTANDER', nombre: 'Norte de Santander', lat: 7.94, lon: -72.89, capital: 'Cúcuta' },
  { key: 'PUTUMAYO', nombre: 'Putumayo', lat: 0.44, lon: -76.13, capital: 'Mocoa' },
  { key: 'QUINDIO', nombre: 'Quindío', lat: 4.46, lon: -75.67, capital: 'Armenia' },
  { key: 'RISARALDA', nombre: 'Risaralda', lat: 5.32, lon: -75.99, capital: 'Pereira' },
  { key: 'SAN ANDRES', nombre: 'San Andrés y Providencia', lat: 12.58, lon: -81.70, capital: 'San Andrés' },
  { key: 'SANTANDER', nombre: 'Santander', lat: 6.64, lon: -73.47, capital: 'Bucaramanga' },
  { key: 'SUCRE', nombre: 'Sucre', lat: 9.30, lon: -75.40, capital: 'Sincelejo' },
  { key: 'TOLIMA', nombre: 'Tolima', lat: 4.09, lon: -75.15, capital: 'Ibagué' },
  { key: 'VALLE', nombre: 'Valle del Cauca', lat: 3.80, lon: -76.64, capital: 'Cali' },
  { key: 'VAUPES', nombre: 'Vaupés', lat: 0.85, lon: -70.81, capital: 'Mitú' },
  { key: 'VICHADA', nombre: 'Vichada', lat: 4.42, lon: -69.29, capital: 'Puerto Carreño' },
];

function stripAccents(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, ''); }

function normalizeDeptoName(raw) {
  let s = stripAccents(String(raw).toUpperCase().trim());
  s = s.replace(/,?\s*D\.?\s*C\.?$/, '');
  if (s.startsWith('BOGOTA')) return 'BOGOTA';
  if (s.startsWith('LA GUAJIRA') || s === 'GUAJIRA') return 'GUAJIRA';
  if (s.startsWith('VALLE')) return 'VALLE';
  if (s.startsWith('NARI')) return 'NARINO';
  if (s.startsWith('SAN ANDRES') || s.startsWith('ARCHIPIELAGO')) return 'SAN ANDRES';
  if (s.startsWith('NORTE DE SANTANDER')) return 'NORTE DE SANTANDER';
  if (s === 'BOYACA' || s === 'BOYACA.') return 'BOYACA';
  return s;
}

const byKey = {};
DEPARTAMENTOS.forEach(d => { byKey[d.key] = { ...d }; });

const CATS = ['homicidios', 'secuestros', 'extorsion', 'amenazas', 'delitos_sexuales', 'lesiones', 'hurto', 'violencia_intrafamiliar', 'terrorismo', 'estupefacientes'];
// feminicidios es un subconjunto de homicidios (misma fuente, spoa_caracterizacion='FEMINICIDIO'):
// se muestra aparte para análisis pero NO se suma al total nacional para evitar doble conteo.
const CATS_OVERLAY = ['feminicidios'];
const ALL_CATS = CATS.concat(CATS_OVERLAY);
ALL_CATS.forEach(c => { DEPARTAMENTOS.forEach(d => { byKey[d.key][c] = 0; }); });

// "hurto" es un compuesto de 4 fuentes reales de Policía Nacional (personas, residencias, vehículos, otros)
const HURTO_SUBFUENTES = {
  personas: 'hurto_personas',
  residencias: 'hurto_residencias',
  vehiculos: 'hurto',       // 9vha-vh9n: motocicletas + automotores
  otros: 'hurto_extra',     // d4fr-sbn2: abigeato + entidades financieras + piratería terrestre
};

const FILES = {
  homicidios: 'homicidio',
  secuestros: 'secuestro',
  extorsion: 'extorsion',
  amenazas: 'amenazas',
  delitos_sexuales: 'sexuales',
  lesiones: 'lesiones',
  hurto: Object.values(HURTO_SUBFUENTES),
  violencia_intrafamiliar: 'violencia_intrafamiliar',
  terrorismo: 'terrorismo',
  estupefacientes: 'estupefacientes',
  feminicidios: 'feminicidio',
};

// -------- Current period (2025-2026) department totals --------
function applyCurrentPeriod(field, file) {
  const rows = tryLoad(file + '.json');
  rows.forEach(r => {
    const key = normalizeDeptoName(r.departamento);
    if (!byKey[key]) { console.error('Depto no reconocido (actual):', r.departamento, '->', key, file); return; }
    byKey[key][field] += parseFloat(r.total) || 0;
  });
}
applyCurrentPeriod('homicidios', 'homicidio');
applyCurrentPeriod('secuestros', 'secuestro');
applyCurrentPeriod('extorsion', 'extorsion');
applyCurrentPeriod('delitos_sexuales', 'sexuales');
applyCurrentPeriod('violencia_intrafamiliar', 'violencia_intrafamiliar');
applyCurrentPeriod('estupefacientes', 'estupefacientes');
applyCurrentPeriod('hurto', 'hurto_personas_actual');
applyCurrentPeriod('hurto', 'hurto_residencias_actual');
applyCurrentPeriod('hurto', 'hurto');
applyCurrentPeriod('hurto', 'hurto_extra_actual');
applyCurrentPeriod('feminicidios', 'feminicidio_actual');

// amenazas, lesiones, terrorismo: derive current period (2025+2026) from historical depto x year files
function currentFromHistDepto(field, file) {
  const rows = tryLoad('hist_depto_' + file + '.json');
  rows.forEach(r => {
    if (r.anio !== '2025' && r.anio !== '2026') return;
    const key = normalizeDeptoName(r.departamento);
    if (!byKey[key]) { console.error('Depto no reconocido (hist->actual):', r.departamento, '->', key, file); return; }
    byKey[key][field] += parseFloat(r.total) || 0;
  });
}
currentFromHistDepto('amenazas', 'amenazas');
currentFromHistDepto('lesiones', 'lesiones');
currentFromHistDepto('terrorismo', 'terrorismo');

const departamentos = Object.values(byKey).map(d => {
  const total = CATS.reduce((s, c) => s + d[c], 0);
  return { ...d, total };
}).sort((a, b) => b.total - a.total);

// -------- Historical national (yearly) --------
function loadHistNacional(fileKey) {
  return tryLoad('hist_nacional_' + fileKey + '.json').map(r => ({ anio: String(r.anio), total: parseFloat(r.total) || 0 }));
}
const historicoNacional = {};
ALL_CATS.forEach(c => {
  const files = Array.isArray(FILES[c]) ? FILES[c] : [FILES[c]];
  const byYear = {};
  files.forEach(f => {
    loadHistNacional(f).forEach(r => { byYear[r.anio] = (byYear[r.anio] || 0) + r.total; });
  });
  historicoNacional[c] = Object.keys(byYear).sort().map(anio => ({ anio, total: byYear[anio] }));
});

// -------- Historical by department (yearly) : { cat: { deptoKey: {anio: total} } } --------
function loadHistDepto(fileKey) { return tryLoad('hist_depto_' + fileKey + '.json'); }
const historicoDepartamental = {};
ALL_CATS.forEach(c => {
  const files = Array.isArray(FILES[c]) ? FILES[c] : [FILES[c]];
  const byDepto = {};
  DEPARTAMENTOS.forEach(d => { byDepto[d.key] = {}; });
  files.forEach(f => {
    loadHistDepto(f).forEach(r => {
      const key = normalizeDeptoName(r.departamento);
      if (!byDepto[key]) return;
      byDepto[key][String(r.anio)] = (byDepto[key][String(r.anio)] || 0) + (parseFloat(r.total) || 0);
    });
  });
  historicoDepartamental[c] = byDepto;
});

// Range of years actually available per category
const rangoAnios = {};
ALL_CATS.forEach(c => {
  const years = historicoNacional[c].map(r => parseInt(r.anio, 10)).filter(y => y >= 2003 && y <= 2026);
  rangoAnios[c] = { min: Math.min(...years), max: Math.max(...years) };
});
const anioGlobalMin = Math.min(...Object.values(rangoAnios).map(r => r.min));
const anioGlobalMax = Math.max(...Object.values(rangoAnios).map(r => r.max));

// -------- Monthly trend (recent) --------
function monthly(file) {
  return tryLoad(file + '.json').map(r => ({ mes: r.mes.slice(0, 7), total: parseFloat(r.total) }));
}
const tendenciaMensual = {
  homicidios: monthly('homicidio_mensual'),
  extorsion: monthly('extorsion_mensual'),
  secuestros: monthly('secuestro_mensual'),
};

// -------- Top municipios --------
function topMunicipios(file) {
  return tryLoad(file + '.json').map(r => ({ municipio: r.municipio.replace(/\s*\(CT\)\s*$/, ''), departamento: r.departamento, total: parseFloat(r.total) }));
}
function combineTopMunicipios(files) {
  const byKeyM = {};
  files.forEach(f => topMunicipios(f).forEach(m => {
    const k = m.municipio.toUpperCase() + '|' + m.departamento.toUpperCase();
    if (!byKeyM[k]) byKeyM[k] = { municipio: m.municipio, departamento: m.departamento, total: 0 };
    byKeyM[k].total += m.total;
  }));
  return Object.values(byKeyM).sort((a, b) => b.total - a.total).slice(0, 15);
}
const topMunis = {
  homicidios: topMunicipios('top_municipios_homicidio'),
  extorsion: topMunicipios('top_municipios_extorsion'),
  hurto: combineTopMunicipios(['top_municipios_hurto_personas', 'top_municipios_hurto_residencias', 'top_municipios_hurto']),
  amenazas: topMunicipios('top_municipios_amenazas'),
  lesiones: topMunicipios('top_municipios_lesiones'),
};

// -------- Analítica adicional (desgloses demográficos y por modalidad) --------
function breakdown(file, labelField, labelKey) {
  return tryLoad(file + '.json')
    .map(r => ({ [labelKey]: r[labelField], total: parseFloat(r.total) || 0 }))
    .filter(r => r[labelKey]);
}
const analitica = {
  homicidios_arma: breakdown('homicidio_arma', 'arma_medio', 'label'),
  homicidios_sexo: breakdown('homicidio_sexo', 'sexo', 'label'),
  homicidios_modalidad: breakdown('homicidio_modalidad', 'modalidad', 'label'),
  sexuales_delito: breakdown('sexuales_delito', 'delito', 'label'),
  sexuales_genero: breakdown('sexuales_genero', 'genero', 'label'),
  sexuales_grupo_etario: breakdown('sexuales_grupo_etario', 'grupo_etario', 'label'),
  vif_genero: breakdown('vif_genero', 'genero', 'label'),
  vif_grupo_etario: breakdown('vif_grupo_etario', 'grupo_etario', 'label'),
  secuestro_tipo: breakdown('secuestro_tipo', 'tipo_delito', 'label').map(r => ({ ...r, label: r.label.replace(/^ARTICULO \d+\.\s*/i, '') })),
  estupefacientes_tipo: breakdown('estupefacientes_tipo', 'clase_bien', 'label'),
  hurto_composicion: [
    { label: 'Hurto a Personas', total: tryLoad('hurto_personas_actual.json').reduce((s, r) => s + (parseFloat(r.total) || 0), 0) },
    { label: 'Hurto a Residencias', total: tryLoad('hurto_residencias_actual.json').reduce((s, r) => s + (parseFloat(r.total) || 0), 0) },
    { label: 'Motocicletas y Automotores', total: tryLoad('hurto.json').reduce((s, r) => s + (parseFloat(r.total) || 0), 0) },
    { label: 'Abigeato, Entidades Financieras y Piratería Terrestre', total: tryLoad('hurto_extra_actual.json').reduce((s, r) => s + (parseFloat(r.total) || 0), 0) },
  ],
};

// -------- Municipios completos para Antioquia y Valle del Cauca (enriquecimiento) --------
function municipiosCompletos(prefix, cats) {
  const byMuni = {};
  cats.forEach(({ file, field }) => {
    tryLoad(prefix + '_' + file + '.json').forEach(r => {
      const name = r.municipio.replace(/\s*\(CT\)\s*$/, '');
      if (!byMuni[name]) byMuni[name] = { municipio: name, homicidios: 0, extorsion: 0, hurto: 0 };
      byMuni[name][field] = parseFloat(r[field]) || 0;
    });
  });
  return Object.values(byMuni).map(m => ({ ...m, total: m.homicidios + m.extorsion + m.hurto })).sort((a, b) => b.total - a.total);
}
const municipiosDetalle = {
  ANTIOQUIA: municipiosCompletos('antioquia_municipios', [
    { file: 'homicidio', field: 'homicidios' }, { file: 'extorsion', field: 'extorsion' }, { file: 'hurto', field: 'hurto' },
  ]),
  VALLE: municipiosCompletos('valle_municipios', [
    { file: 'homicidio', field: 'homicidios' }, { file: 'extorsion', field: 'extorsion' }, { file: 'hurto', field: 'hurto' },
  ]),
};

// -------- Delitos informáticos (Fiscalía / SPOA) --------
const delitosInformaticos = {
  porAnio: tryLoad('hist_nacional_informaticos.json').map(r => ({ anio: String(r.anio), total: parseFloat(r.total) || 0 })),
  porDepartamento: tryLoad('depto_informaticos.json').map(r => ({ departamento: r.departamento, total: parseFloat(r.total) || 0 })).filter(r => r.departamento !== 'SIN DATO'),
  porTipo: tryLoad('tipos_informaticos.json').map(r => ({ delito: r.delito, total: parseFloat(r.total) || 0 })),
};

// -------- Denuncias Fiscalía (SPOA): Conteo de Procesos V3 (dbdv-iihs) y Conteo de Víctimas V3 (hr73-zqjf) --------
// Agregados vía SoQL ($select + count(*) + $group) directamente sobre datos.gov.co, NO se descargaron los registros crudos
// (el dataset de procesos supera 23 millones de filas). Departamento = lugar de los hechos (departamento_hecho / departamento_hecho_origen).
function porDeptoDesdeConteo(file) {
  const byDepto = {};
  tryLoad(file + '.json').forEach(r => {
    const key = normalizeDeptoName(r.departamento);
    if (!byKey[key]) return; // descarta "Sin Información" y similares
    byDepto[key] = (byDepto[key] || 0) + (parseFloat(r.total) || 0);
  });
  return Object.keys(byDepto)
    .map(key => ({ departamento: byKey[key].nombre, total: byDepto[key] }))
    .sort((a, b) => b.total - a.total);
}
const denunciasFiscalia = {
  procesos: {
    porAnio: tryLoad('hist_nacional_spoa_procesos.json').map(r => ({ anio: String(r.anio), total: parseFloat(r.total) || 0 })),
    porDepartamento: porDeptoDesdeConteo('depto_spoa_procesos'),
    porTipo: tryLoad('tipos_spoa_procesos.json').map(r => ({ delito: r.delito, total: parseFloat(r.total) || 0 })),
  },
  victimas: {
    porAnio: tryLoad('hist_nacional_spoa_victimas.json').map(r => ({ anio: String(r.anio), total: parseFloat(r.total) || 0 })),
    porDepartamento: porDeptoDesdeConteo('depto_spoa_victimas'),
  },
};

// -------- Personas desaparecidas: Instituto Nacional de Medicina Legal y Ciencias Forenses, registro SIRDEC --------
// NOTA: la UBPD (Unidad de Búsqueda de Personas dadas por Desaparecidas) no publica su "Universo de personas dadas por
// desaparecidas" como dataset descargable ni API (solo un visor interactivo tipo Power BI en datos.unidadbusqueda.gov.co).
// Como sustituto verificable y con la misma orden de magnitud, se usa el registro nacional de desapariciones de Medicina
// Legal (SIRDEC, dataset "Desaparecidos en Colombia - Histórico", datos.gov.co id 8hqm-7fdt), filtrado a estado
// "Desaparecido" (personas aún no localizadas). Se cita además la cifra oficial UBPD (universo del conflicto armado) en el
// texto del panel a modo de referencia cruzada.
const desaparecidosUBPD = {
  fuenteReal: 'Instituto Nacional de Medicina Legal y Ciencias Forenses (SIRDEC) — no fue posible obtener el dataset descargable de la UBPD, que solo expone un visor interactivo',
  porAnio: tryLoad('hist_nacional_desaparecidos.json').map(r => ({ anio: String(r.anio), total: parseFloat(r.total) || 0 })),
  porDepartamento: porDeptoDesdeConteo('depto_desaparecidos'),
  porSexo: tryLoad('desaparecidos_sexo.json').map(r => ({ sexo: r.sexo, total: parseFloat(r.total) || 0 })),
  totalRegistroActual: 129895,
  cifraOficialUBPD: { total: 136010, fecha: '2026-07-08', fuente: 'UBPD, boletín de actualización del universo de personas dadas por desaparecidas en razón del conflicto armado' },
};

// -------- Totales nacionales (periodo actual) --------
const totales = ALL_CATS.reduce((acc, c) => { acc[c] = departamentos.reduce((s, d) => s + d[c], 0); return acc; }, {});
totales.total = departamentos.reduce((s, d) => s + d.total, 0);

// -------- Noticias (boletín curado, fuentes reales verificadas vía búsqueda web) --------
const noticias = [
  { titulo: "Homicidio y extorsión disparados en 2026: cifras muestran la mayor subida en 10 años", fuente: "Yahoo Noticias", fecha: "2026-07", url: "https://es-us.noticias.yahoo.com/homicidio-extorsi%C3%B3n-disparados-2026-cifras-151915384.html" },
  { titulo: "Así fue la sexta masacre en Colombia en 2026, ocurrida en Padilla, Cauca", fuente: "Semana", fecha: "2026-07", url: "https://www.semana.com/nacion/medellin/articulo/asi-fue-la-sexta-masacre-en-colombia-en-2026-ocurrida-esta-madrugada-en-padilla-cauca-delincuentes-asesinaron-a-cuatro-personas/202647/" },
  { titulo: "Asesinan a comerciante víctima de extorsión en Soledad: van 600 crímenes en Atlántico", fuente: "Noticias RCN", fecha: "2026-07", url: "https://www.noticiasrcn.com/colombia/asesinan-a-comerciante-victima-de-extorsion-en-soledad-van-600-crimenes-en-atlantico-1036828" },
  { titulo: "Violento asesinato contra hombre de 74 años en un billar de Barranquilla; investigan trasfondo extorsivo", fuente: "El Tiempo", fecha: "2026-07-15", url: "https://www.eltiempo.com/colombia/barranquilla/barranquilla-violento-asesinato-contra-hombre-de-74-anos-que-estaba-dentro-de-un-billar-en-la-luz-autoridades-indagan-posible-trasfondo-extorsivo-3569645" },
  { titulo: "Sicario acabó con la vida del padre de alias '27', excabecilla de 'Los Costeños'", fuente: "El Universal", fecha: "2026-07-16", url: "https://www.eluniversal.com.co/sucesos/2026/07/16/sicario-acabo-con-la-vida-del-papa-de-alias-27-excabecilla-de-la-banda-los-costenos/" },
  { titulo: "Homicidios y secuestro bajaron en Cundinamarca durante el primer semestre de 2026", fuente: "Cambio", fecha: "2026-07", url: "https://cambiocolombia.com/pais/articulo/2026/7/homicidios-bajaron-92-por-ciento-y-el-secuestro-cayo-70-por-ciento-en-cundinamarca-durante-el-primer-semestre-de-2026" },
  { titulo: "Policía alerta por aumento de homicidios en Bogotá derivados de riñas tras partidos del Mundial 2026", fuente: "Infobae", fecha: "2026-07-01", url: "https://www.infobae.com/colombia/2026/07/01/policia-alerta-por-el-aumento-de-homicidios-en-bogota-derivados-de-rinas-tras-los-partidos-de-colombia-en-mundial-2026/" },
  { titulo: "Policía Metropolitana reporta 34 capturas en Cali durante el primer fin de semana de julio", fuente: "El País (Cali)", fecha: "2026-07", url: "https://www.elpais.com.co/judicial/policia-metropolitana-reporta-34-personas-capturadas-en-cali-durante-el-primer-fin-de-semana-de-julio-balance-de-orden-publico-0626.html" },
];

const output = {
  meta: {
    fuente: 'Policía Nacional de Colombia (SIEDCO) vía datos.gov.co + Fiscalía General de la Nación (SPOA) para delitos informáticos, procesos y víctimas + Instituto Nacional de Medicina Legal y Ciencias Forenses (SIRDEC) para personas desaparecidas',
    periodoActual: 'Enero 2025 - Mayo 2026 (mayo parcial)',
    rangoHistorico: { min: anioGlobalMin, max: anioGlobalMax },
    rangoAnios,
    generado: new Date().toISOString(),
    nota: 'Estupefacientes = número de operativos de incautación registrados (no víctimas). Hurto = suma de 4 reportes de Policía Nacional (personas, residencias, motos/autos, abigeato+entidades financieras+piratería terrestre). Feminicidios es un subconjunto de Homicidios (misma fuente SIEDCO) y NO se suma al total nacional para evitar doble conteo. Delitos Informáticos usa año de los hechos (Fiscalía/SPOA), no departamento geolocalizado por SIEDCO.',
  },
  categorias: CATS,
  categoriasOverlay: CATS_OVERLAY,
  totales,
  departamentos,
  tendenciaMensual,
  historicoNacional,
  historicoDepartamental,
  topMunicipios: topMunis,
  delitosInformaticos,
  denunciasFiscalia,
  desaparecidosUBPD,
  municipiosDetalle,
  analitica,
  noticias,
};

if (!totales.total || totales.total < 100000) {
  console.error('ABORTADO: total sospechosamente bajo (' + totales.total + '). Probablemente faltan los JSON crudos de entrada (ver nota al inicio del archivo). No se sobrescribió colombia_crimen.json.');
  process.exit(1);
}
fs.writeFileSync(path + '/colombia_crimen.json', JSON.stringify(output));
console.log('OK. Departamentos:', departamentos.length, '| Total periodo actual:', totales.total, '| Rango histórico:', anioGlobalMin, '-', anioGlobalMax);
