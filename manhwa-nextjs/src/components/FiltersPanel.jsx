'use client';

import { useState, useEffect, useRef } from 'react';
import { Popover, RangeSlider, Switch } from '@mantine/core';
import {
  IconAdjustmentsHorizontal, IconX, IconFilter,
  IconChevronDown, IconSortAscending, IconCircleDot,
  IconLayoutGrid, IconTag, IconCalendar,
  IconStar, IconBook, IconWorld, IconLanguage,
  IconSettings, IconClock, IconFlame, IconSparkles,
  IconTrendingUp, IconSortAZ, IconSortZA, IconClock2, IconMoodSmile,
} from '@tabler/icons-react';
import classes from './FiltersPanel.module.css';

/* ─── datos ─────────────────────────────────────────── */
const GENEROS = [
  'Acción','Aventura','Comedia','Drama','Fantasía','Romance',
  'Ciencia Ficción','Thriller','Horror','Misterio','Sobrenatural',
  'Deportes','Musical','Histórico','Psicológico','Mecha','Isekai',
  'Harem','Ecchi','Slice of Life','Josei','Seinen','Shounen','Shoujo',
];

const TAGS = [
  'Sistema','Regresión','Reencarnación','Overpowered','Murim','Gremio',
  'Mazmorras','Monstruos','Venganza','Magia','Espadas','Apocalipsis',
  'Villana','Contrato','Protagonista frío','Cultivación',
  'Nobleza','Torre','Academia','Vampiros','Demonios','Dioses',
];

const ESTADOS = [
  { label: 'Todos',       value: 'todos',        dot: '#9ca3af' },
  { label: 'En emisión',  value: 'en_emision',   dot: '#10b981' },
  { label: 'Completado',  value: 'completado',   dot: '#3b82f6' },
  { label: 'En pausa',    value: 'en_pausa',     dot: '#f59e0b' },
  { label: 'Cancelado',   value: 'cancelado',    dot: '#ef4444' },
  { label: 'Próximamente',value: 'proximo',      dot: '#8b5cf6' },
];

const TIPOS     = ['Manhwa','Manga','Manhua','Webtoon','Comic','Novela'];
const DEMOGRAFIAS = ['Shounen','Shoujo','Seinen','Josei','All Ages'];
const ORIGENES  = ['🇰🇷 Corea','🇯🇵 Japón','🇨🇳 China','🇭🇰 HK','🌐 Occidente','Otro'];
const IDIOMAS   = ['Español','Inglés','Portugués','Francés'];
const OPCIONES  = [
  'Solo con portada',
  'Solo completados',
  'Excluir hiatus',
  'Nuevos esta semana',
  'Traducción al español',
  'Populares (+1k vistas)',
  'Full color',
  'Formato vertical',
];

/* ─── subcomponente: sección acordeón ───────────────── */
function Section({ icon, title, count, expanded, onToggle, children }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!expanded) return;
    const timer = setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 180); // esperar a que termine la animación CSS
    return () => clearTimeout(timer);
  }, [expanded]);

  return (
    <div ref={ref} className={classes.section}>
      <button className={classes.sectionHeader} onClick={onToggle}>
        <div className={classes.sectionHeaderLeft}>
          <span className={classes.sectionIcon}>{icon}</span>
          <span className={classes.sectionTitle}>{title}</span>
          {count > 0 && <span className={classes.sectionCount}>{count}</span>}
        </div>
        <IconChevronDown
          size={13}
          className={`${classes.chevron} ${expanded ? classes.chevronOpen : ''}`}
        />
      </button>
      {expanded && <div className={classes.sectionBody}>{children}</div>}
    </div>
  );
}

