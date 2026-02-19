/**
 * Validadores reutilizables para express-validator
 * Sanitizan y validan parámetros comunes (paginación, IDs, slugs, búsquedas)
 */

const { query: queryValidator, param, body } = require('express-validator');

// ============================================
// PAGINACIÓN
// ============================================
const paginationValidation = [
    queryValidator('page')
        .optional()
        .isInt({ min: 1, max: 10000 })
        .withMessage('Página debe ser un número entre 1 y 10000')
        .toInt(),
    queryValidator('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Límite debe ser un número entre 1 y 100')
        .toInt(),
];

// ============================================
// ORDENAMIENTO
// ============================================
const sortValidation = (allowedFields = ['created_at']) => [
    queryValidator('sort')
        .optional()
        .isIn(allowedFields)
        .withMessage(`Ordenar por debe ser uno de: ${allowedFields.join(', ')}`),
    queryValidator('order')
        .optional()
        .isIn(['asc', 'desc'])
        .withMessage('Orden debe ser asc o desc'),
];

// ============================================
// PARÁMETROS DE URL
// ============================================
const slugParam = [
    param('slug')
        .trim()
        .notEmpty()
        .withMessage('Slug requerido')
        .matches(/^[a-z0-9-]+$/)
        .withMessage('Slug contiene caracteres inválidos')
        .isLength({ max: 300 })
        .withMessage('Slug demasiado largo'),
];

const idParam = (paramName = 'id') => [
    param(paramName)
        .notEmpty()
        .withMessage(`${paramName} requerido`)
        .isInt({ min: 1 })
        .withMessage(`${paramName} debe ser un número entero positivo`)
        .toInt(),
];

const seriesIdParam = idParam('seriesId');

// ============================================
// BÚSQUEDA
// ============================================
const searchQueryValidation = [
    queryValidator('q')
        .optional()
        .trim()
        .isLength({ min: 1, max: 200 })
        .withMessage('Búsqueda debe tener entre 1 y 200 caracteres')
        .escape(),
    queryValidator('search')
        .optional()
        .trim()
        .isLength({ min: 1, max: 200 })
        .withMessage('Búsqueda debe tener entre 1 y 200 caracteres')
        .escape(),
];

// ============================================
// CHAPTER NUMBER
// ============================================
const chapterNumParam = [
    param('chapterNum')
        .notEmpty()
        .withMessage('Número de capítulo requerido')
        .matches(/^\d+(\.\d+)?$/)
        .withMessage('Número de capítulo inválido'),
];

module.exports = {
    paginationValidation,
    sortValidation,
    slugParam,
    idParam,
    seriesIdParam,
    searchQueryValidation,
    chapterNumParam,
};
