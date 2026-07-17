(function () {
  'use strict';

  const CATS = [
    { key: 'homicidios', label: 'Homicidios', color: '#ff4d5e' },
    { key: 'secuestros', label: 'Secuestros', color: '#7a6bff' },
    { key: 'extorsion', label: 'Extorsión', color: '#ff9f40' },
    { key: 'amenazas', label: 'Amenazas', color: '#ffd23f' },
    { key: 'delitos_sexuales', label: 'Delitos Sexuales', color: '#ff5ea8' },
    { key: 'lesiones', label: 'Lesiones Personales', color: '#b073ff' },
    { key: 'hurto', label: 'Hurto', color: '#d4e157' },
    { key: 'violencia_intrafamiliar', label: 'Violencia Intrafamiliar', color: '#4a8cff' },
    { key: 'terrorismo', label: 'Terrorismo', color: '#a3123a' },
    { key: 'estupefacientes', label: 'Operativos Antinarcóticos', color: '#35d68a' },
  ];
  const CATS_OVERLAY = [
    { key: 'feminicidios', label: 'Feminicidios', color: '#e0217a', overlay: true },
  ];
  const ALL_CATS = CATS.concat(CATS_OVERLAY);
  const CAT_BY_KEY = Object.fromEntries(ALL_CATS.map(c => [c.key, c]));

  const DATA = CRIMEN_DATA;
  const YEAR_MIN = DATA.meta.rangoHistorico.min;
  const YEAR_MAX = DATA.meta.rangoHistorico.max;

  const state = {
    active: new Set(CATS.map(c => c.key)),
    view: 'tactica',
    mode: 'actual',       // 'actual' | 'historico'
    selectedYear: YEAR_MAX,
    playing: null,
    trendGran: 'mensual',
    trendSerie: 'homicidios',
    muniSerie: 'homicidios',
    deptoMarkers: [],
    muniMarkers: [],
    heatLayer: null,
    choroplethLayer: null,
    cityMode: null,
    cityLayer: null,
  };

  const fmt = n => Math.round(n).toLocaleString('es-CO');

  // ---------------- Generalized value getters (actual vs histórico) ----------------
  function catValueDepto(d, catKey) {
    if (state.mode === 'actual') return d[catKey] || 0;
    const h = DATA.historicoDepartamental[catKey];
    return (h && h[d.key] && h[d.key][String(state.selectedYear)]) || 0;
  }
  function catValueNacional(catKey) {
    if (state.mode === 'actual') return DATA.totales[catKey] || 0;
    const serie = DATA.historicoNacional[catKey] || [];
    const row = serie.find(r => r.anio === String(state.selectedYear));
    return row ? row.total : 0;
  }
  function activeTotalDepto(d) {
    let t = 0;
    state.active.forEach(k => t += catValueDepto(d, k));
    return t;
  }
  function activeTotalNacional() {
    let t = 0;
    state.active.forEach(k => t += catValueNacional(k));
    return t;
  }
  function dominantCategory(d) {
    let best = null, bestVal = -1;
    CATS.forEach(c => {
      if (!state.active.has(c.key)) return;
      const v = catValueDepto(d, c.key);
      if (v > bestVal) { bestVal = v; best = c; }
    });
    return best || CATS[0];
  }

  // ---------------- Map init ----------------
  const map = L.map('map', {
    zoomControl: false, minZoom: 5, maxZoom: 11, worldCopyJump: false,
    maxBounds: [[-6, -85], [16, -60]],
  }).setView([4.2, -74.5], 6);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO — Datos: Policía Nacional (SIEDCO) / Fiscalía (SPOA)',
    subdomains: 'abcd', maxZoom: 12,
  }).addTo(map);

  // ---------------- Escala de color por intensidad (verde -> rojo) ----------------
  const INTENSITY_STOPS = [
    [0.00, [53, 214, 138]],   // verde
    [0.30, [168, 214, 74]],   // verde-lima
    [0.55, [244, 208, 63]],   // amarillo
    [0.78, [255, 159, 64]],   // naranja
    [1.00, [255, 77, 94]],    // rojo
  ];
  function intensityColor(t) {
    t = Math.max(0, Math.min(1, t));
    let a = INTENSITY_STOPS[0], b = INTENSITY_STOPS[INTENSITY_STOPS.length - 1];
    for (let i = 0; i < INTENSITY_STOPS.length - 1; i++) {
      if (t >= INTENSITY_STOPS[i][0] && t <= INTENSITY_STOPS[i + 1][0]) { a = INTENSITY_STOPS[i]; b = INTENSITY_STOPS[i + 1]; break; }
    }
    const span = b[0] - a[0] || 1;
    const f = (t - a[0]) / span;
    const r = Math.round(a[1][0] + (b[1][0] - a[1][0]) * f);
    const g = Math.round(a[1][1] + (b[1][1] - a[1][1]) * f);
    const bl = Math.round(a[1][2] + (b[1][2] - a[1][2]) * f);
    return `rgb(${r},${g},${bl})`;
  }

  // ---------------- Tarjeta flotante al pasar mouse/dedo sobre un área ----------------
  const hoverCardEl = document.getElementById('mapHoverCard');
  function positionHoverCard(e) {
    const oe = e.originalEvent;
    if (!oe) return;
    const pt = oe.touches && oe.touches[0] ? oe.touches[0] : oe;
    let x = pt.clientX + 18, y = pt.clientY + 18;
    const rect = hoverCardEl.getBoundingClientRect();
    if (x + rect.width > window.innerWidth - 10) x = pt.clientX - rect.width - 18;
    if (y + rect.height > window.innerHeight - 10) y = pt.clientY - rect.height - 18;
    hoverCardEl.style.left = Math.max(8, x) + 'px';
    hoverCardEl.style.top = Math.max(8, y) + 'px';
  }
  function showHoverCard(title, total, cat, color, e) {
    hoverCardEl.innerHTML = `
      <div class="hover-card-bar" style="background:${color}"></div>
      <div class="hover-card-body">
        <div class="hover-card-title">${title}</div>
        <div class="hover-card-total">${fmt(total)}<span>casos</span></div>
        ${cat ? `<div class="hover-card-cat"><span class="dot" style="background:${cat.color};color:${cat.color}"></span>${cat.label} predominante</div>` : ''}
        <div class="hover-card-hint">Toca para ver el detalle completo</div>
      </div>`;
    hoverCardEl.classList.add('show');
    positionHoverCard(e);
  }
  function hideHoverCard() { hoverCardEl.classList.remove('show'); }

  // ---------------- Legend ----------------
  function renderLegend() {
    const ul = document.getElementById('categoryList');
    ul.innerHTML = '';
    CATS.forEach(c => {
      const total = catValueNacional(c.key);
      const li = document.createElement('li');
      li.className = 'cat-item' + (state.active.has(c.key) ? ' checked' : '');
      li.innerHTML = `
        <div class="cat-checkbox"></div>
        <div class="cat-dot" style="background:${c.color}; color:${c.color}"></div>
        <div class="cat-name">${c.label}</div>
        <div class="cat-count">${fmt(total)}</div>
      `;
      li.addEventListener('click', () => {
        if (state.active.has(c.key)) state.active.delete(c.key); else state.active.add(c.key);
        renderLegend();
        renderAll();
      });
      ul.appendChild(li);
    });
    CATS_OVERLAY.forEach(c => {
      const total = catValueNacional(c.key);
      const li = document.createElement('li');
      li.className = 'cat-item overlay' + (state.active.has(c.key) ? ' checked' : '');
      li.title = 'Subconjunto de Homicidios — no se suma al total para evitar doble conteo';
      li.innerHTML = `
        <div class="cat-checkbox"></div>
        <div class="cat-dot" style="background:${c.color}; color:${c.color}"></div>
        <div class="cat-name">${c.label} <span class="overlay-tag">subconjunto</span></div>
        <div class="cat-count">${fmt(total)}</div>
      `;
      li.addEventListener('click', () => {
        if (state.active.has(c.key)) state.active.delete(c.key); else state.active.add(c.key);
        renderLegend();
        renderAll();
      });
      ul.appendChild(li);
    });
    document.getElementById('totalNacional').textContent = fmt(activeTotalNacional());
    document.getElementById('periodoLabel').textContent = state.mode === 'actual'
      ? 'Periodo: enero 2025 – mayo 2026*.'
      : `Periodo: año ${state.selectedYear} (histórico).`;
  }

  // ---------------- Markers ----------------
  function clearMarkers() {
    state.deptoMarkers.forEach(m => map.removeLayer(m));
    state.muniMarkers.forEach(m => map.removeLayer(m));
    state.deptoMarkers = [];
    state.muniMarkers = [];
  }
  function clearChoropleth() {
    if (state.choroplethLayer) { map.removeLayer(state.choroplethLayer); state.choroplethLayer = null; }
  }

  function renderChoropleth() {
    clearChoropleth();
    const totals = DATA.departamentos.map(activeTotalDepto);
    const maxTotal = Math.max(...totals, 1);
    state.choroplethLayer = L.geoJSON(COLOMBIA_GEOJSON, {
      style: (feature) => {
        const d = DATA.departamentos.find(x => x.key === feature.properties.key);
        const total = d ? activeTotalDepto(d) : 0;
        const intensity = total / maxTotal;
        return {
          color: 'rgba(255,255,255,0.22)', weight: 1.2,
          fillColor: intensityColor(intensity), fillOpacity: 0.16 + intensity * 0.5,
        };
      },
      onEachFeature: (feature, layer) => {
        const d = DATA.departamentos.find(x => x.key === feature.properties.key);
        if (!d) return;
        layer.on({
          mouseover: (e) => {
            const l = e.target;
            const el = l.getElement && l.getElement();
            if (el) el.classList.add('geo-hover');
            l.setStyle({ weight: 3, color: '#ffffff' });
            l.bringToFront();
            const total = activeTotalDepto(d);
            const intensity = total / maxTotal;
            showHoverCard(d.nombre, total, dominantCategory(d), intensityColor(intensity), e);
          },
          mousemove: (e) => positionHoverCard(e),
          mouseout: (e) => {
            const el = e.target.getElement && e.target.getElement();
            if (el) el.classList.remove('geo-hover');
            state.choroplethLayer.resetStyle(e.target);
            hideHoverCard();
          },
          click: () => { hideHoverCard(); showDetail(d); },
        });
      },
    }).addTo(map);
    state.choroplethLayer.bringToBack();
  }

  function findDeptoFor(deptoRawName) {
    const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
    const target = norm(deptoRawName).replace(/,?\s+D\.?C\.?$/, '');
    return DATA.departamentos.find(d => {
      const n = norm(d.nombre);
      return n.includes(target.split(' ')[0]) || target.includes(n.split(' ')[0]);
    });
  }
  function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }

  function renderTactica() {
    clearMarkers();
    renderChoropleth();

    if (state.mode === 'actual') {
      const muniMap = new Map();
      ['homicidios', 'extorsion', 'hurto', 'amenazas', 'lesiones'].forEach(serie => {
        (DATA.topMunicipios[serie] || []).forEach(m => {
          const k = m.municipio + '|' + m.departamento;
          if (!muniMap.has(k)) muniMap.set(k, m);
        });
      });
      muniMap.forEach(m => {
        const base = findDeptoFor(m.departamento);
        if (!base) return;
        const seed = hashStr(m.municipio);
        const jitter = 0.35;
        const lat = base.lat + (((seed % 100) / 100) - 0.5) * jitter;
        const lon = base.lon + ((((seed >> 3) % 100) / 100) - 0.5) * jitter;
        const icon = L.divIcon({ className: '', html: '<div class="muni-pin"></div>', iconSize: [8, 8] });
        const marker = L.marker([lat, lon], { icon }).addTo(map);
        marker.bindTooltip(`<b>${m.municipio}</b> · ${m.departamento}<br>${fmt(m.total)} casos`, { direction: 'top' });
        state.muniMarkers.push(marker);
      });
    }
  }

  function renderCalor() {
    clearMarkers();
    clearChoropleth();
    if (state.heatLayer) { map.removeLayer(state.heatLayer); state.heatLayer = null; }
    const points = [];
    const totals = DATA.departamentos.map(activeTotalDepto);
    const maxTotal = Math.max(...totals, 1);
    DATA.departamentos.forEach(d => {
      const total = activeTotalDepto(d);
      if (total <= 0) return;
      const intensity = total / maxTotal;
      const n = 6;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2;
        const spread = 0.5 + intensity * 0.6;
        points.push([d.lat + Math.sin(ang) * spread * 0.4, d.lon + Math.cos(ang) * spread * 0.4, intensity]);
      }
      points.push([d.lat, d.lon, intensity * 1.6]);
    });
    state.heatLayer = L.heatLayer(points, {
      radius: 42, blur: 38, maxZoom: 9, minOpacity: 0.25,
      gradient: { 0.2: '#3fb6ff', 0.4: '#35d68a', 0.6: '#f4d03f', 0.8: '#ff9f40', 1.0: '#ff4d5e' },
    }).addTo(map);
  }

  function renderAll() {
    if (state.cityMode) { renderCity(); renderLegend(); return; }
    if (state.view === 'tactica') renderTactica(); else renderCalor();
    renderRanking();
    renderLegend();
  }

  // ---------------- Drill-down por ciudad (localidades / comunas) ----------------
  const CITY_CONFIGS = {
    BOGOTA: {
      nombre: 'Bogotá D.C.', deptoKey: 'BOGOTA',
      geojson: () => BOGOTA_LOCALIDADES_GEOJSON, data: () => BOGOTA_LOCALIDADES_DATA,
      fields: ['homicidios', 'lesiones', 'hurto', 'delitos_sexuales', 'violencia_intrafamiliar'],
      unidad: 'localidad', periodo: 'Enero – Mayo 2026',
      fuente: 'Secretaría Distrital de Seguridad, Convivencia y Justicia (SDSCJ)',
    },
    MEDELLIN: {
      nombre: 'Medellín', deptoKey: 'ANTIOQUIA',
      geojson: () => MEDELLIN_GEOJSON, data: () => MEDELLIN_DATA.localidades,
      fields: ['homicidios', 'extorsion', 'hurto'],
      unidad: 'comuna', periodo: '2003 – 2023 (acumulado histórico)',
      fuente: 'MEData · Municipio de Medellín',
    },
    CALI: {
      nombre: 'Cali', deptoKey: 'VALLE',
      geojson: () => CALI_GEOJSON, data: () => CALI_DATA.localidades,
      fields: ['homicidios'],
      unidad: 'comuna', periodo: 'Año 2024',
      fuente: 'Observatorio de Seguridad · Alcaldía de Santiago de Cali',
    },
    BUCARAMANGA: {
      nombre: 'Bucaramanga', deptoKey: 'SANTANDER',
      geojson: () => BUCARAMANGA_GEOJSON, data: () => BUCARAMANGA_DATA.localidades,
      fields: ['homicidios', 'feminicidios', 'extorsion', 'amenazas', 'delitos_sexuales', 'lesiones', 'hurto', 'violencia_intrafamiliar', 'terrorismo'],
      unidad: 'comuna', periodo: '2016 – marzo 2026',
      fuente: 'Alcaldía de Bucaramanga · Observatorio de Seguridad y Convivencia Ciudadana',
    },
  };

  function clearCity() {
    if (state.cityLayer) { map.removeLayer(state.cityLayer); state.cityLayer = null; }
  }
  function localidadTotal(loc, fields) {
    let t = 0;
    fields.forEach(k => { if (state.active.has(k)) t += loc[k] || 0; });
    return t;
  }
  function localidadDominant(loc, fields) {
    let best = null, bestVal = -1;
    fields.forEach(k => {
      if (!state.active.has(k)) return;
      const v = loc[k] || 0;
      if (v > bestVal) { bestVal = v; best = CAT_BY_KEY[k]; }
    });
    return best || CAT_BY_KEY[fields[0]];
  }
  function renderCity() {
    clearMarkers();
    clearChoropleth();
    if (state.heatLayer) { map.removeLayer(state.heatLayer); state.heatLayer = null; }
    clearCity();
    const cfg = CITY_CONFIGS[state.cityMode];
    const data = cfg.data();
    const fields = cfg.fields;
    const maxTotal = Math.max(...data.map(l => localidadTotal(l, fields)), 1);
    state.cityLayer = L.geoJSON(cfg.geojson(), {
      style: (feature) => {
        const loc = data.find(l => l.key === feature.properties.key);
        const total = loc ? localidadTotal(loc, fields) : 0;
        const intensity = total / maxTotal;
        return { color: 'rgba(255,255,255,0.35)', weight: 1.2, fillColor: intensityColor(intensity), fillOpacity: 0.18 + intensity * 0.55 };
      },
      onEachFeature: (feature, layer) => {
        const loc = data.find(l => l.key === feature.properties.key);
        if (!loc) return;
        layer.on({
          mouseover: (e) => {
            const l = e.target;
            const el = l.getElement && l.getElement();
            if (el) el.classList.add('geo-hover');
            l.setStyle({ weight: 2.5, color: '#fff' });
            l.bringToFront();
            const total = localidadTotal(loc, fields);
            const intensity = total / maxTotal;
            showHoverCard(loc.nombre, total, localidadDominant(loc, fields), intensityColor(intensity), e);
          },
          mousemove: (e) => positionHoverCard(e),
          mouseout: (e) => {
            const el = e.target.getElement && e.target.getElement();
            if (el) el.classList.remove('geo-hover');
            state.cityLayer.resetStyle(e.target);
            hideHoverCard();
          },
          click: () => { hideHoverCard(); showLocalidadDetail(loc, cfg); },
        });
      },
    }).addTo(map);
    map.flyToBounds(state.cityLayer.getBounds(), { duration: 1.1, padding: [40, 40] });
  }
  function showLocalidadDetail(loc, cfg) {
    const card = document.getElementById('detailCard');
    const metrics = cfg.fields.map(k => `
      <div class="detail-metric">
        <div class="dot" style="background:${CAT_BY_KEY[k].color}"></div>
        <div class="info"><div class="val">${fmt(loc[k] || 0)}</div><div class="lbl">${CAT_BY_KEY[k].label}</div></div>
      </div>`).join('');
    document.getElementById('detailContent').innerHTML = `
      <div class="detail-title">${loc.nombre}</div>
      <div class="detail-sub">${cfg.unidad === 'comuna' ? 'Comuna' : 'Localidad'} de ${cfg.nombre} · ${cfg.periodo}</div>
      <div class="detail-grid">${metrics}</div>
      <div class="detail-total"><span>Total ${cfg.unidad}</span><span class="val">${fmt(localidadTotal(loc, cfg.fields))}</span></div>
      <div class="fine-print" style="margin-top:10px">Fuente: ${cfg.fuente}.</div>
    `;
    card.classList.remove('hidden');
    requestAnimationFrame(() => card.classList.add('show'));
  }

  function enterCity(cityKey) {
    stopPlaying();
    state.mode = 'actual';
    state.cityMode = cityKey;
    document.getElementById('backToCountryBtn').classList.remove('hidden');
    document.getElementById('backToCountryBtn').textContent = '← Volver a Colombia';
    document.getElementById('timeBar').classList.add('disabled');
    renderAll();
  }
  function exitCity() {
    state.cityMode = null;
    clearCity();
    document.getElementById('backToCountryBtn').classList.add('hidden');
    document.getElementById('timeBar').classList.remove('disabled');
    map.flyTo([4.2, -74.5], 6, { duration: 1.1 });
    renderAll();
  }
  document.getElementById('backToCountryBtn').addEventListener('click', exitCity);

  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.view = btn.dataset.view;
      renderAll();
    });
  });

  // ---------------- Collapsible panels ----------------
  function togglePanelSmooth(panel) {
    const body = panel.querySelector('.panel-body');
    const collapsing = !panel.classList.contains('collapsed');
    if (collapsing) {
      body.style.maxHeight = body.scrollHeight + 'px';
      void body.offsetHeight; // fuerza reflow para que la transición anime desde la altura actual
      body.style.maxHeight = '0px';
    } else {
      body.style.maxHeight = body.scrollHeight + 'px';
      const onEnd = () => { body.style.maxHeight = ''; body.removeEventListener('transitionend', onEnd); };
      body.addEventListener('transitionend', onEnd);
    }
    panel.classList.toggle('collapsed');
  }
  function wireCollapse(headId, panelId, btnId) {
    const head = document.getElementById(headId);
    head.addEventListener('click', () => {
      const panel = document.getElementById(panelId);
      togglePanelSmooth(panel);
      document.getElementById(btnId).textContent = panel.classList.contains('collapsed') ? '+' : '–';
    });
  }
  wireCollapse('legendHead', 'legendPanel', 'legendCollapse');
  wireCollapse('newsHead', 'newsPanel', 'newsCollapse');
  document.getElementById('statsPanel').querySelector('.panel-head').addEventListener('click', () => {
    const panel = document.getElementById('statsPanel');
    togglePanelSmooth(panel);
    document.getElementById('statsCollapse').textContent = panel.classList.contains('collapsed') ? '+' : '–';
  });

  // ---------------- Stats: totals ----------------
  function renderTopStats() {
    document.getElementById('statTotal').textContent = fmt(state.mode === 'actual' ? DATA.totales.total : sumAllCatsForYear(state.selectedYear));
    document.getElementById('footTotal').textContent = fmt(DATA.totales.total);
  }
  function sumAllCatsForYear(year) {
    return CATS.reduce((s, c) => {
      const serie = DATA.historicoNacional[c.key] || [];
      const row = serie.find(r => r.anio === String(year));
      return s + (row ? row.total : 0);
    }, 0);
  }

  // ---------------- Trend chart ----------------
  function trendTabsFor(gran) {
    if (gran === 'mensual') return ['homicidios', 'extorsion', 'secuestros'];
    return CATS.map(c => c.key);
  }
  function renderTrendTabs() {
    const keys = trendTabsFor(state.trendGran);
    if (!keys.includes(state.trendSerie)) state.trendSerie = keys[0];
    const el = document.getElementById('trendTabs');
    el.innerHTML = keys.map(k => `<button class="trend-tab${k === state.trendSerie ? ' active' : ''}" data-serie="${k}">${CAT_BY_KEY[k] ? CAT_BY_KEY[k].label : k}</button>`).join('');
    el.querySelectorAll('.trend-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        state.trendSerie = btn.dataset.serie;
        renderTrendTabs();
        renderTrend();
      });
    });
  }

  function renderTrend() {
    const serie = state.trendGran === 'mensual' ? DATA.tendenciaMensual[state.trendSerie] : DATA.historicoNacional[state.trendSerie];
    if (!serie || !serie.length) { document.getElementById('trendChart').innerHTML = ''; return; }
    const w = 288, h = 110, pad = 6;
    const vals = serie.map(s => s.total);
    const max = Math.max(...vals), min = Math.min(...vals);
    const span = Math.max(max - min, 1);
    const stepX = (w - pad * 2) / Math.max(serie.length - 1, 1);
    const pts = serie.map((s, i) => {
      const x = pad + i * stepX;
      const y = h - pad - ((s.total - min) / span) * (h - pad * 2);
      return [x, y];
    });
    const line = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    const area = line + ` L${pts[pts.length - 1][0]},${h} L${pts[0][0]},${h} Z`;
    const color = (CAT_BY_KEY[state.trendSerie] && CAT_BY_KEY[state.trendSerie].color) || '#3fb6ff';
    const dots = pts.map(p => `<circle class="trend-dot" cx="${p[0]}" cy="${p[1]}" r="3"></circle>`).join('');
    const firstLbl = state.trendGran === 'mensual' ? serie[0].mes : serie[0].anio;
    const lastLbl = state.trendGran === 'mensual' ? serie[serie.length - 1].mes : serie[serie.length - 1].anio;

    document.getElementById('trendChart').innerHTML = `
      <svg viewBox="0 0 ${w} ${h + 14}">
        <path class="trend-area" d="${area}" style="fill:${color}"></path>
        <path class="trend-path" d="${line}" style="stroke:${color}"></path>
        ${dots}
        <text class="trend-tick" x="${pad}" y="${h + 12}">${firstLbl}</text>
        <text class="trend-tick" x="${w - pad}" y="${h + 12}" text-anchor="end">${lastLbl}</text>
      </svg>
    `;
  }

  document.querySelectorAll('.gran-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.gran-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.trendGran = btn.dataset.gran;
      document.querySelector('.section-title-row .section-title').textContent =
        'TENDENCIA NACIONAL' + (state.trendGran === 'mensual' ? ' (24 meses)' : ` (${YEAR_MIN}-${YEAR_MAX})`);
      renderTrendTabs();
      renderTrend();
    });
  });

  // ---------------- Ranking ----------------
  function renderRanking() {
    const sorted = [...DATA.departamentos].sort((a, b) => activeTotalDepto(b) - activeTotalDepto(a)).slice(0, 8);
    const max = activeTotalDepto(sorted[0]) || 1;
    const el = document.getElementById('rankingList');
    el.innerHTML = sorted.map((d, i) => {
      const t = activeTotalDepto(d);
      return `
        <div class="rank-row" data-key="${d.key}">
          <div class="rank-idx">${i + 1}</div>
          <div class="rank-name" title="${d.nombre}">${d.nombre}</div>
          <div class="rank-bar-track"><div class="rank-bar-fill" style="width:${(t / max) * 100}%"></div></div>
          <div class="rank-val">${fmt(t)}</div>
        </div>`;
    }).join('');
    el.querySelectorAll('.rank-row').forEach(row => {
      row.addEventListener('click', () => {
        const d = DATA.departamentos.find(x => x.key === row.dataset.key);
        flyToDepto(d);
        showDetail(d);
      });
    });
  }

  // ---------------- Municipios ----------------
  function renderMuniList() {
    const label = CAT_BY_KEY[state.muniSerie] ? CAT_BY_KEY[state.muniSerie].label : state.muniSerie;
    document.getElementById('muniTitle').innerHTML = 'TOP MUNICIPIOS · ' + label.toUpperCase();
    const list = DATA.topMunicipios[state.muniSerie] || [];
    document.getElementById('muniList').innerHTML = list.slice(0, 10).map(m => `
      <div class="muni-row">
        <span><span class="muni-name">${m.municipio}</span><span class="muni-depto">${m.departamento}</span></span>
        <span class="muni-val">${fmt(m.total)}</span>
      </div>
    `).join('') || '<div class="fine-print">Sin datos de municipios para esta categoría.</div>';
  }
  function renderMuniTabs() {
    const keys = Object.keys(DATA.topMunicipios);
    const el = document.getElementById('muniTabs');
    el.innerHTML = keys.map(k => `<button class="muni-tab${k === state.muniSerie ? ' active' : ''}" data-serie="${k}">${CAT_BY_KEY[k] ? CAT_BY_KEY[k].label : k}</button>`).join('');
    el.querySelectorAll('.muni-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        state.muniSerie = btn.dataset.serie;
        renderMuniTabs();
        renderMuniList();
      });
    });
  }

  // ---------------- Delitos informáticos ----------------
  function renderCyber() {
    const serie = DATA.delitosInformaticos.porAnio;
    const w = 288, h = 60, pad = 4;
    const vals = serie.map(s => s.total);
    const max = Math.max(...vals), min = Math.min(...vals);
    const span = Math.max(max - min, 1);
    const stepX = (w - pad * 2) / Math.max(serie.length - 1, 1);
    const pts = serie.map((s, i) => [pad + i * stepX, h - pad - ((s.total - min) / span) * (h - pad * 2)]);
    const line = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    const area = line + ` L${pts[pts.length - 1][0]},${h} L${pts[0][0]},${h} Z`;
    document.getElementById('cyberChart').innerHTML = `
      <svg viewBox="0 0 ${w} ${h}">
        <path d="${area}" style="fill:#35d68a22"></path>
        <path d="${line}" style="fill:none;stroke:#35d68a;stroke-width:2"></path>
      </svg>`;
    const topDepto = DATA.delitosInformaticos.porDepartamento[0];
    const tipos = DATA.delitosInformaticos.porTipo.slice(0, 3);
    document.getElementById('cyberTop').innerHTML = `
      <div class="cyber-row"><span class="cyber-name">Total histórico (2010–2026)</span><span class="cyber-val">${fmt(DATA.delitosInformaticos.porAnio.reduce((s, r) => s + r.total, 0))}</span></div>
      <div class="cyber-row"><span class="cyber-name">Depto. líder: ${topDepto.departamento}</span><span class="cyber-val">${fmt(topDepto.total)}</span></div>
      ${tipos.map(t => `<div class="cyber-row"><span class="cyber-name" title="${t.delito}">${t.delito.split('.')[0].replace(/ART.*$/i, '').trim().slice(0, 34)}</span><span class="cyber-val">${fmt(t.total)}</span></div>`).join('')}
    `;
  }

  // ---------------- Analítica demográfica ----------------
  const ANALITICA_OPTS = [
    { key: 'homicidios_modalidad', label: 'Homicidios · Modalidad' },
    { key: 'homicidios_arma', label: 'Homicidios · Arma' },
    { key: 'homicidios_sexo', label: 'Homicidios · Sexo' },
    { key: 'hurto_composicion', label: 'Hurto · Composición' },
    { key: 'secuestro_tipo', label: 'Secuestro · Tipo' },
    { key: 'estupefacientes_tipo', label: 'Estupefacientes · Sustancia' },
    { key: 'sexuales_delito', label: 'D. Sexuales · Tipo' },
    { key: 'sexuales_genero', label: 'D. Sexuales · Género' },
    { key: 'sexuales_grupo_etario', label: 'D. Sexuales · Edad' },
    { key: 'vif_genero', label: 'V. Intrafamiliar · Género' },
    { key: 'vif_grupo_etario', label: 'V. Intrafamiliar · Edad' },
  ];
  function renderAnaliticaSelect() {
    const sel = document.getElementById('analiticaSelect');
    sel.innerHTML = ANALITICA_OPTS.map(o => `<option value="${o.key}">${o.label}</option>`).join('');
    sel.addEventListener('change', renderAnaliticaList);
  }
  function renderAnaliticaList() {
    const key = document.getElementById('analiticaSelect').value;
    const rows = (DATA.analitica[key] || []).slice(0, 8);
    const max = Math.max(...rows.map(r => r.total), 1);
    document.getElementById('analiticaList').innerHTML = rows.map(r => `
      <div class="analitica-row">
        <div class="analitica-name" title="${r.label}">${r.label}</div>
        <div class="analitica-bar-track"><div class="analitica-bar-fill" style="width:${(r.total / max) * 100}%"></div></div>
        <div class="analitica-val">${fmt(r.total)}</div>
      </div>`).join('') || '<div class="fine-print">Sin datos.</div>';
  }

  // ---------------- Noticias ----------------
  function renderNews() {
    const el = document.getElementById('newsList');
    el.innerHTML = DATA.noticias.map(n => `
      <a class="news-item" href="${n.url}" target="_blank" rel="noopener noreferrer">
        <div class="news-title">${n.titulo}</div>
        <div class="news-meta"><span class="src">${n.fuente}</span><span>·</span><span>${n.fecha}</span></div>
      </a>
    `).join('');
  }

  // ---------------- Detail card ----------------
  function showDetail(d) {
    const card = document.getElementById('detailCard');
    const metrics = CATS.map(c => `
      <div class="detail-metric">
        <div class="dot" style="background:${c.color}"></div>
        <div class="info">
          <div class="val">${fmt(catValueDepto(d, c.key))}</div>
          <div class="lbl">${c.label}</div>
        </div>
      </div>
    `).join('');
    const total = activeTotalDepto(d);
    const cityKey = Object.keys(CITY_CONFIGS).find(k => CITY_CONFIGS[k].deptoKey === d.key);
    const cfg = cityKey ? CITY_CONFIGS[cityKey] : null;
    const drillDown = cfg
      ? `<button id="verLocalidadesBtn" class="drill-btn" data-city="${cityKey}">Ver ${cfg.data().length} ${cfg.unidad === 'comuna' ? 'comunas' : 'localidades'} de ${cfg.nombre} →</button>` : '';
    const munis = DATA.municipiosDetalle && DATA.municipiosDetalle[d.key];
    const municipiosSection = munis ? `
      <button id="toggleMunisBtn" class="drill-btn drill-btn-alt">Ver los ${munis.length} municipios de ${d.nombre} (2025-2026) ▾</button>
      <div id="municipiosFullList" class="munis-full-list hidden"></div>
    ` : '';
    document.getElementById('detailContent').innerHTML = `
      <div class="detail-title">${d.nombre}</div>
      <div class="detail-sub">Capital: ${d.capital} · ${state.mode === 'actual' ? 'Enero 2025 – Mayo 2026' : 'Año ' + state.selectedYear}</div>
      <div class="detail-grid">${metrics}</div>
      <div class="detail-total"><span>Total departamental</span><span class="val">${fmt(total)}</span></div>
      ${drillDown}
      ${municipiosSection}
    `;
    card.classList.remove('hidden');
    requestAnimationFrame(() => card.classList.add('show'));
    const btn = document.getElementById('verLocalidadesBtn');
    if (btn) btn.addEventListener('click', () => {
      card.classList.remove('show');
      setTimeout(() => card.classList.add('hidden'), 200);
      enterCity(btn.dataset.city);
    });
    const toggleBtn = document.getElementById('toggleMunisBtn');
    if (toggleBtn) toggleBtn.addEventListener('click', () => {
      const list = document.getElementById('municipiosFullList');
      const opening = list.classList.contains('hidden');
      if (opening && !list.dataset.filled) {
        list.innerHTML = munis.map((m, i) => `
          <div class="muni-full-row">
            <span class="muni-full-idx">${i + 1}</span>
            <span class="muni-full-name">${m.municipio}</span>
            <span class="muni-full-vals" title="Homicidios / Extorsión / Hurto a personas">${fmt(m.homicidios)} · ${fmt(m.extorsion)} · ${fmt(m.hurto)}</span>
          </div>`).join('');
        list.dataset.filled = '1';
      }
      list.classList.toggle('hidden');
      toggleBtn.textContent = toggleBtn.textContent.replace(opening ? '▾' : '▴', opening ? '▴' : '▾');
    });
  }
  document.getElementById('detailClose').addEventListener('click', () => {
    const card = document.getElementById('detailCard');
    card.classList.remove('show');
    setTimeout(() => card.classList.add('hidden'), 250);
  });

  function flyToDepto(d) { map.flyTo([d.lat, d.lon], 7.5, { duration: 1.1 }); }

  // ---------------- Search ----------------
  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');
  function buildSearchIndex() {
    const items = DATA.departamentos.map(d => ({ type: 'Departamento', name: d.nombre, ref: d }));
    const seen = new Set();
    Object.values(DATA.topMunicipios).flat().forEach(m => {
      const k = m.municipio + m.departamento;
      if (seen.has(k)) return;
      seen.add(k);
      items.push({ type: 'Municipio', name: m.municipio, depto: m.departamento, ref: m });
    });
    return items;
  }
  const searchIndex = buildSearchIndex();
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    if (!q) { searchResults.classList.remove('show'); return; }
    const matches = searchIndex.filter(it => it.name.toLowerCase().includes(q)).slice(0, 8);
    if (!matches.length) { searchResults.classList.remove('show'); return; }
    searchResults.innerHTML = matches.map((it, i) => `
      <div class="search-item" data-i="${i}"><b>${it.name}</b><span>${it.type}${it.depto ? ' · ' + it.depto : ''}</span></div>
    `).join('');
    searchResults.classList.add('show');
    searchResults.querySelectorAll('.search-item').forEach((el, i) => {
      el.addEventListener('click', () => {
        const it = matches[i];
        if (it.type === 'Departamento') { flyToDepto(it.ref); showDetail(it.ref); }
        else { const base = findDeptoFor(it.depto); if (base) map.flyTo([base.lat, base.lon], 8.5, { duration: 1.1 }); }
        searchResults.classList.remove('show');
        searchInput.value = it.name;
      });
    });
  });
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) searchResults.classList.remove('show');
  });

  // ---------------- Time bar (barra histórica) ----------------
  const yearSlider = document.getElementById('yearSlider');
  const yearLabel = document.getElementById('yearLabel');
  const liveBtn = document.getElementById('liveBtn');
  const playBtn = document.getElementById('playBtn');

  yearSlider.min = YEAR_MIN;
  yearSlider.max = YEAR_MAX;
  yearSlider.value = YEAR_MAX;

  function renderSparkline() {
    const w = 1000, h = 40;
    const years = [];
    for (let y = YEAR_MIN; y <= YEAR_MAX; y++) years.push(y);
    const vals = years.map(y => CATS.reduce((s, c) => {
      const serie = DATA.historicoNacional[c.key] || [];
      const row = serie.find(r => r.anio === String(y));
      return s + (row ? row.total : 0);
    }, 0));
    const max = Math.max(...vals, 1);
    const stepX = w / Math.max(years.length - 1, 1);
    const pts = vals.map((v, i) => [i * stepX, h - (v / max) * h]);
    const line = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    const area = line + ` L${pts[pts.length - 1][0]},${h} L0,${h} Z`;
    document.getElementById('timeSparkline').innerHTML = `<path d="${area}"></path>`;
  }

  function setMode(mode, year) {
    state.mode = mode;
    if (year != null) state.selectedYear = year;
    liveBtn.classList.toggle('active', mode === 'actual');
    yearLabel.textContent = mode === 'actual' ? '2025–2026' : String(state.selectedYear);
    renderAll();
    renderTopStats();
  }

  yearSlider.addEventListener('input', () => {
    stopPlaying();
    setMode('historico', parseInt(yearSlider.value, 10));
  });
  liveBtn.addEventListener('click', () => {
    stopPlaying();
    yearSlider.value = YEAR_MAX;
    setMode('actual');
  });

  function stopPlaying() {
    if (state.playing) { clearInterval(state.playing); state.playing = null; playBtn.classList.remove('playing'); playBtn.textContent = '▶'; }
  }
  playBtn.addEventListener('click', () => {
    if (state.playing) { stopPlaying(); return; }
    playBtn.classList.add('playing');
    playBtn.textContent = '❚❚';
    let y = state.mode === 'actual' ? YEAR_MIN : state.selectedYear;
    if (y >= YEAR_MAX) y = YEAR_MIN;
    yearSlider.value = y;
    setMode('historico', y);
    state.playing = setInterval(() => {
      y++;
      if (y > YEAR_MAX) { stopPlaying(); return; }
      yearSlider.value = y;
      setMode('historico', y);
    }, 700);
  });

  // ---------------- Ocultar/mostrar interfaz ----------------
  document.getElementById('uiToggleBtn').addEventListener('click', () => {
    const hidden = document.body.classList.toggle('ui-hidden');
    document.getElementById('uiToggleBtn').textContent = hidden ? 'Mostrar interfaz' : 'Ocultar interfaz';
  });

  // ---------------- Clock ----------------
  function tickClock() {
    const el = document.getElementById('clock');
    const now = new Date();
    el.textContent = now.toLocaleString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) +
      ' · ' + now.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  tickClock();
  setInterval(tickClock, 1000);

  // ---------------- Init ----------------
  document.querySelector('.section-title-row .section-title').textContent = 'TENDENCIA NACIONAL (24 meses)';
  renderSparkline();
  renderLegend();
  renderTopStats();
  renderTrendTabs();
  renderTrend();
  renderMuniTabs();
  renderMuniList();
  renderCyber();
  renderAnaliticaSelect();
  renderAnaliticaList();
  renderNews();
  renderAll();
})();
