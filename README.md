# CrimenAI Colombia — Estado del proyecto

Dashboard táctico de criminalidad en Colombia. Mapa interactivo (Leaflet) con datos reales del gobierno, no simulados.

## Cómo correrlo
```
cd data && node merge.js          # solo si cambias datos (ver nota abajo)
# servir la carpeta raíz con cualquier server estático, ej:
python -m http.server 8541
```
Abrir `index.html` vía el server (no funciona bien con file:// directo por los fetch de Leaflet/CDN).

## Estructura
- `index.html` / `css/style.css` / `js/app.js` — la app.
- `js/data.js` — TODOS los datos nacionales (10 categorías + feminicidios overlay), generado por `data/merge.js`.
- `js/geo.js` — polígonos de los 33 departamentos.
- `js/bogota.js`, `js/ciudades.js` — polígonos + datos de localidades/comunas (Bogotá, Medellín, Cali, Bucaramanga).
- `data/merge.js` — script que fusiona los JSON crudos de datos.gov.co en `colombia_crimen.json` → se copia a `js/data.js`.
  - **Los JSON crudos de entrada ya NO existen** (se borraron para no ocupar espacio). Si necesitas volver a correr `merge.js`, hay que re-descargar todo desde las APIs (queries SoQL documentadas en el historial de chat de creación del proyecto). El script aborta solo si detecta que faltan (total sospechosamente bajo) para no sobreescribir el bueno por error.
  - `colombia_crimen.json` y `js/data.js` están completos y vigentes — son la fuente de verdad actual.

## Categorías de delito (todas con fuente Policía Nacional/SIEDCO vía datos.gov.co, salvo aclaración)
Homicidios, Secuestros, Extorsión, Amenazas, Delitos Sexuales, Lesiones Personales, Hurto (compuesto: personas+residencias+vehículos+otros), Violencia Intrafamiliar, Terrorismo, Operativos Antinarcóticos, Feminicidios (subconjunto de Homicidios, no se suma al total), Delitos Informáticos (Fiscalía/SPOA, separado).

## Funcionalidades ya construidas
- Vista Táctica (pines + choropleth por departamento) y Mapa de Calor.
- Barra histórica 2003–2026 con reproducción automática (▶) y modo "en vivo" (periodo actual ene 2025–may 2026).
- Drill-down por comuna/localidad en **Bogotá** (20), **Medellín** (16), **Cali** (22), **Bucaramanga** (17).
- Los 33 departamentos tienen lista completa de sus municipios (botón "Ver los N municipios") — 1.078 municipios en total.
- Panel Analítico: tendencia mensual/anual, ranking, top municipios, Delitos Informáticos, Analítica demográfica (arma, sexo, modalidad, composición de hurto, tipo de secuestro, sustancia).
- Boletín de noticias reales (curado a mano, no scraping automático).
- Botón "Ocultar interfaz", diseño tipo Apple/minimalista (poco glow, transiciones suaves).

## Ciudades investigadas SIN datos suficientes (no insistir salvo que aparezca fuente nueva)
Cúcuta (solo mapa de 2017 inaccesible), Pereira, Ibagué, Villavicencio, Montería, Neiva, Popayán, Manizales, Sincelejo, Cartagena (solo 39 muertes no naturales en 8 meses, insuficiente), Área Metropolitana del Valle de Aburrá (Bello/Itagüí/Envigado).

## Próximos pasos posibles (no hechos aún)
1. Boletín de noticias con refresco automático (RSS + `/schedule`), en vez de la lista curada manual actual.
2. Revisar si aparecen datasets nuevos de comuna para las ciudades listadas arriba como "sin datos".
3. Optimizar más el tamaño de `js/data.js` (190KB) si se vuelve un problema — hoy el proyecto pesa 765KB total, no es urgente.
4. Posible export/PDF del panel analítico.

## Fuentes principales (para referencia rápida)
- datos.gov.co (Socrata) — Policía Nacional/SIEDCO: homicidio `m8fd-ahd9`, secuestro `d7zw-hpf4`, extorsión `q2ib-t9am`, hurto personas `4rxi-8m8d`, hurto residencias `7mn7-vzqp`, hurto vehículos `9vha-vh9n`, hurto abigeato/financiero/pirateria `d4fr-sbn2`, sexuales `fpe5-yrmw`, violencia intrafamiliar `vuyt-mqpw`, amenazas `meew-mguv`, lesiones `72sg-cybi`, terrorismo `37p5-impc`, estupefacientes `kk69-w2jj`.
- Delitos informáticos (Fiscalía/SPOA): `wxd8-ucns`.
- Bogotá SDSCJ: dataset "Delito de Alto Impacto" (GeoJSON descargable).
- Medellín: MEData CSV por comuna. Cali: ArcGIS `Comun` FeatureServer. Bucaramanga: `x46e-abhz` (datos.gov.co, 2016-2026).
