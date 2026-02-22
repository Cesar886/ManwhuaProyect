'use client';

import React, { useState, useEffect } from 'react';
import './ia-minicpm.css';

const ChatIA = ({ onSearch, loading }) => {
    const [query, setQuery] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    useEffect(() => {
        const timeout = setTimeout(() => setIsTyping(false), 900);
        return () => clearTimeout(timeout);
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

    const getStateClass = () => {
        if (loading) return 'ia-processing';
        if (isTyping) return 'ia-typing';
        return 'ia-idle';
    };

    return (
        <form
            className={`ia-search ${getStateClass()}`}
            onSubmit={handleSubmit}
            aria-label="Buscar con IA"
        >
            {/* Shimmer line — only visible when processing */}
            <div className="ia-shimmer" aria-hidden="true" />

            <svg className="ia-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
            </svg>

            <input
                type="text"
                value={query}
                onChange={handleInput}
                className="ia-input"
                disabled={loading}
                spellCheck="false"
                autoComplete="off"
                placeholder={loading ? "Buscando..." : "Pregunta a la IA..."}
                aria-label="Escribe tu consulta"
            />

            {loading && (
                <div className="ia-dots" aria-label="Procesando">
                    <span /><span /><span />
                </div>
            )}
        </form>
    );
};

export default ChatIA;