/* ─── componente principal ───────────────────────────── */
/* ─── buildQuery: convierte filtros en lenguaje natural optimizado para IA semántica ── */
function buildQuery({ orden, estado, tipos, demografias, generos, tags, anios, score, caps, origen, idioma, opciones, actualizacion }) {

  // ── helpers ───────────────────────────────────────────────────────────────
  const joinNatural = (arr, conj = 'y') => {
    if (!arr.length) return '';
    if (arr.length === 1) return arr[0];
    return arr.slice(0, -1).join(', ') + ` ${conj} ` + arr[arr.length - 1];
  };
  const has = (...items) => items.some(i => generos.includes(i) || tags.includes(i));

  // ── 1. Tipo, origen y demografía ─────────────────────────────────────────
  const TIPO_MAP = {
    Manhwa: 'manhwa', Manga: 'manga', Manhua: 'manhua',
    Webtoon: 'webtoon', Comic: 'cómic', Novela: 'novela ligera',
  };
  const ORIGEN_MAP = {
    Corea: 'coreano', Japón: 'japonés', China: 'chino',
    HK: 'hongkonés', Occidente: 'occidental', Otro: 'de origen indie',
  };
  const DEMO_MAP = {
    Shounen: 'shounen',
    Shoujo:  'shoujo',
    Seinen:  'seinen',
    Josei:   'josei',
    'All Ages': 'para todo público',
  };

  const origenClean = origen.map(o => o.replace(/^\S+\s*/, '').trim());
  const tipoStr  = tipos.length      ? joinNatural(tipos.map(t => TIPO_MAP[t] ?? t.toLowerCase()), 'o')      : null;
  const origStr  = origenClean.length ? joinNatural(origenClean.map(o => ORIGEN_MAP[o] ?? o.toLowerCase()), 'o') : null;
  const demoStr  = demografias.length ? joinNatural(demografias.map(d => DEMO_MAP[d]  ?? d.toLowerCase()), 'o')  : null;

  // Sujeto compuesto: "manhwa coreano seinen" / "manga o manhwa"
  const sujetoBase = tipoStr ?? 'manhwa';
  const sujetoDesc = [origStr, demoStr].filter(Boolean).join(', ');
  const sujeto = sujetoDesc ? `${sujetoBase} ${sujetoDesc}` : sujetoBase;

  // ── 2. Combinaciones de géneros con sinergias detectadas ─────────────────
  // Detectar combos conocidos para generar frases más ricas
  const SINERGIAS = [
    { check: () => has('Acción','Aventura') && has('Sistema','Mazmorras','Gremio','Overpowered'),
      frase: 'de fantasía de acción con sistema de progresión, cazadores, mazmorras y un protagonista que se vuelve imparable' },
    { check: () => has('Romance') && has('Fantasía') && (has('Nobleza','Contrato','Villana') || demografias.includes('Josei') || demografias.includes('Shoujo')),
      frase: 'de romance de fantasía ambientado en la nobleza, con protagonistas en un contrato o relación compleja' },
    { check: () => has('Acción') && has('Venganza') && has('Regresión'),
      frase: 'de acción y venganza donde el protagonista regresa al pasado para reescribir su destino' },
    { check: () => has('Murim') && (has('Acción','Artes Marciales') || has('Cultivación')),
      frase: 'de artes marciales en el mundo del Murim, con cultivación de energía interna y peleas de alto nivel' },
    { check: () => has('Psicológico','Thriller') && has('Horror','Misterio'),
      frase: 'de terror psicológico y thriller, con atmósfera oscura y giros perturbadores' },
    { check: () => has('Isekai','Reencarnación') && has('Romance'),
      frase: 'isekai romántico donde el protagonista se reencarna en otro mundo con elementos de romance y fantasía' },
    { check: () => has('Comedia') && has('Slice of Life') && !has('Acción','Aventura'),
      frase: 'de comedia ligera y slice of life, con situaciones cotidianas divertidas y personajes carismáticos' },
    { check: () => has('Horror','Sobrenatural') && has('Acción'),
      frase: 'de acción sobrenatural con criaturas oscuras, exorcismos o poderes demoníacos' },
  ];

  let generoFrase = null;
  for (const sin of SINERGIAS) {
    if (sin.check()) { generoFrase = sin.frase; break; }
  }

  // Sin sinergia detectada: construir frase genérica limpia
  if (!generoFrase && generos.length) {
    const gl = generos.map(g => g.toLowerCase());
    generoFrase = gl.length === 1
      ? `de ${gl[0]}`
      : `de ${joinNatural(gl)}`;
  }

  // ── 3. Tags → tropos narrativos descriptivos ──────────────────────────────
  const TAG_MAP = {
    Sistema:             'sistema de niveles / habilidades',
    Regresión:           'protagonista que regresa al pasado (regresión)',
    Reencarnación:       'reencarnación en otro mundo o cuerpo',
    Overpowered:         'protagonista extremadamente poderoso desde el inicio o que escala muy rápido',
    Murim:               'mundo del Murim (artes marciales coreanas)',
    Gremio:              'gremios de aventureros o cazadores',
    Mazmorras:           'mazmorras, raids y portales',
    Monstruos:           'criaturas, bestias y monstruos que combatir',
    Venganza:            'historia de venganza implacable',
    Magia:               'magia y hechizos como elemento central',
    Espadas:             'combate con espadas y armas blancas',
    Apocalipsis:         'mundo post-apocalíptico o en el fin del mundo',
    Villana:             'protagonista femenina que es la villana de la historia',
    Contrato:            'contrato matrimonial, de trabajo o pacto entre personajes',
    'Protagonista frío': 'protagonista de carácter frío, distante e impasible',
    Cultivación:         'cultivación de energía vital (qi/mana interno)',
    Nobleza:             'nobleza, aristocracia y política de corte en mundo de fantasía',
    Torre:               'torre que los personajes deben escalar piso a piso',
    Academia:            'academia de magia, cazadores o combate donde estudian los personajes',
    Vampiros:            'vampiros y criaturas de la noche',
    Demonios:            'demonios, señores oscuros y el inframundo',
    Dioses:              'dioses, constelaciones o seres supremos que intervienen en la trama',
  };

  // Agrupar tags que se combinan bien juntos para no repetir "con X, con Y, con Z"
  const tagDescriptions = tags.map(t => TAG_MAP[t] ?? t);

  // Si la sinergia de géneros ya cubre algunos tags, evitar redundancia
  const tagsFiltrados = generoFrase && (
    (generoFrase.includes('sistema') && tags.includes('Sistema')) ||
    (generoFrase.includes('regresa') && tags.includes('Regresión')) ||
    (generoFrase.includes('mazmorra') && tags.includes('Mazmorras')) ||
    (generoFrase.includes('venganza') && tags.includes('Venganza')) ||
    (generoFrase.includes('Murim') && tags.includes('Murim')) ||
    (generoFrase.includes('nobleza') && tags.includes('Nobleza')) ||
    (generoFrase.includes('reencarna') && tags.includes('Reencarnación')) ||
    (generoFrase.includes('contrato') && tags.includes('Contrato'))
  ) ? tagDescriptions.filter((_, i) => {
    const t = tags[i];
    const covered = ['Sistema','Regresión','Mazmorras','Venganza','Murim','Nobleza','Reencarnación','Contrato'];
    return !covered.includes(t) || !generoFrase.toLowerCase().includes(TAG_MAP[t]?.split(' ')[0]?.toLowerCase() ?? '___');
  }) : tagDescriptions;

  const tagStr = tagsFiltrados.length
    ? `con los tropos: ${joinNatural(tagsFiltrados)}`
    : null;

  // ── 4. Estado de publicación ──────────────────────────────────────────────
  const ESTADO_MAP = {
    en_emision: 'que esté actualmente en emisión (salen capítulos nuevos regularmente)',
    completado: 'que esté completamente terminado (historia cerrada y sin más capítulos)',
    en_pausa:   'que esté en hiatus o pausa temporal',
    cancelado:  'que haya sido cancelado antes de terminar',
    proximo:    'que esté anunciado y próximo a publicarse',
  };
  const estadoStr = ESTADO_MAP[estado] ?? null;

  // ── 5. Época / año de publicación ─────────────────────────────────────────
  const anioStr = (() => {
    const [min, max] = anios;
    if (min === 2000 && max === 2025) return null;
    if (min === 2000) return max <= 2010
      ? 'publicado en la era clásica (anterior a 2010)'
      : `publicado antes de ${max}`;
    if (max === 2025) return min >= 2022
      ? 'muy reciente, publicado en los últimos años (2022 en adelante)'
      : min >= 2018
      ? `moderno, publicado a partir de ${min}`
      : `publicado a partir de ${min}`;
    if (max - min <= 4) return `publicado entre ${min} y ${max}`;
    return `publicado durante el período ${min}–${max}`;
  })();

  // ── 6. Calidad / puntuación ───────────────────────────────────────────────
  const scoreStr = (() => {
    const [sMin, sMax] = score;
    if (sMin === 0 && sMax === 10) return null;
    if (sMin >= 9.0)  return 'con puntuación perfecta o casi perfecta, considerado una joya absoluta del género';
    if (sMin >= 8.5)  return 'con puntuación muy alta (8.5+), altamente recomendado por la comunidad';
    if (sMin >= 8.0)  return 'bien valorado, con nota superior a 8 en comunidades de lectores';
    if (sMin >= 7.5)  return 'con buena puntuación (7.5+), recomendable según la comunidad';
    if (sMin >= 7.0)  return 'con puntuación sólida, entretenido y bien recibido';
    if (sMin >= 6.0)  return 'de calidad decente, aunque no necesariamente popular';
    if (sMax <= 5.0)  return 'con puntuación baja, posiblemente un guilty pleasure o desconocido';
    return `con puntuación entre ${sMin.toFixed(1)} y ${sMax.toFixed(1)}`;
  })();

  // ── 7. Extensión / número de capítulos ───────────────────────────────────
  const capsStr = (() => {
    const [cMin, cMax] = caps;
    if (cMin === 1 && cMax === 500) return null;
    if (cMax <= 20)  return 'de lectura muy corta (menos de 20 capítulos), ideal para terminar rápido';
    if (cMax <= 50)  return 'de historia corta (menos de 50 capítulos)';
    if (cMax <= 100) return 'de extensión media-corta (hasta 100 capítulos)';
    if (cMin >= 300) return 'épico y extenso, con más de 300 capítulos para sumergirse largo tiempo';
    if (cMin >= 200) return 'largo, con más de 200 capítulos, ideal para una inmersión profunda';
    if (cMin >= 100) return 'con más de 100 capítulos, suficiente para enganchar bien';
    if (cMax <= 200) return 'de extensión moderada, entre 50 y 200 capítulos';
    return `con entre ${cMin} y ${cMax >= 500 ? '500 o más' : cMax} capítulos`;
  })();

  // ── 8. Idioma y extras de plataforma ─────────────────────────────────────
  const idiomaStr = idioma.length
    ? `disponible en ${joinNatural(idioma.map(l => l.toLowerCase()))}`
    : null;

  const OPCIONES_MAP = {
    'Solo con portada':       'con portada oficial publicada',
    'Solo completados':       'completamente terminado',
    'Excluir hiatus':         'sin hiatus, con publicación continua',
    'Nuevos esta semana':     'con capítulos lanzados esta misma semana',
    'Traducción al español':  'con traducción al español disponible',
    'Populares (+1k vistas)': 'popular, con más de mil lectores activos',
    'Full color':             'con arte en full color (no en blanco y negro)',
    'Formato vertical':       'en formato webtoon vertical (scroll continuo)',
  };
  const opcionesStr = opciones.length
    ? joinNatural(opciones.map(o => OPCIONES_MAP[o] ?? o))
    : null;

  // ── 9. Frecuencia de actualización ────────────────────────────────────────
  const ACTUALIZACION_MAP = {
    hoy:         'actualizado hoy mismo (capítulo fresco)',
    esta_semana: 'con capítulo nuevo esta semana',
    este_mes:    'con actividad reciente este mes',
    ultimos_3:   'activo en los últimos 3 meses',
    este_anio:   'publicado o actualizado a lo largo de este año',
  };
  const actualizacionStr = ACTUALIZACION_MAP[actualizacion] ?? null;

  // ── 10. Preferencia de orden → cierre de frase ───────────────────────────
  const ORDEN_CIERRE = {
    'Más populares':  'priorizando los más populares y conocidos',
    'Más recientes':  'priorizando los lanzamientos más recientes',
    'Más valorados':  'priorizando los mejor valorados por la comunidad lectora',
    'Más capítulos':  'priorizando los que tienen mayor cantidad de capítulos',
    'Actualizados':   'priorizando los que se actualizan con más frecuencia',
  };
  const ordenStr = ORDEN_CIERRE[orden] ?? null;

  // ── 11. Contexto de vibes: mood general basado en géneros + tags ──────────
  const vibeStr = (() => {
    if (has('Horror','Psicológico','Thriller') && !has('Romance','Comedia'))
      return 'La historia debe tener un tono oscuro, perturbador y con tensión constante.';
    if (has('Comedia','Slice of Life') && !has('Acción','Horror'))
      return 'Busco algo ligero, divertido y con buen humor, que se pueda leer sin demasiado drama.';
    if (has('Romance') && has('Drama') && !has('Acción'))
      return 'Quiero una historia con mucho desarrollo emocional, relaciones complejas y tensión romántica bien construida.';
    if (has('Acción') && has('Overpowered','Sistema') && !has('Romance'))
      return 'Que tenga secuencias de acción intensas, escala de poder progresiva y momentos donde el protagonista demuestra su poderío.';
    if (has('Misterio','Thriller') && has('Sobrenatural'))
      return 'Busco una historia con misterios sobrenaturales, giros inesperados y una atmósfera que genere intriga.';
    return null;
  })();

  // ── 12. Ensamblado final en bloques de oraciones ──────────────────────────
  const hayContenido = [generoFrase, tagStr, estadoStr, anioStr, scoreStr,
                        capsStr, idiomaStr, opcionesStr, actualizacionStr].some(Boolean);

  if (!hayContenido) {
    const cierreOrden = ordenStr ? `, ${ordenStr}` : '';
    return `Recomiéndame los mejores ${sujeto} del catálogo${cierreOrden}. Dame títulos icónicos, bien valorados y que valga la pena leer.`;
  }

  // Bloque principal: sujeto + género
  const bloqueIdentidad = generoFrase
    ? `Recomiéndame ${sujeto} ${generoFrase}.`
    : `Recomiéndame ${sujeto}.`;

  // Bloque de tropos
  const bloqueTropos = tagStr ? `${tagStr}.` : null;

  // Bloque de contexto / condiciones
  const condiciones = [estadoStr, anioStr, scoreStr, capsStr, idiomaStr, opcionesStr, actualizacionStr].filter(Boolean);
  const bloqueCondiciones = condiciones.length
    ? `Que sea ${joinNatural(condiciones)}.`
    : null;

  // Bloque de preferencia de orden
  const bloqueOrden = ordenStr ? `En los resultados, ${ordenStr}.` : null;

  // Bloque de vibe/atmósfera
  const bloqueVibe = vibeStr ?? null;

  const parrafo = [bloqueIdentidad, bloqueTropos, bloqueCondiciones, bloqueOrden, bloqueVibe]
    .filter(Boolean)
    .join(' ');

  return parrafo;
}

