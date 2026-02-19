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
        if (loading) return 'state-processing';
        if (isTyping) return 'state-typing';
        return 'state-idle';
    };

    return (
        <div className={`chat-ia-container ${getStateClass()}`}>
            <form className="chat-ia-form" onSubmit={handleSubmit} aria-label="Chat IA">
                <div className="chat-ia-input-wrapper">
                    <input
                        type="text"
                        value={query}
                        onChange={handleInput}
                        className="chat-ia-input"
                        disabled={loading}
                        spellCheck="false"
                        autoComplete="off"
                        placeholder="Pregunta al asistente (pulsa Enter para enviar)..."
                        aria-label="Escribe tu consulta"
                    />

                    {/* Botones removidos: envío por Enter desde el input */}
                </div>
            </form>
        </div>
    );
};

export default ChatIA;