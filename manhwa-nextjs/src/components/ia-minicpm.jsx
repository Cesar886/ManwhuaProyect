'use client';

import React, { useState, useEffect, useRef } from 'react';
import './ia-minicpm.css';

const AI_BASE_URL = (process.env.NEXT_PUBLIC_AI_API_URL || 'https://ai.manhwaimperial.site/api/read')
    .replace('/api/read', '');

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
    'La Inteligencia Imperial está analizando tu solicitud...',
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

function useThinkingStream(active, query = '') {
    const [displayed, setDisplayed] = useState('');
    // pool: 'normal' | 'humor'
    const stateRef = useRef({ phase: 'typing', charIdx: 0, phraseIdx: 0, pool: 'normal', lastPool: null, lastIdx: -1 });
    const timerRef = useRef(null);

    const getPhrase = (pool, idx) =>
        pool === 'humor' ? THINKING_PHRASES_HUMOR[idx] : THINKING_PHRASES[idx];

    // Elige siguiente frase — 4% humor, 96% normal; nunca repite la misma seguida
    const pickNext = (lastPool, lastIdx) => {
        const isHumor = Math.random() < HUMOR_PROBABILITY;
        const pool = isHumor ? THINKING_PHRASES_HUMOR : THINKING_PHRASES;
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
            const initIdx = Math.floor(Math.random() * THINKING_PHRASES.length);
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
    }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

    return displayed;
}

const ChatIA = ({ onSearch, loading, explanation, onClear }) => {
    const [query, setQuery] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [placeholder, setPlaceholder] = useState('');
    const [phrases, setPhrases] = useState([]);
    const [suggestions, setSuggestions] = useState([]); // top 5 para el dropdown
    const [isFocused, setIsFocused] = useState(false);

    // Refs para el loop typewriter (sin re-renders)
    const phraseIdxRef = useRef(0);
    const charIdxRef = useRef(0);
    const isDeletingRef = useRef(false);
    const timeoutRef = useRef(null);
    const wrapperRef = useRef(null);

    // Streaming de la respuesta IA
    const streamedExplanation = useStreamingText(explanation || '', !!explanation && !loading);

    // Frase de pensando con ciclo completo escribe/borra (aleatorio + contextual)
    const thinkingStream = useThinkingStream(loading, query);

    // Determinar qué texto mostrar en el card
    const cardVisible = loading || !!explanation;
    const cardText = loading ? thinkingStream : streamedExplanation;

    // --- Fetch top 20 consultas populares reales ---
    useEffect(() => {
        // Poner fallback de inmediato para que el dropdown funcione desde el primer click
        setSuggestions(FALLBACK_SUGGESTIONS);
        setPhrases(shuffleArray(FALLBACK_PHRASES));

        let cancelled = false;
        fetch(`${AI_BASE_URL}/api/popular?limit=20`)
            .then(r => r.json())
            .then(data => {
                if (cancelled) return;
                if (data.success && Array.isArray(data.queries) && data.queries.length > 0) {
                    setSuggestions(data.queries.slice(0, 5));
                    setPhrases(shuffleArray(data.queries.map(q => q.query)));
                }
            })
            .catch(() => { /* mantiene el fallback ya seteado */ });
        return () => { cancelled = true; };
    }, []);

    // --- Efecto máquina de escribir (placeholder) ---
    useEffect(() => {
        if (!phrases.length) return;

        phraseIdxRef.current = 0;
        charIdxRef.current = 0;
        isDeletingRef.current = false;
        clearTimeout(timeoutRef.current);

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
    }, [phrases]);

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

    const handleInput = (e) => {
        setQuery(e.target.value);
        setIsTyping(true);
        // Cerrar dropdown cuando el usuario escribe algo
        if (e.target.value.length > 0) setIsFocused(false);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const value = query.trim();
        if (!value || loading) return;
        if (typeof onSearch === 'function') onSearch(value);
    };

    const handleSuggestionClick = (text) => {
        setQuery(text);
        setIsFocused(false);
        if (typeof onSearch === 'function') onSearch(text);
    };

    const getStateClass = () => {
        if (loading) return 'ia-processing';
        if (isTyping) return 'ia-typing';
        return 'ia-idle';
    };

    const showDropdown = isFocused && !loading && !isTyping && query.length === 0 && suggestions.length > 0;

    return (
        <div className="ia-wrapper" ref={wrapperRef}>
            <form
                className={`ia-search ${getStateClass()}`}
                onSubmit={handleSubmit}
                aria-label="Buscar con IA"
            >
                <div className="ia-shimmer" aria-hidden="true" />

                <svg className="ia-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
                </svg>

                <input
                    type="text"
                    value={query}
                    onChange={handleInput}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setTimeout(() => setIsFocused(false), 150)}
                    className="ia-input"
                    disabled={loading}
                    spellCheck="false"
                    autoComplete="off"
                    placeholder={loading ? 'Buscando...' : placeholder}
                    aria-label="Escribe tu consulta"
                />

                {loading && (
                    <div className="ia-dots" aria-label="Procesando">
                        <span /><span /><span />
                    </div>
                )}
            </form>

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

            {/* Dropdown de consultas populares */}
            {showDropdown && (
                <div className="ia-suggestions" role="listbox" aria-label="Consultas populares">
                    <p className="ia-suggestions-label">Consultas populares</p>
                    {suggestions.map((s, i) => (
                        <button
                            key={s.query}
                            type="button"
                            className="ia-suggestion-item"
                            onMouseDown={(e) => { e.preventDefault(); handleSuggestionClick(s.query); }}
                            role="option"
                        >
                            <span className="ia-suggestion-rank">#{i + 1}</span>
                            <span className="ia-suggestion-text">{s.query}</span>
                            <span className="ia-suggestion-count">{s.count}x</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ChatIA;
