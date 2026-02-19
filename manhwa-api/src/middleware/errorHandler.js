const errorHandler = (err, req, res, next) => {
    // Log detallado del error (solo server-side, nunca al cliente)
    console.error('Error:', {
        message: err.message,
        code: err.code,
        detail: err.detail,
        constraint: err.constraint,
        table: err.table,
        column: err.column,
        path: req.path,
        method: req.method
    });

    // Error de validación de express-validator
    if (err.array && typeof err.array === 'function') {
        return res.status(400).json({
            success: false,
            message: 'Error de validación',
            errors: err.array()
        });
    }

    // Error de PostgreSQL
    if (err.code) {
        switch (err.code) {
            case '23505': { // Unique violation
                let friendlyMessage = 'Ya existe un registro con estos datos';
                const constraint = err.constraint || '';

                if (constraint.includes('slug')) {
                    friendlyMessage = 'Ya existe una serie con ese identificador (slug)';
                } else if (constraint.includes('title')) {
                    friendlyMessage = 'Ya existe una serie con ese título';
                } else if (constraint.includes('email')) {
                    friendlyMessage = 'Ya existe un usuario con ese email';
                } else if (constraint.includes('username')) {
                    friendlyMessage = 'Ya existe un usuario con ese nombre de usuario';
                }

                return res.status(409).json({
                    success: false,
                    message: friendlyMessage
                });
            }

            case '23503': // Foreign key violation
                return res.status(400).json({
                    success: false,
                    message: 'Referencia a un registro inexistente. Verifica que los datos relacionados existan.'
                });

            case '23502': // Not null violation
                return res.status(400).json({
                    success: false,
                    message: 'Un campo requerido no fue proporcionado'
                });

            case '22P02': // Invalid text representation
                return res.status(400).json({
                    success: false,
                    message: 'Formato de datos inválido. Verifica que los valores enviados sean correctos.'
                });

            case '22001': // String data right truncation
                return res.status(400).json({
                    success: false,
                    message: 'Uno de los campos excede la longitud máxima permitida'
                });

            case '42703': // Undefined column
                return res.status(500).json({
                    success: false,
                    message: 'Error de configuración del servidor'
                });

            default:
                console.error('Error PostgreSQL no manejado:', err.code, err.message);
        }
    }

    // Error de Multer (upload)
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
            success: false,
            message: 'El archivo es demasiado grande. Máximo permitido: 10MB'
        });
    }

    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
            success: false,
            message: 'Campo de archivo inesperado'
        });
    }

    // Error de Sharp (procesamiento de imagen)
    if (err.message && err.message.includes('sharp')) {
        return res.status(400).json({
            success: false,
            message: 'Error al procesar la imagen. Verifica que el formato sea válido (JPG, PNG, WebP, GIF)'
        });
    }

    // Error personalizado con status
    if (err.statusCode) {
        return res.status(err.statusCode).json({
            success: false,
            message: err.message
        });
    }

    // Error genérico — nunca exponer detalles internos en producción
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

    res.status(statusCode).json({
        success: false,
        message: process.env.NODE_ENV === 'production'
            ? 'Error interno del servidor'
            : err.message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
};

module.exports = errorHandler;
