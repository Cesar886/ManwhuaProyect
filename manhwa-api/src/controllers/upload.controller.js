const { deleteFile } = require('../config/spaces');

/**
 * POST /api/upload/image
 * Subida general de imágenes
 */
exports.uploadImage = (req, res) => {
    if (!req.fileUrl) {
        return res.status(400).json({ 
            success: false, 
            message: 'No se ha proporcionado ninguna imagen o hubo un error al procesarla.' 
        });
    }

    res.status(200).json({
        success: true,
        message: 'Imagen subida correctamente',
        url: req.fileUrl,
        key: req.fileKey
    });
};

/**
 * POST /api/upload/avatar
 * Subida de avatar de usuario (256x256)
 */
exports.uploadAvatar = (req, res) => {
    if (!req.fileUrl) {
        return res.status(400).json({ 
            success: false, 
            message: 'No se ha podido subir el avatar.' 
        });
    }

    res.status(200).json({
        success: true,
        message: 'Avatar actualizado correctamente',
        url: req.fileUrl,
        key: req.fileKey
    });
};

/**
 * POST /api/upload/cover
 * Subida de portada de serie
 */
exports.uploadCover = (req, res) => {
    if (!req.fileUrl) {
        return res.status(400).json({ 
            success: false, 
            message: 'Error al subir la portada.' 
        });
    }

    res.status(200).json({
        success: true,
        message: 'Portada subida con éxito',
        url: req.fileUrl,
        key: req.fileKey
    });
};

/**
 * POST /api/upload/chapter
 * Subida de imágenes de capítulo (múltiples)
 */
exports.uploadChapter = (req, res) => {
    if (!req.filesUrls || req.filesUrls.length === 0) {
        return res.status(400).json({ 
            success: false, 
            message: 'No se han subido imágenes para el capítulo.' 
        });
    }

    res.status(200).json({
        success: true,
        message: `${req.filesUrls.length} imágenes subidas correctamente`,
        urls: req.filesUrls,
        keys: req.filesKeys
    });
};

/**
 * DELETE /api/upload/:key
 * Eliminar imagen de Spaces
 * La key puede ser pasada como parámetro codificado o parte de la URL
 */
exports.deleteImage = async (req, res) => {
    try {
        const { key } = req.params;
        
        if (!key) {
            return res.status(400).json({ 
                success: false, 
                message: 'Se requiere la clave (key) del archivo para eliminarlo.' 
            });
        }

        // Decodificar la key por si viene con caracteres especiales de URL
        const decodedKey = decodeURIComponent(key);
        
        await deleteFile(decodedKey);

        res.status(200).json({
            success: true,
            message: 'Imagen eliminada correctamente del servidor'
        });
    } catch (error) {
        console.error('Error en deleteImage:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error interno al intentar eliminar la imagen.' 
        });
    }
};
