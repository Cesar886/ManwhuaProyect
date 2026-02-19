/**
 * Validador de username
 * src/utils/usernameValidator.js
 */

const { ALL_RESERVED, RESERVED_USERNAMES } = require('./reservedUsernames');

/**
 * Normalizar username para comparación
 * Convierte variantes como "Adm1n" → "admin"
 */
const normalizeUsername = (username) => {
    return username
        .toLowerCase()
        .trim()
        // Reemplazar números que parecen letras
        .replace(/0/g, 'o')
        .replace(/1/g, 'i')
        .replace(/3/g, 'e')
        .replace(/4/g, 'a')
        .replace(/5/g, 's')
        .replace(/7/g, 't')
        .replace(/8/g, 'b')
        .replace(/\$/g, 's')
        .replace(/@/g, 'a')
        // Eliminar caracteres especiales
        .replace(/[._\-\s]/g, '')
        // Eliminar caracteres repetidos excesivos
        .replace(/(.)\1{2,}/g, '$1$1');
};

/**
 * Verificar si contiene palabras prohibidas
 */
const containsForbiddenWord = (username) => {
    const normalized = normalizeUsername(username);
    
    for (const word of ALL_RESERVED) {
        // Verificar si contiene la palabra
        if (normalized.includes(normalizeUsername(word))) {
            return { forbidden: true, word, reason: 'reserved' };
        }
    }
    
    return { forbidden: false };
};

/**
 * Verificar patrones sospechosos
 */
const hasSuspiciousPattern = (username) => {
    const patterns = [
        // Admin con variaciones
        /a+d+m+[i1l]+n+/i,
        /a+d+m+[i1l]+n+[i1l]+s+t+r+/i,
        
        // Moderator
        /m+[o0]+d+[e3]+r+/i,
        
        // Official/Verified
        /[o0]+f+[i1l]+c+[i1l]+a+l+/i,
        /v+[e3]+r+[i1l]+f+[i1l]+[e3]+d+/i,
        
        // System/Support
        /s+[iy]+s+t+[e3]+m+/i,
        /s+[u]+p+[o0]+r+t+/i,
        
        // Staff
        /s+t+a+f+f+/i,
        
        // Patrones de phishing
        /.*log+[i1]+n.*/i,
        /.*p+a+s+s+w+[o0]+r+d+.*/i,
        /.*s+[e3]+c+u+r+[i1]+t+.*/i,
        
        // Patrones ofensivos (simplificados)
        /n+[i1]+g+g+/i,
        /f+[ua]+c+k+/i,
        
        // Solo números o símbolos
        /^[\d_.\-]+$/,
        
        // Repetición excesiva
        /(.)\1{4,}/,
        
        // Caracteres unicode sospechosos (homoglyphs)
        /[\u0400-\u04FF]/,  // Cirílico
        /[\u0370-\u03FF]/,  // Griego
    ];
    
    for (const pattern of patterns) {
        if (pattern.test(username)) {
            return { suspicious: true, pattern: pattern.toString() };
        }
    }
    
    return { suspicious: false };
};

/**
 * Validación completa de username
 */
const validateUsername = (username) => {
    const errors = [];
    
    // 1. Verificar que existe
    if (!username || typeof username !== 'string') {
        return { 
            valid: false, 
            errors: ['El nombre de usuario es requerido'] 
        };
    }
    
    const trimmed = username.trim();
    
    // 2. Longitud
    if (trimmed.length < 3) {
        errors.push('Mínimo 3 caracteres');
    }
    if (trimmed.length > 15) {
        errors.push('Máximo 15 caracteres');
    }
    
    // 3. Caracteres permitidos
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
        errors.push('Solo letras, números y guion bajo (_)');
    }
    
    // 4. Debe empezar con letra
    if (!/^[a-zA-Z]/.test(trimmed)) {
        errors.push('Debe comenzar con una letra');
    }
    
    // 5. No puede terminar con guion bajo
    if (trimmed.endsWith('_')) {
        errors.push('No puede terminar con guion bajo');
    }
    
    // 6. No múltiples guiones bajos seguidos
    if (/__/.test(trimmed)) {
        errors.push('No puede tener múltiples guiones bajos seguidos');
    }
    
    // 7. Verificar palabras prohibidas
    const forbiddenCheck = containsForbiddenWord(trimmed);
    if (forbiddenCheck.forbidden) {
        errors.push('Este nombre de usuario no está disponible');
    }
    
    // 8. Verificar patrones sospechosos
    const suspiciousCheck = hasSuspiciousPattern(trimmed);
    if (suspiciousCheck.suspicious) {
        errors.push('Este nombre de usuario no está permitido');
    }
    
    // 9. No puede ser solo números
    if (/^\d+$/.test(trimmed)) {
        errors.push('No puede ser solo números');
    }
    
    return {
        valid: errors.length === 0,
        errors,
        normalized: normalizeUsername(trimmed),
        original: trimmed
    };
};

/**
 * Verificar disponibilidad en DB
 */
const isUsernameAvailable = async (username, query, excludeUserId = null) => {
    const validation = validateUsername(username);
    
    if (!validation.valid) {
        return { available: false, errors: validation.errors };
    }
    
    // Verificar en DB (case insensitive)
    let sql = 'SELECT id FROM users WHERE LOWER(username) = LOWER($1)';
    const params = [validation.original];
    
    if (excludeUserId) {
        sql += ' AND id != $2';
        params.push(excludeUserId);
    }
    
    const result = await query(sql, params);
    
    if (result.rows.length > 0) {
        return { 
            available: false, 
            errors: ['Este nombre de usuario ya está en uso'] 
        };
    }
    
    return { available: true, username: validation.original };
};

module.exports = {
    normalizeUsername,
    containsForbiddenWord,
    hasSuspiciousPattern,
    validateUsername,
    isUsernameAvailable
};