export default function FiltersPanel({ onApply } = {}) {
  const [opened, setOpened]   = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  /* filter state */
  const [orden,         setOrden]         = useState('Más populares');
  const [estado,        setEstado]        = useState('todos');
  const [tipos,         setTipos]         = useState([]);
  const [demografias,   setDemografias]   = useState([]);
  const [generos,       setGeneros]       = useState([]);
  const [tags,          setTags]          = useState([]);
  const [anios,         setAnios]         = useState([2010, 2025]);
  const [score,         setScore]         = useState([7, 10]);
  const [caps,          setCaps]          = useState([10, 500]);
  const [origen,        setOrigen]        = useState([]);
  const [idioma,        setIdioma]        = useState([]);
  const [opciones,      setOpciones]      = useState([]);
  const [actualizacion, setActualizacion] = useState('cualquier_fecha');

  /* accordion open state */
  const [open, setOpen] = useState({
    orden: true, generos: true, tipo: false,
    tags: false, estado: false, rangos: false,
    avanzado: false, actualizacion: false,
  });
  const toggle = k => setOpen(s => ({ ...s, [k]: !s[k] }));

  const toggleArr = (arr, set, val) =>
    set(p => p.includes(val) ? p.filter(x => x !== val) : [...p, val]);

  /* active filter count */
  const counts = {
    orden:        orden !== 'Más populares' ? 1 : 0,
    estado:       estado !== 'todos' ? 1 : 0,
    tipo:         tipos.length + demografias.length,
    generos:      generos.length,
    tags:         tags.length,
    rangos:       (anios[0]!==2000||anios[1]!==2025?1:0) + (score[0]!==0||score[1]!==10?1:0) + (caps[0]!==1||caps[1]!==500?1:0),
    avanzado:     origen.length + idioma.length + opciones.length,
    actualizacion:actualizacion !== 'cualquier_fecha' ? 1 : 0,
  };
  const totalActive = Object.values(counts).reduce((a,b) => a+b, 0);

  /* active filter chips for the strip */
  const activeChips = [
    ...(orden !== 'Más populares' ? [{ label: orden, clear: () => setOrden('Más populares') }] : []),
    ...(estado !== 'todos' ? [{ label: ESTADOS.find(e=>e.value===estado)?.label, clear: () => setEstado('todos') }] : []),
    ...tipos.map(t    => ({ label: t, clear: () => toggleArr(tipos, setTipos, t) })),
    ...demografias.map(d => ({ label: d, clear: () => toggleArr(demografias, setDemografias, d) })),
    ...generos.map(g  => ({ label: g, clear: () => toggleArr(generos, setGeneros, g) })),
    ...tags.map(t     => ({ label: t, clear: () => toggleArr(tags, setTags, t) })),
    ...origen.map(o   => ({ label: o, clear: () => toggleArr(origen, setOrigen, o) })),
    ...idioma.map(i   => ({ label: i, clear: () => toggleArr(idioma, setIdioma, i) })),
    ...opciones.map(o => ({ label: o, clear: () => toggleArr(opciones, setOpciones, o) })),
  ];

  const handleClear = () => {
    setOrden('Más populares'); setEstado('todos');
    setTipos([]); setDemografias([]); setGeneros([]); setTags([]);
    setAnios([2000,2025]); setScore([0,10]); setCaps([1,500]);
    setOrigen([]); setIdioma([]); setOpciones([]);
    setActualizacion('cualquier_fecha');
  };

  const sliderBase = {
    track: { background: 'rgba(255,255,255,0.07)' },
    bar:   { background: 'linear-gradient(90deg, rgb(99,102,241), rgb(34,211,238))' },
    thumb: { borderColor: 'rgb(34,211,238)', background: '#0F0F14', boxShadow: '0 0 0 2px rgba(34,211,238,0.35)', width: 14, height: 14 },
    markLabel: { fontSize: '0.65rem', color: 'var(--text-muted,#9ca3af)', marginTop: 4 },
  };

  /* SSR: botón plano sin Popover */
  if (!mounted) {
    return (
      <button className={classes.filterBtn} aria-label="Abrir filtros">
        <IconAdjustmentsHorizontal size={16} stroke={2} className={classes.filterBtnIcon} />
        <span className={classes.filterBtnText}>Filtros</span>
      </button>
    );
  }

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-end"
      offset={8}
      withArrow
      arrowSize={10}
      shadow="xl"
      radius="md"
      withinPortal
      styles={{
        dropdown: {
          background: 'var(--modal-bg, rgba(13,13,18,0.98))',
          border: '1px solid rgba(99,102,241,0.2)',
          boxShadow: '0 12px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.06)',
          backdropFilter: 'blur(24px)',
          padding: 0,
          width: 400,
        },
        arrow: {
          background: 'rgba(99,102,241,0.08)',
          borderColor: 'rgba(99,102,241,0.2)',
        },
      }}
    >
      {/* ── Trigger ── */}
      <Popover.Target>
        <button
          suppressHydrationWarning
          onClick={() => setOpened(o => !o)}
          className={classes.filterBtn}
          aria-label="Abrir filtros"
        >
          <IconAdjustmentsHorizontal size={16} stroke={2} className={classes.filterBtnIcon} />
          <span className={classes.filterBtnText}>Filtros</span>
        </button>
      </Popover.Target>

      {/* ── Dropdown ── */}
      <Popover.Dropdown>
        <div className={classes.panel}>

          {/* Header */}
          <div className={classes.panelHeader}>
            <div className={classes.panelHeaderLeft}>
              <div className={classes.panelHeaderIcon}>
                <IconFilter size={14} stroke={2.2} />
              </div>
              <span className={classes.panelTitle}>Filtros de búsqueda</span>
            </div>
            <div className={classes.panelHeaderRight}>
              {totalActive > 0 && (
                <span className={classes.activeBadge}>{totalActive} activos</span>
              )}
              <button className={classes.panelClose} onClick={() => setOpened(false)} aria-label="Cerrar">
                <IconX size={13} />
              </button>
            </div>
          </div>

          {/* Active filter chips strip */}
          {activeChips.length > 0 && (
            <div className={classes.activeStrip}>
              {activeChips.map((c, i) => (
                <button key={i} className={classes.activeChip} onClick={c.clear}>
                  {c.label}
                  <span className={classes.activeChipX}><IconX size={10} /></span>
                </button>
              ))}
            </div>
          )}

          {/* Scrollable sections */}
          <div className={classes.scrollBody}>

            {/* Ordenar */}
            <Section icon={<IconSortAscending size={13}/>} title="Ordenar por" count={counts.orden} expanded={open.orden} onToggle={()=>toggle('orden')}>
              <div className={classes.ordenGrid}>
                {[
                  { value: 'Más populares', icon: <IconFlame size={14}/>      },
                  { value: 'Más recientes', icon: <IconSparkles size={14}/>   },
                  { value: 'Más valorados', icon: <IconStar size={14}/>       },
                  { value: 'Más capítulos', icon: <IconBook size={14}/>       },
                  { value: 'Actualizados',  icon: <IconTrendingUp size={14}/> },
                  { value: 'A-Z',           icon: <IconSortAZ size={14}/>     },
                  { value: 'Z-A',           icon: <IconSortZA size={14}/>     },
                ].map(o => {
                  const active = orden === o.value;
                  return (
                    <button
                      key={o.value}
                      className={`${classes.ordenBtn} ${active ? classes.ordenBtnActive : ''}`}
                      onClick={() => setOrden(o.value)}
                    >
                      <span className={`${classes.ordenBtnIcon} ${active ? classes.ordenBtnIconActive : ''}`}>
                        {o.icon}
                      </span>
                      <span className={classes.ordenBtnLabel}>{o.value}</span>
                    </button>
                  );
                })}
              </div>
            </Section>

            {/* Géneros */}
            <Section icon={<IconTag size={13}/>} title="Géneros" count={counts.generos} expanded={open.generos} onToggle={()=>toggle('generos')}>
              <div className={classes.pillGroup}>
                {GENEROS.map(g => (
                  <button key={g} onClick={() => toggleArr(generos, setGeneros, g)}
                    className={`${classes.pill} ${generos.includes(g) ? classes.pillActive : ''}`}>
                    {g}
                  </button>
                ))}
              </div>
            </Section>

            {/* Tipo / Demografía */}
            <Section icon={<IconLayoutGrid size={13}/>} title="Tipo / Demografía" count={counts.tipo} expanded={open.tipo} onToggle={()=>toggle('tipo')}>
              <div style={{ marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted,#9ca3af)', marginBottom: '0.35rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Formato</div>
                <div className={classes.pillGroup}>
                  {TIPOS.map(t => (
                    <button key={t} onClick={() => toggleArr(tipos, setTipos, t)}
                      className={`${classes.pill} ${tipos.includes(t) ? classes.pillActive : ''}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted,#9ca3af)', marginBottom: '0.35rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Demografía</div>
                <div className={classes.pillGroup}>
                  {DEMOGRAFIAS.map(d => (
                    <button key={d} onClick={() => toggleArr(demografias, setDemografias, d)}
                      className={`${classes.pill} ${demografias.includes(d) ? classes.pillActive : ''}`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </Section>

            {/* Tags */}
            <Section icon={<IconTag size={13}/>} title="Tags especiales" count={counts.tags} expanded={open.tags} onToggle={()=>toggle('tags')}>
              <div className={classes.pillGroup}>
                {TAGS.map(t => (
                  <button key={t} onClick={() => toggleArr(tags, setTags, t)}
                    className={`${classes.pill} ${tags.includes(t) ? classes.pillPurpleActive : ''}`}>
                    {t}
                  </button>
                ))}
              </div>
            </Section>

            {/* Estado */}
            <Section icon={<IconCircleDot size={13}/>} title="Estado" count={counts.estado} expanded={open.estado} onToggle={()=>toggle('estado')}>
              <div className={classes.statusGrid}>
                {ESTADOS.map(e => (
                  <button
                    key={e.value}
                    className={classes.statusPill}
                    onClick={() => setEstado(e.value)}
                    style={estado === e.value ? {
                      background: `${e.dot}18`,
                      borderColor: `${e.dot}55`,
                      color: e.dot,
                      fontWeight: 600,
                    } : {}}
                  >
                    <span className={classes.statusDot} style={{ background: e.dot }} />
                    {e.label}
                  </button>
                ))}
              </div>
            </Section>

            {/* Rangos */}
            <Section icon={<IconStar size={13}/>} title="Rangos" count={counts.rangos} expanded={open.rangos} onToggle={()=>toggle('rangos')}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>

                {/* ── Año ── */}
                <div className={classes.rangeCard}>
                  <div className={classes.rangeCardTop}>
                    <div className={classes.rangeCardLeft}>
                      <div className={classes.rangeCardIcon}><IconCalendar size={13}/></div>
                      <span className={classes.rangeCardLabel}>Año de publicación</span>
                    </div>
                    <div className={classes.rangeCardRight}>
                      <span className={classes.rangeValueDisplay}>{anios[0]} – {anios[1]}</span>
                      {(anios[0] !== 2000 || anios[1] !== 2025) && (
                        <button className={classes.rangeResetBtn} onClick={() => setAnios([2000, 2025])} aria-label="Resetear año">
                          <IconX size={10}/>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className={classes.rangePresets}>
                    {[
                      { label: 'Clásico',    range: [2000, 2010] },
                      { label: 'Consagrado', range: [2010, 2017] },
                      { label: 'Moderno',    range: [2017, 2022] },
                      { label: 'Reciente',   range: [2022, 2025] },
                    ].map(p => {
                      const active = anios[0] === p.range[0] && anios[1] === p.range[1];
                      return (
                        <button key={p.label}
                          className={`${classes.rangePreset} ${active ? classes.rangePresetActive : ''}`}
                          onClick={() => setAnios(p.range)}>
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className={classes.rangeSliderWrap}>
                    <RangeSlider min={2000} max={2025} step={1} value={anios} onChange={setAnios}
                      color="cyan" minRange={1}
                      marks={[{value:2000,label:'2000'},{value:2012,label:'2012'},{value:2025,label:'2025'}]}
                      styles={sliderBase}/>
                  </div>
                </div>

                {/* ── Puntuación ── */}
                <div className={classes.rangeCard}>
                  <div className={classes.rangeCardTop}>
                    <div className={classes.rangeCardLeft}>
                      <div className={classes.rangeCardIcon} style={{ background: 'rgba(234,179,8,0.1)', color: 'rgb(234,179,8)' }}>
                        <IconStar size={13}/>
                      </div>
                      <span className={classes.rangeCardLabel}>Puntuación</span>
                    </div>
                    <div className={classes.rangeCardRight}>
                      <span className={`${classes.rangeValueDisplay} ${classes.rangeValueDisplayGold}`}>
                        ★ {score[0].toFixed(1)} – {score[1].toFixed(1)}
                      </span>
                      {(score[0] !== 0 || score[1] !== 10) && (
                        <button className={classes.rangeResetBtn} onClick={() => setScore([0, 10])} aria-label="Resetear puntuación">
                          <IconX size={10}/>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className={classes.rangePresets}>
                    {[
                      { label: '★ Decente 6+',      range: [6,   10] },
                      { label: '★ Buena 7.5+',      range: [7.5, 10] },
                      { label: '★ Muy buena 8.5+',  range: [8.5, 10] },
                      { label: '★ Obra maestra 9+', range: [9,   10] },
                    ].map(p => {
                      const active = score[0] === p.range[0] && score[1] === p.range[1];
                      return (
                        <button key={p.label}
                          className={`${classes.rangePreset} ${active ? classes.rangePresetActiveGold : ''}`}
                          onClick={() => setScore(p.range)}>
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className={classes.rangeSliderWrap}>
                    <RangeSlider min={0} max={10} step={0.5} value={score} onChange={setScore}
                      color="yellow"
                      marks={[{value:0,label:'0'},{value:5,label:'5'},{value:10,label:'10'}]}
                      styles={{ ...sliderBase,
                        bar:   { background: 'linear-gradient(90deg, rgb(234,179,8), rgb(251,146,60))' },
                        thumb: { borderColor:'rgb(234,179,8)', background:'#0F0F14', boxShadow:'0 0 0 2px rgba(234,179,8,0.35)', width:14, height:14 },
                      }}/>
                  </div>
                </div>

                {/* ── Capítulos ── */}
                <div className={classes.rangeCard}>
                  <div className={classes.rangeCardTop}>
                    <div className={classes.rangeCardLeft}>
                      <div className={classes.rangeCardIcon}><IconBook size={13}/></div>
                      <span className={classes.rangeCardLabel}>Número de capítulos</span>
                    </div>
                    <div className={classes.rangeCardRight}>
                      <span className={classes.rangeValueDisplay}>
                        {caps[0]} – {caps[1] >= 500 ? '500+' : caps[1]}
                      </span>
                      {(caps[0] !== 1 || caps[1] !== 500) && (
                        <button className={classes.rangeResetBtn} onClick={() => setCaps([1, 500])} aria-label="Resetear capítulos">
                          <IconX size={10}/>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className={classes.rangePresets}>
                    {[
                      { label: 'Corto  <50',    range: [1,   50]  },
                      { label: 'Medio  50-200', range: [50,  200] },
                      { label: 'Largo  200-500',range: [200, 500] },
                      { label: 'Épico  100+',   range: [100, 500] },
                    ].map(p => {
                      const active = caps[0] === p.range[0] && caps[1] === p.range[1];
                      return (
                        <button key={p.label}
                          className={`${classes.rangePreset} ${active ? classes.rangePresetActive : ''}`}
                          onClick={() => setCaps(p.range)}>
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className={classes.rangeSliderWrap}>
                    <RangeSlider min={1} max={500} step={5} value={caps} onChange={setCaps}
                      color="cyan"
                      marks={[{value:1,label:'1'},{value:100,label:'100'},{value:250,label:'250'},{value:500,label:'500+'}]}
                      styles={sliderBase}/>
                  </div>
                </div>

              </div>
            </Section>

            {/* Avanzado */}
            <Section icon={<IconSettings size={13}/>} title="Avanzado" count={counts.avanzado} expanded={open.avanzado} onToggle={()=>toggle('avanzado')}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>

                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted,#9ca3af)', marginBottom: '0.35rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    <IconWorld size={10} style={{display:'inline',marginRight:4}}/>País de origen
                  </div>
                  <div className={classes.pillGroup}>
                    {ORIGENES.map(o => (
                      <button key={o} onClick={() => toggleArr(origen, setOrigen, o)}
                        className={`${classes.pill} ${origen.includes(o) ? classes.pillActive : ''}`}>
                        {o}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted,#9ca3af)', marginBottom: '0.35rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    <IconLanguage size={10} style={{display:'inline',marginRight:4}}/>Idioma
                  </div>
                  <div className={classes.pillGroup}>
                    {IDIOMAS.map(l => (
                      <button key={l} onClick={() => toggleArr(idioma, setIdioma, l)}
                        className={`${classes.pill} ${idioma.includes(l) ? classes.pillActive : ''}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted,#9ca3af)', marginBottom: '0.35rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Opciones
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {OPCIONES.map(opt => (
                      <div key={opt} className={classes.switchRow}>
                        <label className={classes.switchLabel} htmlFor={`opt-${opt}`}>{opt}</label>
                        <Switch
                          id={`opt-${opt}`}
                          checked={opciones.includes(opt)}
                          onChange={() => toggleArr(opciones, setOpciones, opt)}
                          color="cyan"
                          size="xs"
                        />
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </Section>

            {/* Actualización */}
            <Section icon={<IconClock size={13}/>} title="Última actualización" count={counts.actualizacion} expanded={open.actualizacion} onToggle={()=>toggle('actualizacion')}>
              <div className={classes.pillGroup}>
                {[
                  { label: 'Cualquier fecha', value: 'cualquier_fecha' },
                  { label: 'Hoy',             value: 'hoy' },
                  { label: 'Esta semana',     value: 'esta_semana' },
                  { label: 'Este mes',        value: 'este_mes' },
                  { label: 'Últimos 3 meses', value: 'ultimos_3' },
                  { label: 'Este año',        value: 'este_anio' },
                ].map(({ label, value }) => (
                  <button key={value} onClick={() => setActualizacion(value)}
                    className={`${classes.pill} ${actualizacion === value ? classes.pillActive : ''}`}>
                    {label}
                  </button>
                ))}
              </div>
            </Section>

          </div>

          {/* Footer */}
          <div className={classes.panelFooter}>
            <button className={classes.applyBtn} onClick={() => {
              setOpened(false);
              if (onApply) {
                const query = buildQuery({ orden, estado, tipos, demografias, generos, tags, anios, score, caps, origen, idioma, opciones, actualizacion });
                onApply(query);
              }
            }}>
              Aplicar filtros
            </button>
            <button className={classes.clearBtn} onClick={handleClear}>
              Limpiar todo
            </button>
          </div>

        </div>
      </Popover.Dropdown>
    </Popover>
  );
}
