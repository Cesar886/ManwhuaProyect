'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { getSearchHistory, removeFromHistory, detectNsfwQuery } from '@/hooks/useIA';
import { api } from '@/api/client';
import './ia-minicpm.css';

const AI_BASE_URL = (process.env.NEXT_PUBLIC_AI_API_URL || 'https://ai.manhwaimperial.site/api/read')
    .replace('/api/read', '');

const EMPTY_PLACEHOLDER_PHRASES = Object.freeze([]);

// Frases de respaldo si la API aún no tiene datos
const FALLBACK_PHRASES = [
    // --- LOS CLÁSICOS DE ACCIÓN Y SISTEMAS ---
    'Manhwas de acción con protagonista OP',
    'Similar a Solo Leveling pero con nigromantes',
    'El protagonista más débil se vuelve el más fuerte',
    'Sistema de cazadores y mazmorras',
    'Sobreviviendo en un juego de la muerte',
    'Fantasía oscura con monstruos y sangre',
    'Prota despiadado que no perdona a nadie',

    // --- MURIM Y ARTES MARCIALES ---
    'Murim con sistema de niveles',
    'El líder del culto demoníaco regresa',
    'Artes marciales, sectas y cultivación',
    'Venganza en el mundo del Murim',

    // --- REGRESIÓN Y VENGANZA ---
    'Protagonista que regresa al pasado',
    'Traicionado por su gremio busca venganza',
    'Los mejores manhwas de venganza',
    'Regreso a los días de academia para cambiar el futuro',
    'Sistema de niveles con reencarnación',

    // --- OTOME ISEKAI Y FANTASÍA ROMÁNTICA ---
    'Reencarné como la villana de la novela',
    'Matrimonio por contrato con el duque frío',
    'Romance de época con el tirano del norte',
    'La protagonista rompe su compromiso',
    'Cuidando al hijo del villano original',

    // --- COMEDIA, ESCOLAR Y SLICE OF LIFE ---
    'Romance escolar sin drama',
    'Romance de oficina con jefe frío',
    'Comedia ligera para reír a carcajadas',
    'Prota que solo quiere vivir en paz pero es un genio',
    'Vida tranquila cultivando en otro mundo',

    // --- BÚSQUEDAS POR VIBRAS (VIBE CHECK) ---
    'Manhwa de fantasía con magia épica',
    'Historia con arte espectacular y batallas',
    'Manhwa triste que me haga llorar',
    'Acción pura, cero romance',
    'Seinen oscuro y psicológico',
];

const FALLBACK_SUGGESTIONS = FALLBACK_PHRASES.slice(0, 5).map((q, i) => ({
    query: q,
    count: null,
    rank: i + 1,
}));

const TYPING_SPEED = 55;   // ms por carácter escribiendo
const DELETING_SPEED = 28;   // ms por carácter borrando
const PAUSE_AFTER = 3000; // ms de pausa tras escribir completo
const PAUSE_BEFORE = 450;  // ms de pausa antes del siguiente

// Frases de "pensando" que rotan mientras carga
const THINKING_PHRASES = [
    // --- LAS ORIGINALES MEJORADAS ---
    'Analizando el catálogo imperial...',
    'Consultando la base de datos de manhwas...',
    'Buscando los mejores títulos para ti...',
    'Procesando tu búsqueda con Inteligencia Artificial...',
    'Identificando patrones narrativos y tropos...',

    // --- TEMÁTICA "IMPERIAL" Y ARCHIVOS ---
    'Despertando al oráculo imperial...',
    'Recorriendo los pasillos de la Gran Biblioteca...',
    'Desempolvando los pergaminos sagrados...',
    'Pidiendo recomendaciones al Emperador...',
    'Traduciendo los textos antiguos...',
    'Buscando joyas ocultas en el tesoro imperial...',

    // --- TEMÁTICA "SISTEMAS" Y ACCIÓN (Guiños a los fans) ---
    'El Sistema está calculando los resultados...',
    'Invocando a los espíritus de la base de datos...',
    'Reuniendo Qi para procesar tu consulta...',
    'Regresando en el tiempo para encontrar tu manhwa ideal...',
    'Las constelaciones están evaluando tu búsqueda...',
    'Sobreviviendo a la mazmorra de datos...',
    'Buscando al protagonista más roto (OP)...',

    // --- TEMÁTICA "IA IMPERIAL" (Tecnología + Fantasía) ---
    'La IA Imperial está analizando tu solicitud...',
    'Conectando las redes neuronales a la Gran Biblioteca...',
    'El autómata de los archivos está buscando coincidencias...',
    'Sincronizando el algoritmo con los pergaminos antiguos...',
    'El Sistema IA está escaneando miles de capítulos...',
    'Invocando a los gólems de búsqueda...',
    'Procesando tu destino a través de la IA Imperial...',
    'Calculando la probabilidad de encontrar una obra maestra...',
    'Entrenando a los sabios artificiales del Imperio...',
    'Extrayendo datos de los cristales de memoria...',
    'El algoritmo del Emperador está tomando una decisión...',

    // --- TEMÁTICA ROMANCE Y OTOME ISEKAI ---
    'Evadiendo la mirada del Tirano del Norte...',
    'Preparando el contrato matrimonial perfecto...',
    'Evitando que la villana arruine los resultados...',
    'Filtrando el drama innecesario...',

    // --- TÉCNICAS Y LECTOR ---
    'Analizando sinopsis...',
    'Conectando tus gustos con el manhwa perfecto...',
    'Preparando tu próxima obsesión...',
    'Afilando las espadas y preparando los hechizos...',
];

const THINKING_PHRASES_HUMOR = [
    'Buscando el One Piece (esto puede tardar)...',
    'Presionando Alt + F4 para cargar más rápido...',
    'Nerf al minero...',
    'Detectando clichés… aceptándolos igual...',
    'Esperando que no haya lag...',

];

