// src/hooks/useIA.js
import { useState, useCallback } from 'react';

const AI_API_URL = process.env.NEXT_PUBLIC_AI_API_URL || 'https://ai.manhwaimperial.site/api/read';

export function useIA() {
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState(null);
    const [resultados, setResultados] = useState(null);

    const buscarConIA = useCallback(async (texto) => {
        if (!texto || texto.trim().length === 0) {
            setError('Por favor escribe una pregunta');
            return null;
        }

        setCargando(true);
        setError(null);
        setResultados(null); // Limpiamos resultados previos para mejorar la UX

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s por si Ollama está cargando el modelo

            const response = await fetch(AI_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [{ role: 'user', content: texto.trim() }]
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Error ${response.status}`);
            }

            const data = await response.json();
            
            // Verificamos si la respuesta tiene el formato esperado del backend
            if (data.success) {
                setResultados(data);
            } else {
                throw new Error('La IA no pudo procesar la solicitud correctamente');
            }
            
            setCargando(false);
            return data;

        } catch (err) {
            let errorMsg = 'Error al conectar con la IA';
            if (err.name === 'AbortError') errorMsg = 'La IA tardó demasiado en responder';
            else errorMsg = err.message;
            
            setError(errorMsg);
            setCargando(false);
            return null;
        }
    }, []);

    const limpiar = useCallback(() => {
        setResultados(null);
        setError(null);
    }, []);

    return { buscarConIA, cargando, error, resultados, limpiar };
}