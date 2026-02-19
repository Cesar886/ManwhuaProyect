/**
 * Middleware para rutas no encontradas
 */

const notFound = (req, res, next) => {
    res.status(404).json({
        success: false,
        message: 'Ruta no encontrada'
    });
};

module.exports = notFound;