// Mapa contextual: si la query tiene alguna keyword → esa frase humor aparece como 2ª rotación
const HUMOR_CONTEXT_MAP = [
    // 🔥 1. BL / YAOI / OMEGAVERSE / SPICY (Subidito de tono y tóxico)
    {
        keywords: ['bl', 'yaoi', 'omega', 'alfa', 'fujosh', 'toxic', 'red flag', 'celos', 'obsesiv', 'encerr', 'pasivo', 'activo', 'seme', 'uke'],
        phrases: [
            'Midiendo los hombros de nevera del activo...',
            'Calculando el tamaño del... ego del protagonista.',
            'Borrando tu historial de lectura por si tu mamá lo ve...',
            'Calculando la diferencia de tamaño de las manos...',
            'Preparando los supresores para el celo de la IA...',
            'Confirmando si es amor o síndrome de Estocolmo...',
            'Buscando sables de luz en los paneles censurados...',
            'Asegurando la cerradura del sótano (el Yandere está cerca)...',
            'Preparando pomada para las caderas del prota...',
            'Calculando el tamaño del... ego del protagonista.',
            'Analizando la densidad de feromonas tóxicas en el aire...',
            '"Solo somos amigos", dice mientras lo acorrala contra la pared...',
            'Buscando la etiqueta "Sin Censura" desesperadamente...',
            'Calculando cuántos capítulos faltan para que rompan la cama...',
            'Borrando tu historial para que no te juzgue diosito...',
            'Buscando red flags del tamaño de una catedral...',
            'Midiendo la toxicidad: 100% alfa posesivo detectado...',
            'Evaluando si la mordida en la nuca dejó marca...',
            'Comprobando si el CEO ya sacó la Black Card para callarlo...',
            'Convenciendo al pasivo de que huya (sabemos que le gusta)...',
            'Buscando al amigo de la infancia que va a terminar llorando...',
            'Verificando si la trama tiene más banderas rojas que un desfile...',
            'Calculando el tamaño del... ego del protagonista.'
        ]
    },

    // 👑 2. OTOME ISEKAI / ROMANCE DE ÉPOCA (RoFan)
    {
        keywords: ['romance', 'amor', 'romanc', 'otome', 'novela', 'contrato', 'matrimon', 'espos', 'boda', 'ceo', 'jefe', 'frio', 'duqu', 'conde', 'principe', 'norte', 'villan'],
        phrases: [
            'Sonriendo de lado y susurrando "qué mujer tan interesante"...',
            'Descongelando el corazón del Duque del Norte...',
            'Practicando cachetadas para la Loto Blanco doble cara...',
            'Comprando toda la tienda diciendo: "dame todo desde aquí hasta allá"...',
            'Tosiendo sangre elegantemente en un pañuelo de encaje...',
            'Buscando al CEO millonario, guapo y obsesivo de turno...',
            'Cancelando el compromiso con el Príncipe Heredero basura...',
            'Firmando un contrato matrimonial con cláusulas de cero contacto físico...',
            'Si es malo pero está guapísimo, la IA lo perdona...',
            'Buscando a la sirvienta leal que morirá en el capítulo 5...',
            'Huyendo de la trama original para abrir una panadería...',
            'Calculando cuántos vestidos comprará el Duque hoy...',
            'Ignorando el sentido común por un villano con buen diseño...',
            'Sirviendo té y comiendo postres durante 40 capítulos seguidos...',
            'Evitando que el padre adoptivo súper guapo mate a alguien...',
            'Criando al protagonista masculino para que no se vuelva un psicópata...',
            'Buscando red flags para ignorarlas a propósito...',
        ]
    },

    // ⚔️ 3. ACCIÓN / SISTEMAS / CAZADORES (Solo Leveling vibes)
    {
        keywords: ['sistema', 'nivel', 'cazador', 'hunter', 'mazmorra', 'dungeon', 'torre', 'tower', 'rango', 'rank', 'gremio', 'nigromant', 'necromanc', 'muert'],
        phrases: [
            'Ocultando mi verdadero poder de Clase S para no llamar la atención...',
            'Farmeando experiencia en el tutorial del buscador...',
            'Levantando a los muertos para que busquen más rápido...',
            'El Sistema requiere que hagas 100 flexiones y 100 sentadillas...',
        ]
    },

    // 🐉 4. MURIM / ARTES MARCIALES / CULTIVACIÓN
    {
        keywords: ['murim', 'cultivaci', 'secta', 'maestro', 'demoni', 'espada', 'wuxia', 'qi', 'marcial', 'mount hua'],
        phrases: [
            'Buscando el ginseng milenario de 10,000 años en el mercado negro...',
            'Cultivando mi paciencia mientras el servidor responde...',
        ]
    },

    // ⏪ 5. REGRESIÓN / VENGANZA
    {
        keywords: ['regres', 'volver', 'pasado', 'tiempo', 'reencarn', 'isekai', 'traicion', 'venganz', 'vengar', 'abandon', 'basura'],
        phrases: [
            'Evitando a Camion-kun para no reencarnar en otro servidor...',
            'Anotando IPs en la lista negra de venganza...',
            'Regresando 10 años en el pasado para arreglar este bug...',
            'Dándole una segunda oportunidad a mi vida (y a tu búsqueda)...',
            'Recordando los números de la lotería de mi vida pasada...'
        ]
    },

    // 🤡 6. ARQUETIPOS Y CRECIMIENTO (Glow up / OP)
    {
        keywords: ['glow up', 'débil', 'debil', 'inutil', 'basura', 'torpe', 'op', 'chetad', 'rot', 'fuerte', 'invencibl', 'dios'],
        phrases: [
            'Calculando cuántos capítulos faltan para el épico glow up...',
            'Buscando a un protagonista que rompa la escala de poder en el cap 2...',
            'Pidiendo un préstamo abusivo al Sistema...',
            'Nerfeando al protagonista porque daña la base de datos...',
            'El prota está tan OP que el autor ya no sabe qué enemigos ponerle...',
        ]
    },

    // 😭 7. TRAGEDIA Y ANGST
    {
        keywords: [
            // Los originales
            'llorar', 'trist', 'drama', 'tragedi', 'sufrir', 'dolor', 'angst', 'enferm',
            // Variaciones de llanto y tristeza
            'llor', 'llant', 'lagrim', 'melancol', 'depre',
            // Enfermedades y muerte
            'terminal', 'desahuciad', 'morir', 'fallec', 'agoni',
            // Dolor emocional y arrepentimiento (Súper común en romance trágico)
            'arrepent', 'culpa', 'desamor', 'destroz', 'desespera', 'miseri',
            // Etiquetas comunes
            'psicolog'
        ],
        phrases: [
            'Cotizando tu terapia psicológica post-lectura...',
            'Calculando si vale la pena el sufrimiento por ese final feliz...',
            'La IA está llorando con la sinopsis, por favor espera...',
            'Buscando historias para arruinar tu estabilidad emocional hoy...'
        ]
    },

    // ☕ 8. COMEDIA / SLICE OF LIFE
    {
        keywords: ['comedi', 'risa', 'divertid', 'gracios', 'tranquil', 'paz', 'granja', 'cocin'],
        phrases: [
            'Abandonando la trama para plantar papas en el campo...',
            'Alimentando a las bestias divinas con comida chatarra...',
            'El protagonista está intentando dormir, vuelve más tarde...',
            'Resolviendo conflictos mundiales con una taza de té caliente...',
            'Esquivando los problemas como si fueran responsabilidades adultas...'
        ]
    }
];

// Devuelve una frase contextual aleatoria si el query tiene match + dado cae, o null si no
// Solo INFORMA qué frase elegir (la probabilidad se aplica en el hook)
function getContextPhrase(query) {
    if (!query || query.trim().length === 0) return null;
    const q = query.toLowerCase();
    for (const entry of HUMOR_CONTEXT_MAP) {
        if (entry.keywords.some(k => q.includes(k))) {
            // entry.phrases es array; elegir una aleatoria
            const pool = entry.phrases;
            return pool[Math.floor(Math.random() * pool.length)];
        }
    }
    return null;
}

// Ms por carácter para el efecto de stream de la respuesta
const STREAM_SPEED = 18;

// Géneros populares para el tab "Por género"
const POPULAR_GENRES = [
    'Acción', 'Romance', 'Fantasía', 'Sistema',
    'Murim', 'Regresión', 'Comedia', 'Drama',
    'Isekai', 'Aventura', 'Terror', 'Ecchi',
];

// Badge de ranking: #1 → 🔥 ámbar, #2+ → número con intensidad decreciente
function RankBadge({ rank }) {
    if (rank === 1) {
        return <span className="ia-rank-badge ia-rank-fire">🔥</span>;
    }
    return (
        <span className={`ia-rank-badge ia-rank-${Math.min(rank, 5)}`}>
            {rank}
        </span>
    );
}

