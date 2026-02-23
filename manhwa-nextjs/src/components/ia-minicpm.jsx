'use client';

import React, { useState, useEffect, useRef } from 'react';
import './ia-minicpm.css';

const AI_BASE_URL = (process.env.NEXT_PUBLIC_AI_API_URL || 'https://ai.manhwaimperial.site/api/read')
    .replace('/api/read', '');

// Frases de respaldo si la API aún no tiene datos
const FALLBACK_PHRASES = [
    'Manhwas de acción con protagonista OP',
    'Romance escolar sin drama',
    'Similar a Solo Leveling',
    'Murim con sistema de niveles',
    'Protagonista que regresa al pasado',
    'Manhwa de fantasía con magia',
    'Los mejores manhwas de venganza',
    'Sistema de niveles con reencarnación',
];

const FALLBACK_SUGGESTIONS = FALLBACK_PHRASES.slice(0, 5).map((q, i) => ({
    query: q,
    count: null,
    rank: i + 1,
}));

const TYPING_SPEED   = 55;   // ms por carácter escribiendo
const DELETING_SPEED = 28;   // ms por carácter borrando
const PAUSE_AFTER    = 3000; // ms de pausa tras escribir completo
const PAUSE_BEFORE   = 450;  // ms de pausa antes del siguiente

// Fisher-Yates shuffle
function shuffleArray(arr) {
    const s = [...arr];
    for (let i = s.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [s[i], s[j]] = [s[j], s[i]];
    }
    return s;
}

const ChatIA = ({ onSearch, loading }) => {
    const [query, setQuery]             = useState('');
    const [isTyping, setIsTyping]       = useState(false);
    const [placeholder, setPlaceholder] = useState('');
    const [phrases, setPhrases]         = useState([]);
    const [suggestions, setSuggestions] = useState([]); // top 5 para el dropdown
    const [isFocused, setIsFocused]     = useState(false);

    // Refs para el loop typewriter (sin re-renders)
    const phraseIdxRef  = useRef(0);
    const charIdxRef    = useRef(0);
    const isDeletingRef = useRef(false);
    const timeoutRef    = useRef(null);

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

    // --- Efecto máquina de escribir ---
    useEffect(() => {
        if (!phrases.length) return;

        phraseIdxRef.current  = 0;
        charIdxRef.current    = 0;
        isDeletingRef.current = false;
        clearTimeout(timeoutRef.current);

        const tick = () => {
            const phrase     = phrases[phraseIdxRef.current];
            const isDeleting = isDeletingRef.current;

            if (!isDeleting) {
                charIdxRef.current++;
                setPlaceholder(phrase.slice(0, charIdxRef.current));

                if (charIdxRef.current === phrase.length) {
                    isDeletingRef.current  = true;
                    timeoutRef.current = setTimeout(tick, PAUSE_AFTER);
                } else {
                    timeoutRef.current = setTimeout(tick, TYPING_SPEED);
                }
            } else {
                charIdxRef.current--;
                setPlaceholder(phrase.slice(0, charIdxRef.current));

                if (charIdxRef.current === 0) {
                    isDeletingRef.current  = false;
                    phraseIdxRef.current   = (phraseIdxRef.current + 1) % phrases.length;
                    timeoutRef.current = setTimeout(tick, PAUSE_BEFORE);
                } else {
                    timeoutRef.current = setTimeout(tick, DELETING_SPEED);
                }
            }
        };

        timeoutRef.current = setTimeout(tick, 800);
        return () => clearTimeout(timeoutRef.current);
    }, [phrases]);

    // --- Indicador de escritura del usuario ---
    useEffect(() => {
        const t = setTimeout(() => setIsTyping(false), 900);
        return () => clearTimeout(t);
    }, [query]);

    const handleInput = (e) => {
        setQuery(e.target.value);
        setIsTyping(true);
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
        if (loading)  return 'ia-processing';
        if (isTyping) return 'ia-typing';
        return 'ia-idle';
    };

    const showDropdown = isFocused && !loading && suggestions.length > 0;

    return (
        <div className="ia-wrapper">
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
