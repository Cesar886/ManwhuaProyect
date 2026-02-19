/**
 * Middleware de validación
 */

const { validationResult } = require('express-validator');

/**
 * Ejecutar validaciones y retornar errores si los hay
 */
const validate = (validations) => {
    return async (req, res, next) => {
        // Ejecutar todas las validaciones
        await Promise.all(validations.map(validation => validation.run(req)));
        
        // Verificar si hay errores
        const errors = validationResult(req);
        
        if (errors.isEmpty()) {
            return next();
        }
        
        // Formatear errores
        const formattedErrors = errors.array().map(err => ({
            field: err.path,
            message: err.msg,
            value: err.value
        }));
        
        return res.status(400).json({
            success: false,
            message: 'Error de validación',
            errors: formattedErrors
        });
    };
};

module.exports = { validate };