// Fisher-Yates shuffle
function shuffleArray(arr) {
    const s = [...arr];
    for (let i = s.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [s[i], s[j]] = [s[j], s[i]];
    }
    return s;
}

// Hook interno para el efecto de streaming de texto
function useStreamingText(targetText, active) {
    const [displayed, setDisplayed] = useState('');
    const timerRef = useRef(null);
    const indexRef = useRef(0);

    useEffect(() => {
        clearTimeout(timerRef.current);
        indexRef.current = 0;
        setDisplayed('');

        if (!active || !targetText) return;

        const tick = () => {
            indexRef.current++;
            setDisplayed(targetText.slice(0, indexRef.current));
            if (indexRef.current < targetText.length) {
                timerRef.current = setTimeout(tick, STREAM_SPEED);
            }
        };

        timerRef.current = setTimeout(tick, STREAM_SPEED);
        return () => clearTimeout(timerRef.current);
    }, [targetText, active]);

    return displayed;
}

// Hook que maneja el ciclo completo: escribe → pausa → borra → escribe siguiente (aleatorio)
// Con 4% de probabilidad sale una frase de THINKING_PHRASES_HUMOR
const THINKING_DELETE_SPEED = 22; // ms por carácter borrando
const THINKING_PAUSE = 4500;      // ms de pausa tras escribir completo
const THINKING_GAP = 280;         // ms de silencio entre borrar y escribir siguiente
const HUMOR_PROBABILITY = 0.04;   // 4% — rarísimo pero sale
const CONTEXT_PROBABILITY = 0.30; // 30% — si hay keyword match, aparece primero

function useThinkingStream(active, query = '', customThinkingPhrases = EMPTY_PLACEHOLDER_PHRASES) {
    const [displayed, setDisplayed] = useState('');
    // pool: 'normal' | 'humor'
    const stateRef = useRef({ phase: 'typing', charIdx: 0, phraseIdx: 0, pool: 'normal', lastPool: null, lastIdx: -1 });
    const timerRef = useRef(null);

    const normalThinkingPhrases = Array.isArray(customThinkingPhrases) && customThinkingPhrases.length > 0
        ? customThinkingPhrases
        : THINKING_PHRASES;

    const getPhrase = (pool, idx) =>
        pool === 'humor' ? THINKING_PHRASES_HUMOR[idx] : normalThinkingPhrases[idx];

    // Elige siguiente frase — 4% humor, 96% normal; nunca repite la misma seguida
    const pickNext = (lastPool, lastIdx) => {
        const isHumor = Math.random() < HUMOR_PROBABILITY;
        const pool = isHumor ? THINKING_PHRASES_HUMOR : normalThinkingPhrases;
        const poolKey = isHumor ? 'humor' : 'normal';
        let idx;
        do {
            idx = Math.floor(Math.random() * pool.length);
        } while (poolKey === lastPool && idx === lastIdx && pool.length > 1);
        return { pool: poolKey, phraseIdx: idx };
    };

    useEffect(() => {
        if (!active) {
            clearTimeout(timerRef.current);
            setDisplayed('');
            stateRef.current = { phase: 'typing', charIdx: 0, phraseIdx: 0, pool: 'normal', lastPool: null, lastIdx: -1 };
            return;
        }

        // Decidir si la frase contextual aparece como PRIMERA (30% de prob si hay match)
        const contextPhrase = getContextPhrase(query);
        const showContextFirst = !!(contextPhrase && Math.random() < CONTEXT_PROBABILITY);

        if (showContextFirst) {
            // La frase contextual ES la primera — efecto meme inmediato
            stateRef.current = {
                phase: 'typing', charIdx: 0,
                phraseIdx: -1, pool: 'context',
                lastPool: null, lastIdx: -1,
                contextPhrase,
                contextUsed: true,   // ya usada, no vuelve a aparecer
            };
        } else {
            // Rotación normal — la contextual nunca sale en esta sesión
            const initIdx = Math.floor(Math.random() * normalThinkingPhrases.length);
            stateRef.current = {
                phase: 'typing', charIdx: 0,
                phraseIdx: initIdx, pool: 'normal',
                lastPool: null, lastIdx: -1,
                contextPhrase: null,
                contextUsed: true,   // marcar como usada para que no aparezca luego
            };
        }

        const tick = () => {
            const s = stateRef.current;
            const phrase = s.pool === 'context'
                ? s.contextPhrase
                : getPhrase(s.pool, s.phraseIdx);

            if (s.phase === 'typing') {
                const next = s.charIdx + 1;
                setDisplayed(phrase.slice(0, next));
                if (next >= phrase.length) {
                    stateRef.current = { ...s, phase: 'pause', charIdx: next };
                    timerRef.current = setTimeout(tick, THINKING_PAUSE);
                } else {
                    stateRef.current = { ...s, charIdx: next };
                    timerRef.current = setTimeout(tick, STREAM_SPEED);
                }

            } else if (s.phase === 'pause') {
                stateRef.current = { ...s, phase: 'deleting', charIdx: phrase.length };
                timerRef.current = setTimeout(tick, THINKING_DELETE_SPEED);

            } else if (s.phase === 'deleting') {
                const next = s.charIdx - 1;
                setDisplayed(phrase.slice(0, next));
                if (next <= 0) {
                    const s2 = stateRef.current;
                    // Si hay frase contextual y aún no se usó, dispararla ahora
                    if (s2.contextPhrase && !s2.contextUsed) {
                        stateRef.current = {
                            phase: 'typing', charIdx: 0,
                            phraseIdx: -1,        // -1 = frase contextual directa
                            pool: 'context',
                            lastPool: s2.pool, lastIdx: s2.phraseIdx,
                            contextPhrase: s2.contextPhrase,
                            contextUsed: true,
                        };
                    } else {
                        const picked = pickNext(s2.pool, s2.phraseIdx);
                        stateRef.current = {
                            phase: 'typing', charIdx: 0,
                            phraseIdx: picked.phraseIdx,
                            pool: picked.pool,
                            lastPool: s2.pool, lastIdx: s2.phraseIdx,
                            contextPhrase: s2.contextPhrase,
                            contextUsed: s2.contextUsed,
                        };
                    }
                    timerRef.current = setTimeout(tick, THINKING_GAP);
                } else {
                    stateRef.current = { ...s, charIdx: next };
                    timerRef.current = setTimeout(tick, THINKING_DELETE_SPEED);
                }
            }
        };

        timerRef.current = setTimeout(tick, STREAM_SPEED);
        return () => clearTimeout(timerRef.current);
    }, [active, customThinkingPhrases]); // eslint-disable-line react-hooks/exhaustive-deps

    return displayed;
}

// Utilidad: tiempo relativo legible ("hace 2 min", "hace 3h", etc.)
function timeAgo(isoDate) {
    if (!isoDate) return '';
    const diff = Date.now() - new Date(isoDate).getTime();
    if (diff < 0) return 'ahora';
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return 'ahora';
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `hace ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'ayer';
    if (days < 7) return `hace ${days}d`;
    if (days < 30) return `hace ${Math.floor(days / 7)} sem`;
    return `hace ${Math.floor(days / 30)} mes${Math.floor(days / 30) > 1 ? 'es' : ''}`;
}

const ChatIA = forwardRef(({ onSearch, loading, explanation, onClear, initialQuery = '', incognitoMode = false, allowNsfw = false, placeholderPhrases = EMPTY_PLACEHOLDER_PHRASES, thinkingPhrases = EMPTY_PLACEHOLDER_PHRASES }, ref) => {
    const router = useRouter();
    const [query, setQuery] = useState(initialQuery);
    const [isTyping, setIsTyping] = useState(false);
    const [placeholder, setPlaceholder] = useState('');
    const [activeTab, setActiveTab] = useState('popular');
    const [phrases, setPhrases] = useState([]);
    const [popularSuggestions, setPopularSuggestions] = useState([]);
    const [similarSuggestions, setSimilarSuggestions] = useState([]);
    const [newestSuggestions, setNewestSuggestions] = useState([]);
    const [trendingSuggestions, setTrendingSuggestions] = useState([]);
    const [relatedSuggestions, setRelatedSuggestions] = useState([]);
    const [afterSearchSuggestions, setAfterSearchSuggestions] = useState([]);
    const lastSearchedQuery = useRef(''); // para pedir related queries tras búsqueda
    const phrasesSetAtRef = useRef(0); // timestamp del último seteo de phrases (para no reiniciar el typewriter)
    const [suggestions, setSuggestions] = useState([]);
    const [allSimilarQueries, setAllSimilarQueries] = useState([]);
    const [visibleSimilar, setVisibleSimilar] = useState([]);
    const [isFocused, setIsFocused] = useState(false);
    const [history, setHistory] = useState([]);
    const [autocompleteResults, setAutocompleteResults] = useState([]);
    const [filteredPhrases, setFilteredPhrases] = useState([]);
    const [autocompleteLoading, setAutocompleteLoading] = useState(false);
    const [nsfwWarning, setNsfwWarning] = useState(null);
    const [countBumped, setCountBumped] = useState({}); // { queryKey: true } para queries cuyo contador subió
    const prevCountsRef = useRef({}); // snapshot previo de contadores por query
    const debounceRef = useRef(null);
    const abortRef = useRef(null);
    const placeholderAnimationActive = !loading && !isFocused && query.trim().length === 0;

    // Rotar las sugerencias "Similares a..." cada vez que se enfoca el input
    const rotateSimilar = useCallback(() => {
        if (allSimilarQueries.length <= 5) {
            setVisibleSimilar(allSimilarQueries);
            return;
        }
        // Mostrar 5 aleatorias cada vez
        const shuffled = [...allSimilarQueries].sort(() => Math.random() - 0.5);
        setVisibleSimilar(shuffled.slice(0, 5));
    }, [allSimilarQueries]);

    // Fetch único de sugerencias: carga inicial + polling cada 5s con contadores frescos
    // Inicializar lastSearchedQuery con initialQuery si viene con búsqueda previa
    useEffect(() => {
        if (initialQuery && initialQuery.trim()) {
            lastSearchedQuery.current = initialQuery.trim();
        }
    }, [initialQuery]);

    useEffect(() => {
        if (incognitoMode) return;

        let cancelled = false;

        const fetchCounters = async () => {
            try {
                const qParam = lastSearchedQuery.current ? `&q=${encodeURIComponent(lastSearchedQuery.current)}` : '';
                const response = await fetch(`${AI_BASE_URL}/api/search-suggestions?_t=${Date.now()}${qParam}`, { cache: 'no-store' });
                const data = await response.json();
                if (cancelled) return;
                if (data.success) {
                    // --- Detectar bumps de contadores para animación dorada ---
                    const allItems = [
                        ...(data.popular || []),
                        ...(data.similar || []),
                        ...(data.newest || []),
                        ...(data.trending || []),
                    ];
                    const newCounts = {};
                    const bumped = {};
                    for (const item of allItems) {
                        if (!item.query || item.count == null) continue;
                        const key = item.query;
                        newCounts[key] = item.count;
                        const prev = prevCountsRef.current[key];
                        if (prev != null && item.count > prev) {
                            bumped[key] = true;
                        }
                    }
                    prevCountsRef.current = newCounts;
                    if (Object.keys(bumped).length > 0) {
                        setCountBumped(prev => ({ ...prev, ...bumped }));
                        // Limpiar las clases de animación después de que termine (2.4s)
                        setTimeout(() => {
                            setCountBumped(prev => {
                                const next = { ...prev };
                                for (const k of Object.keys(bumped)) delete next[k];
                                return next;
                            });
                        }, 2400);
                    }

                    if (Array.isArray(data.popular) && data.popular.length > 0) {
                        setPopularSuggestions(data.popular);
                        setSuggestions(data.popular.slice(0, 5));
                    }

                    // --- Placeholder dinámico: 20 queries aleatorias de los usuarios ---
                    // Combina todas las fuentes (popular + similar + newest + trending),
                    // deduplica, filtra queries absurdamente largas, mezcla y toma 20.
                    const allUserQueries = [
                        ...(data.popular || []),
                        ...(data.similar || []),
                        ...(data.newest || []),
                        ...(data.trending || []),
                    ]
                        .map(q => q.query)
                        .filter(q => typeof q === 'string' && q.length >= 5 && q.length <= 90);

                    const uniqueQueries = [...new Set(allUserQueries)];

                    // Solo refrescar phrases la primera vez o cada 5 minutos,
                    // para no reiniciar el typewriter en cada poll de 5s
                    const FIVE_MIN = 5 * 60 * 1000;
                    const shouldRefreshPhrases = uniqueQueries.length > 0 &&
                        (phrasesSetAtRef.current === 0 || (Date.now() - phrasesSetAtRef.current) > FIVE_MIN);

                    if (shouldRefreshPhrases) {
                        const shuffled = shuffleArray(uniqueQueries).slice(0, 20);
                        // Si tenemos pocas queries de usuario, completamos con FALLBACK_PHRASES
                        const finalPhrases = shuffled.length >= 20
                            ? shuffled
                            : [...shuffled, ...shuffleArray(FALLBACK_PHRASES).slice(0, 20 - shuffled.length)];
                        setPhrases(finalPhrases);
                        phrasesSetAtRef.current = Date.now();
                    }
                    if (Array.isArray(data.similar) && data.similar.length > 0) {
                        setSimilarSuggestions(data.similar);
                        setAllSimilarQueries(data.similar);
                        setVisibleSimilar(data.similar.slice(0, 5));
                    }
                    // --- Nuevos: usar data.newest del server, sino fallback inteligente ---
                    if (Array.isArray(data.newest) && data.newest.length > 0) {
                        setNewestSuggestions(data.newest);
                    } else {
                        // Fallback: combinar popular + similar, filtrar queries absurdamente largas,
                        // ordenar por menor count (las menos buscadas son las más nuevas)
                        const allQueries = [
                            ...(data.popular || []),
                            ...(data.similar || []),
                        ];
                        const seen = new Set();
                        const clean = allQueries.filter(q => {
                            if (!q.query || q.query.length > 80 || seen.has(q.query)) return false;
                            seen.add(q.query);
                            return true;
                        });
                        const byLowestCount = [...clean].sort((a, b) => (a.count || 0) - (b.count || 0));
                        setNewestSuggestions(
                            byLowestCount.slice(0, 15).map((q, i) => ({ ...q, rank: i + 1 }))
                        );
                    }

                    // --- Tendencias: usar data.trending del server, sino fallback ---
                    if (Array.isArray(data.trending) && data.trending.length > 0) {
                        setTrendingSuggestions(data.trending);
                    } else {
                        // Fallback: top populares (sin "similares a...") = tendencias
                        const similarRx = /similares?\s*(a\b|al\b)|^similar\s+a\s/i;
                        const trendFallback = (data.popular || [])
                            .filter(q => q.query && !similarRx.test(q.query) && q.query.length <= 80);
                        setTrendingSuggestions(
                            trendFallback.slice(0, 10).map((q, i) => ({
                                ...q,
                                rank: i + 1,
                                hotScore: q.count || 0,
                            }))
                        );
                    }

                    // --- After-search: "Porque buscaste X, otros buscaron..." ---
                    if (Array.isArray(data.afterSearch) && data.afterSearch.length > 0) {
                        setAfterSearchSuggestions(data.afterSearch);
                    } else {
                        setAfterSearchSuggestions([]);
                    }

                    // --- Queries relacionadas: del server o fallback por keywords ---
                    if (Array.isArray(data.related) && data.related.length > 0) {
                        setRelatedSuggestions(data.related);
                    } else if (lastSearchedQuery.current) {
                        // Fallback cliente: buscar queries que compartan palabras clave con la última búsqueda
                        const stopwords = new Set(['manhwa', 'manhwas', 'manga', 'similar', 'similares', 'como', 'tipo', 'estilo', 'con', 'de', 'del', 'el', 'la', 'los', 'las', 'un', 'una', 'que', 'para', 'por', 'en', 'a', 'al', 'y', 'o', 'mas', 'the', 'of', 'and', 'to', 'is', 'mejores', 'mejor', 'top', 'buenos']);
                        const inputWords = lastSearchedQuery.current.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/).filter(w => w.length >= 3 && !stopwords.has(w));
                        if (inputWords.length > 0) {
                            const allQ = [...(data.popular || []), ...(data.similar || [])];
                            const seen = new Set();
                            const inputKey = lastSearchedQuery.current.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
                            const related = allQ
                                .filter(q => {
                                    if (!q.query || seen.has(q.query)) return false;
                                    const qNorm = q.query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
                                    if (qNorm === inputKey) return false;
                                    seen.add(q.query);
                                    const qWords = qNorm.split(/\s+/).filter(w => w.length >= 3 && !stopwords.has(w));
                                    const shared = inputWords.filter(w => qWords.some(qw => qw.includes(w) || w.includes(qw)));
                                    return shared.length >= 1;
                                })
                                .slice(0, 8)
                                .map((q, i) => ({ ...q, rank: i + 1 }));
                            setRelatedSuggestions(related);
                        } else {
                            setRelatedSuggestions([]);
                        }
                    }
                }
            } catch (_) { }
        };

        // Carga inicial inmediata
        fetchCounters();
        // Polling cada 5s
        const interval = setInterval(fetchCounters, 5000);

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [incognitoMode]);

    const localAutocompletePhrasePool = useMemo(() => {
        const merged = [...FALLBACK_PHRASES, ...popularSuggestions.map(s => s.query), ...similarSuggestions.map(s => s.query)];
        return [...new Set(merged)];
    }, [popularSuggestions, similarSuggestions]);


    // Refrescar historial cuando se enfoca el input
    const refreshHistory = useCallback(() => {
        if (incognitoMode) {
            setHistory([]);
            return;
        }
        try {
            setHistory(getSearchHistory(5));
        } catch { setHistory([]); }
    }, [incognitoMode]);

    const handleRemoveHistory = useCallback((slug, e) => {
        if (incognitoMode) return;
        e.stopPropagation();
        e.preventDefault();
        removeFromHistory(slug);
        refreshHistory();
    }, [incognitoMode, refreshHistory]);

    // Sincronizar initialQuery cuando cambia (ej: navegación entre rutas)
    const prevInitialQuery = useRef(initialQuery);
    useEffect(() => {
        if (initialQuery !== prevInitialQuery.current) {
            prevInitialQuery.current = initialQuery;
            setQuery(initialQuery);
        }
    }, [initialQuery]);

    // Refs para el loop typewriter (sin re-renders)
    const phraseIdxRef = useRef(0);
    const charIdxRef = useRef(0);
    const isDeletingRef = useRef(false);
    const timeoutRef = useRef(null);
    const wrapperRef = useRef(null);
    const inputRef = useRef(null);
    const externalTypewriterRef = useRef(null);

    // API externa: permite que componentes padre escriban texto en el input con efecto typewriter
    useImperativeHandle(ref, () => ({
        focus() {
            inputRef.current?.focus();
        },
        typeText(text, onDone) {
            if (externalTypewriterRef.current) {
                clearInterval(externalTypewriterRef.current);
                externalTypewriterRef.current = null;
            }
            setQuery('');
            setIsFocused(false);
            let i = 0;
            externalTypewriterRef.current = setInterval(() => {
                i++;
                setQuery(text.slice(0, i));
                if (i >= text.length) {
                    clearInterval(externalTypewriterRef.current);
                    externalTypewriterRef.current = null;
                    if (typeof onDone === 'function') onDone();
                }
            }, 18);
        },
    }));

    useEffect(() => {
        return () => {
            if (externalTypewriterRef.current) clearInterval(externalTypewriterRef.current);
        };
    }, []);

    // Streaming de la respuesta IA
    const streamedExplanation = useStreamingText(explanation || '', !!explanation && !loading);

    // Frase de pensando con ciclo completo escribe/borra (aleatorio + contextual)
    const thinkingStream = useThinkingStream(loading, query, thinkingPhrases);

    // Determinar qué texto mostrar en el card
    const cardVisible = loading || !!explanation;
    const cardText = loading ? thinkingStream : streamedExplanation;

    // --- Fetch top consultas populares + similares (endpoints separados, en paralelo) ---
    useEffect(() => {
        if (Array.isArray(placeholderPhrases) && placeholderPhrases.length > 0) {
            setPhrases(shuffleArray(placeholderPhrases));
        }

        if (incognitoMode) {
            setSuggestions([]);
            setAllSimilarQueries([]);
            setVisibleSimilar([]);
            return;
        }

        // Poner fallback de inmediato para que el dropdown funcione desde el primer click
        setSuggestions(FALLBACK_SUGGESTIONS);
        setPhrases(shuffleArray(FALLBACK_PHRASES));
    }, [incognitoMode, placeholderPhrases]);

    // (Polling de contadores unificado en el useEffect de arriba)

    // --- Efecto máquina de escribir (placeholder) ---
    useEffect(() => {
        clearTimeout(timeoutRef.current);

        if (!placeholderAnimationActive || !phrases.length) {
            setPlaceholder('');
            return;
        }

        phraseIdxRef.current = 0;
        charIdxRef.current = 0;
        isDeletingRef.current = false;

        const tick = () => {
            const phrase = phrases[phraseIdxRef.current];
            const isDeleting = isDeletingRef.current;

            if (!isDeleting) {
                charIdxRef.current++;
                setPlaceholder(phrase.slice(0, charIdxRef.current));

                if (charIdxRef.current === phrase.length) {
                    isDeletingRef.current = true;
                    timeoutRef.current = setTimeout(tick, PAUSE_AFTER);
                } else {
                    timeoutRef.current = setTimeout(tick, TYPING_SPEED);
                }
            } else {
                charIdxRef.current--;
                setPlaceholder(phrase.slice(0, charIdxRef.current));

                if (charIdxRef.current === 0) {
                    isDeletingRef.current = false;
                    phraseIdxRef.current = (phraseIdxRef.current + 1) % phrases.length;
                    timeoutRef.current = setTimeout(tick, PAUSE_BEFORE);
                } else {
                    timeoutRef.current = setTimeout(tick, DELETING_SPEED);
                }
            }
        };

        timeoutRef.current = setTimeout(tick, 800);
        return () => clearTimeout(timeoutRef.current);
    }, [phrases, placeholderAnimationActive]);

    // --- Cerrar dropdown al hacer scroll, Escape, o click fuera del wrapper ---
    useEffect(() => {
        const closeDropdown = () => setIsFocused(false);

        const handleScroll = () => closeDropdown();
        const handleKeyDown = (e) => { if (e.key === 'Escape') closeDropdown(); };
        const handleClickOutside = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                closeDropdown();
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            window.removeEventListener('scroll', handleScroll);
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // --- Cerrar dropdown cuando empieza a buscar ---
    useEffect(() => {
        if (loading) setIsFocused(false);
    }, [loading]);

    // --- Indicador de escritura del usuario ---
    useEffect(() => {
        const t = setTimeout(() => setIsTyping(false), 900);
        return () => clearTimeout(t);
    }, [query]);

    // Función debounced para autocomplete API
    const debouncedAutocomplete = useCallback((value) => {
        if (incognitoMode) {
            setFilteredPhrases([]);
            setAutocompleteResults([]);
            setAutocompleteLoading(false);
            return;
        }

        // Filtrar frases IA localmente (instantáneo)
        const lower = value.toLowerCase();
        const matched = localAutocompletePhrasePool
            .filter(p => p.toLowerCase().includes(lower))
            .filter(p => allowNsfw || !detectNsfwQuery(p).isNsfw)
            .slice(0, 4);
        setFilteredPhrases(matched);

        // Cancelar debounce anterior
        clearTimeout(debounceRef.current);

        if (value.length < 2) {
            setAutocompleteResults([]);
            setAutocompleteLoading(false);
            return;
        }

        setAutocompleteLoading(true);

        debounceRef.current = setTimeout(async () => {
            // Detección NSFW en tiempo real mientras escribe (debounced 300ms)
            if (!allowNsfw) {
                const nsfwCheck = detectNsfwQuery(value);
                if (nsfwCheck.isNsfw) {
                    setNsfwWarning(nsfwCheck.message);
                    setAutocompleteResults([]);
                    setFilteredPhrases([]);
                    setAutocompleteLoading(false);
                    return;
                }
            }

            // Cancelar request anterior
            if (abortRef.current) abortRef.current.abort();
            const controller = new AbortController();
            abortRef.current = controller;

            try {
                const res = await api.get('search', `autocomplete?q=${encodeURIComponent(value)}&limit=6`, {
                    signal: controller.signal
                });
                if (!controller.signal.aborted && res?.success && res.data?.suggestions) {
                    // Filtrar resultados adultos en contextos no-NSFW
                    const suggestions = allowNsfw
                        ? res.data.suggestions
                        : res.data.suggestions.filter(s => !detectNsfwQuery(s.title || s.name || '').isNsfw);
                    setAutocompleteResults(suggestions);
                }
            } catch {
                // Ignorar errores de abort o red
            } finally {
                if (!controller.signal.aborted) setAutocompleteLoading(false);
            }
        }, 300);
    }, [incognitoMode, allowNsfw, localAutocompletePhrasePool]);

    // Cleanup debounce y abort en unmount
    useEffect(() => {
        return () => {
            clearTimeout(debounceRef.current);
            if (abortRef.current) abortRef.current.abort();
        };
    }, []);

    const handleInput = (e) => {
        const value = e.target.value;
        setQuery(value);
        setIsTyping(true);
        if (nsfwWarning) setNsfwWarning(null);

        if (incognitoMode) {
            setFilteredPhrases([]);
            setAutocompleteResults([]);
            setAutocompleteLoading(false);
            setIsFocused(false);
            clearTimeout(debounceRef.current);
            return;
        }

        if (value.length > 0) {
            setIsFocused(true);
            debouncedAutocomplete(value);
        } else {
            setFilteredPhrases([]);
            setAutocompleteResults([]);
            setAutocompleteLoading(false);
            clearTimeout(debounceRef.current);
        }
    };

    const clearAutocomplete = () => {
        setAutocompleteResults([]);
        setFilteredPhrases([]);
        setAutocompleteLoading(false);
        clearTimeout(debounceRef.current);
        if (abortRef.current) abortRef.current.abort();
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const value = query.trim();
        if (!value || loading) return;

        // Detectar consultas NSFW y mostrar advertencia (solo en contextos no-adultos)
        if (!allowNsfw) {
            try {
                const nsfwCheck = detectNsfwQuery(value);
                if (nsfwCheck && nsfwCheck.isNsfw) {
                    setNsfwWarning(nsfwCheck.message);
                    clearAutocomplete();
                    setIsFocused(false);
                    return;
                }
            } catch { /* nunca bloquear la búsqueda por error de detección */ }
        }
        setNsfwWarning(null);

        clearAutocomplete();
        setIsFocused(false);
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
        lastSearchedQuery.current = value;
        if (typeof onSearch === 'function') onSearch(value);
    };

    const handleSuggestionClick = (text) => {
        setQuery(text);
        clearAutocomplete();
        setIsFocused(false);

        if (!allowNsfw) {
            try {
                const nsfwCheck = detectNsfwQuery(text);
                if (nsfwCheck && nsfwCheck.isNsfw) {
                    setNsfwWarning(nsfwCheck.message);
                    return;
                }
            } catch { /* nunca bloquear la búsqueda por error de detección */ }
        }
        setNsfwWarning(null);

        lastSearchedQuery.current = text;
        if (typeof onSearch === 'function') onSearch(text);
    };

    const getStateClass = () => {
        if (loading) return 'ia-processing';
        if (isTyping) return 'ia-typing';
        return 'ia-idle';
    };

    const hasAutocompleteContent = filteredPhrases.length > 0 || autocompleteResults.length > 0 || autocompleteLoading;
    const showIncognitoDropdown = incognitoMode && isFocused && !loading;
    const showDropdown = !incognitoMode && isFocused && !loading && (
        (query.length === 0 && (suggestions.length > 0 || visibleSimilar.length > 0 || newestSuggestions.length > 0 || trendingSuggestions.length > 0 || relatedSuggestions.length > 0 || afterSearchSuggestions.length > 0)) ||
        (query.length > 0 && hasAutocompleteContent)
    );

    return (
        <div className="ia-wrapper" ref={wrapperRef} aria-busy={loading}>
            <form
                className={`ia-search ${getStateClass()}`}
                onSubmit={handleSubmit}
                aria-label="IA Imperial"
            >
                {loading && <span className="sr-only" role="status">Buscando resultados...</span>}
                <div className="ia-shimmer" aria-hidden="true" />

                <svg className="ia-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
                </svg>

                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={handleInput}
                    onFocus={() => {
                        if (incognitoMode) {
                            setIsFocused(true);
                            return;
                        }
                        setIsFocused(true);
                        refreshHistory();
                        rotateSimilar();
                    }}
                    onBlur={() => setTimeout(() => setIsFocused(false), 150)}
                    className="ia-input"
                    disabled={loading}
                    spellCheck="false"
                    autoComplete="off"
                    maxLength={300}
                    placeholder={loading ? 'Buscando...' : (placeholder)}
                    aria-label="Escribe tu consulta"
                />

                {loading && (
                    <div className="ia-dots" aria-label="Procesando">
                        <span /><span /><span />
                    </div>
                )}
            </form>

            {/* Advertencia NSFW — redirige al usuario a /nsfw */}
            {nsfwWarning && (
                <div className="ia-nsfw-warning" role="alert">
                    <div className="ia-nsfw-warning-content">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        <span>{nsfwWarning}</span>
                    </div>
                    <Link href="/nsfw" className="ia-nsfw-warning-link">
                        Ir a /nsfw
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12" />
                            <polyline points="12 5 19 12 12 19" />
                        </svg>
                    </Link>
                </div>
            )}

            {/* Card de respuesta IA — visible cuando carga O cuando hay explanation */}
            {cardVisible && (
                <div className={`ia-response-card ${loading ? 'ia-response-loading' : 'ia-response-done'}`}>
                    <div className="ia-response-shimmer" aria-hidden="true" />
                    <div className="ia-response-header">
                        {/* Icono sparkles SVG inline */}
                        <svg className="ia-sparkle-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
                        </svg>
                        <span className="ia-response-title">IA Imperial</span>
                        <span className="ia-response-badge">
                            {loading ? 'Procesando' : 'Búsqueda Inteligente'}
                        </span>

                        {/* Botón cerrar — solo cuando ya hay respuesta */}
                        {!loading && typeof onClear === 'function' && (
                            <button
                                className="ia-response-close"
                                onClick={onClear}
                                aria-label="Cerrar respuesta IA"
                                type="button"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        )}
                    </div>

                    <p className="ia-response-text">
                        {cardText}
                    </p>
                </div>
            )}

            {showIncognitoDropdown && (
                <div className="ia-suggestions" role="status" aria-label="Modo incógnito">
                    <div className="ia-incognito-note" aria-hidden="true">
                        <div className="ia-incognito-icon-wrap">
                            <svg className="ia-incognito-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="10" rx="2" ry="2" />
                                <path d="M7 11V8a5 5 0 0 1 10 0v3" />
                            </svg>
                        </div>
                        <div className="ia-incognito-copy">
                            <span className="ia-incognito-title">Modo incognito</span>
                            <span className="ia-incognito-subtitle">No se muestra historial ni sugerencias públicas.</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Dropdown de historial + consultas populares / autocomplete */}
            {showDropdown && (
                <div className="ia-suggestions" role="listbox" aria-label="Sugerencias de búsqueda">
                    {query.length === 0 ? (
                        /* Modo vacío: tabs de navegación */
                        <>
                            {/* ─── Barra de tabs ─── */}
                            <div className="ia-tabs-bar" role="tablist" aria-label="Categorías de sugerencias">
                                {[
                                    { id: 'popular',  label: 'Populares' },
                                    { id: 'trending', label: '🔥 Tendencias' },
                                    { id: 'similar',  label: 'Similares a...' },
                                    { id: 'newest',   label: 'Nuevos' },
                                    ...(afterSearchSuggestions.length > 0 ? [{ id: 'afterSearch', label: '👥 Porque buscaste' }] : []),
                                    ...(relatedSuggestions.length > 0 ? [{ id: 'related', label: '🔗 Relacionadas' }] : []),
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        role="tab"
                                        aria-selected={activeTab === tab.id}
                                        className={[
                                            'ia-tab',
                                            activeTab === tab.id ? 'ia-tab-active' : '',
                                        ].filter(Boolean).join(' ')}
                                        onMouseDown={(e) => { e.preventDefault(); setActiveTab(tab.id); }}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            {/* ─── Contenido del tab activo ─── */}
                            <div className="ia-tab-content" role="tabpanel">

                                {/* Populares */}
                                {activeTab === 'popular' && (
                                    suggestions.length > 0
                                        ? suggestions.map((s, i) => (
                                            <button
                                                key={`pop-${s.query}`}
                                                type="button"
                                                className={`ia-suggestion-item${countBumped[s.query] ? ' ia-count-bumped' : ''}`}
                                                onMouseDown={(e) => { e.preventDefault(); handleSuggestionClick(s.query); }}
                                                role="option"
                                            >
                                                <RankBadge rank={i + 1} />
                                                <span className="ia-suggestion-text">{s.query}</span>
                                                {s.count != null && (
                                                    <span className={`ia-suggestion-count${countBumped[s.query] ? ' ia-count-flash' : ''}`}>
                                                        {s.count}x
                                                    </span>
                                                )}
                                            </button>
                                        ))
                                        : <p className="ia-tab-empty">Sin consultas populares aún</p>
                                )}

                                {/* Nuevos — consultas más nuevas del servidor con timestamp relativo */}
                                {activeTab === 'newest' && (
                                    newestSuggestions.length > 0
                                        ? newestSuggestions.slice(0, 15).map((s, i) => {
                                            const isBumped = countBumped[s.query];
                                            const showNewBadge = i < 3 && (s.count == null || s.count <= 1);
                                            return (
                                                <button
                                                    key={`new-${s.query}-${i}`}
                                                    type="button"
                                                    className={`ia-suggestion-item ia-newest-item${isBumped ? ' ia-count-bumped' : ''}`}
                                                    onMouseDown={(e) => { e.preventDefault(); handleSuggestionClick(s.query); }}
                                                    role="option"
                                                >
                                                    <svg className="ia-newest-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <circle cx="12" cy="12" r="10" />
                                                        <polyline points="12 6 12 12 16 14" />
                                                    </svg>
                                                    <span className="ia-suggestion-text-wrap">
                                                        <span className="ia-suggestion-text">{s.query}</span>
                                                        {s.firstSeen && (
                                                            <span className="ia-newest-time">{timeAgo(s.firstSeen)}</span>
                                                        )}
                                                    </span>
                                                    {s.count != null && s.count > 1 && (
                                                        <span className={`ia-suggestion-count${isBumped ? ' ia-count-flash' : ''}`}>
                                                            {s.count}x
                                                        </span>
                                                    )}
                                                    {showNewBadge && <span className="ia-new-badge">NEW</span>}
                                                </button>
                                            );
                                        })
                                        : <p className="ia-tab-empty">Sin consultas nuevas aún</p>
                                )}

                                {/* Similares a... */}
                                {activeTab === 'similar' && (
                                    visibleSimilar.length > 0
                                        ? visibleSimilar.map((s, i) => {
                                            // En mobile acortar "manhwas similares a X" → "Similar a X"
                                            const shortQuery = s.query.replace(/^.*?similares?\s*(?:a|al)\s+/i, '');
                                            return (
                                            <button
                                                key={`sim-${s.query}`}
                                                type="button"
                                                className={`ia-suggestion-item ia-similar-item${countBumped[s.query] ? ' ia-count-bumped' : ''}`}
                                                onMouseDown={(e) => { e.preventDefault(); handleSuggestionClick(s.query); }}
                                                role="option"
                                            >
                                                <RankBadge rank={i + 1} />
                                                <span className="ia-suggestion-text-wrap">
                                                    <span className="ia-similar-sublabel">Similares a</span>
                                                    <span className="ia-suggestion-text ia-similar-full">{s.query}</span>
                                                    <span className="ia-suggestion-text ia-similar-short">{shortQuery}</span>
                                                </span>
                                                {s.count != null && (
                                                    <span className={`ia-suggestion-count${countBumped[s.query] ? ' ia-count-flash' : ''}`}>
                                                        {s.count}x
                                                    </span>
                                                )}
                                            </button>
                                            );
                                        })
                                        : <p className="ia-tab-empty">Sin sugerencias similares aún</p>
                                )}

                                {/* Tendencias — queries "hot" del día */}
                                {activeTab === 'trending' && (
                                    trendingSuggestions.length > 0
                                        ? trendingSuggestions.slice(0, 10).map((s, i) => (
                                            <button
                                                key={`trend-${s.query}-${i}`}
                                                type="button"
                                                className={`ia-suggestion-item ia-trending-item${countBumped[s.query] ? ' ia-count-bumped' : ''}`}
                                                onMouseDown={(e) => { e.preventDefault(); handleSuggestionClick(s.query); }}
                                                role="option"
                                            >
                                                <span className={`ia-trending-badge ${i < 3 ? 'ia-trending-hot' : ''}`}>
                                                    {i < 3 ? '🔥' : `#${i + 1}`}
                                                </span>
                                                <span className="ia-suggestion-text-wrap">
                                                    <span className="ia-suggestion-text">{s.query}</span>
                                                    {s.lastSeen && (
                                                        <span className="ia-trending-time">{timeAgo(s.lastSeen)}</span>
                                                    )}
                                                </span>
                                                {s.count != null && (
                                                    <span className={`ia-suggestion-count${countBumped[s.query] ? ' ia-count-flash' : ''}`}>
                                                        {s.count}x
                                                    </span>
                                                )}
                                            </button>
                                        ))
                                        : <p className="ia-tab-empty">Sin tendencias hoy — las consultas populares aparecerán aquí</p>
                                )}

                                {/* After-search — "Porque buscaste X, otros buscaron..." (patrón colectivo) */}
                                {activeTab === 'afterSearch' && (
                                    afterSearchSuggestions.length > 0
                                        ? (
                                            <>
                                                {lastSearchedQuery.current && (
                                                    <p className="ia-afterSearch-header">
                                                        Porque buscaste <strong>{lastSearchedQuery.current}</strong>, otros buscaron:
                                                    </p>
                                                )}
                                                {afterSearchSuggestions.slice(0, 10).map((s, i) => (
                                                    <button
                                                        key={`after-${s.query}-${i}`}
                                                        type="button"
                                                        className={`ia-suggestion-item ia-afterSearch-item${countBumped[s.query] ? ' ia-count-bumped' : ''}`}
                                                        onMouseDown={(e) => { e.preventDefault(); handleSuggestionClick(s.query); }}
                                                        role="option"
                                                    >
                                                        <span className="ia-afterSearch-badge">👥</span>
                                                        <span className="ia-suggestion-text-wrap">
                                                            <span className="ia-suggestion-text">{s.query}</span>
                                                        </span>
                                                        {s.count != null && (
                                                            <span className={`ia-suggestion-count${countBumped[s.query] ? ' ia-count-flash' : ''}`}>
                                                                {s.count}x
                                                            </span>
                                                        )}
                                                    </button>
                                                ))}
                                            </>
                                        )
                                        : <p className="ia-tab-empty">Busca algo para ver el patrón colectivo</p>
                                )}

                                {/* Relacionadas — queries por co-ocurrencia de keywords */}
                                {activeTab === 'related' && (
                                    relatedSuggestions.length > 0
                                        ? relatedSuggestions.slice(0, 10).map((s, i) => (
                                            <button
                                                key={`rel-${s.query}-${i}`}
                                                type="button"
                                                className={`ia-suggestion-item ia-related-item${countBumped[s.query] ? ' ia-count-bumped' : ''}`}
                                                onMouseDown={(e) => { e.preventDefault(); handleSuggestionClick(s.query); }}
                                                role="option"
                                            >
                                                <span className="ia-related-badge">
                                                    {i < 3 ? '🔗' : `#${i + 1}`}
                                                </span>
                                                <span className="ia-suggestion-text-wrap">
                                                    <span className="ia-suggestion-text">{s.query}</span>
                                                    {s.sharedKeywords && s.sharedKeywords.length > 0 && (
                                                        <span className="ia-related-keywords">
                                                            {s.sharedKeywords.slice(0, 3).join(', ')}
                                                        </span>
                                                    )}
                                                </span>
                                                {s.count != null && (
                                                    <span className={`ia-suggestion-count${countBumped[s.query] ? ' ia-count-flash' : ''}`}>
                                                        {s.count}x
                                                    </span>
                                                )}
                                            </button>
                                        ))
                                        : <p className="ia-tab-empty">Busca algo para ver queries relacionadas</p>
                                )}

                            </div>
                        </>
                    ) : (
                        /* Modo escritura: sugerencias IA + resultados visuales */
                        <>
                            {filteredPhrases.length > 0 && (
                                <>
                                    <p className="ia-suggestions-label">Sugerencias IA</p>
                                    {filteredPhrases.map((phrase) => (
                                        <button
                                            key={phrase}
                                            type="button"
                                            className="ia-suggestion-item"
                                            onMouseDown={(e) => { e.preventDefault(); handleSuggestionClick(phrase); }}
                                            role="option"
                                        >
                                            <svg className="ia-ai-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
                                            </svg>
                                            <span className="ia-suggestion-text">{phrase}</span>
                                        </button>
                                    ))}
                                </>
                            )}
                            {autocompleteResults.length > 0 && (
                                <>
                                    <p className="ia-suggestions-label">Resultados</p>
                                    {autocompleteResults.map((r) => (
                                        <a
                                            key={r.slug}
                                            href={`/series/${r.slug}`}
                                            className="ia-suggestion-item ia-series-result"
                                            onMouseDown={(e) => { e.preventDefault(); }}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                clearAutocomplete();
                                                setIsFocused(false);
                                                router.push(`/manhwa/${r.slug}`);
                                            }}
                                            role="option"
                                        >
                                            {r.coverUrl && (
                                                <img
                                                    className="ia-series-thumb"
                                                    src={r.coverUrl}
                                                    alt=""
                                                    loading="lazy"
                                                />
                                            )}
                                            <div className="ia-series-info">
                                                <span className="ia-series-title">{r.title}</span>
                                                {Array.isArray(r.genres) && r.genres.length > 0 && (
                                                    <div className="ia-series-tags">
                                                        {r.genres.slice(0, 3).map((g) => (
                                                            <span key={g.slug} className="ia-series-tag">{g.name}</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </a>
                                    ))}
                                </>
                            )}
                            {autocompleteLoading && autocompleteResults.length === 0 && (
                                <div className="ia-autocomplete-loading">
                                    <div className="ia-dots" aria-label="Cargando">
                                        <span /><span /><span />
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
});

ChatIA.displayName = 'ChatIA';

export default ChatIA;
