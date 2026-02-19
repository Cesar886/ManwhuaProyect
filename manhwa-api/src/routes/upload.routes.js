const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/upload.controller');
const uploadToSpaces = require('../middleware/uploadToSpaces');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

/**
 * Rutas de subida de archivos a Digital Ocean Spaces
 * Todas las rutas requieren autenticación.
 * DELETE requiere permisos de admin o moderador preferiblemente (ajustar según necesidad).
 */

// Subida general
router.post('/image', 
    authenticate, 
    uploadToSpaces('image'), 
    uploadController.uploadImage
);

// Subida de Avatar (Circular 256x256)
router.post('/avatar', 
    authenticate, 
    uploadToSpaces('avatar'), 
    uploadController.uploadAvatar
);

// Subida de Portada de Serie
router.post('/cover', 
    authenticate, 
    // authorize('admin', 'editor'), // Descomentar si se requiere rol específico
    uploadToSpaces('cover'), 
    uploadController.uploadCover
);

// Subida de Capítulos (Múltiples imágenes)
router.post('/chapter', 
    authenticate, 
    // authorize('admin', 'editor'),
    uploadToSpaces('chapter'), 
    uploadController.uploadChapter
);

// Borrar imagen
// Nota: La key debe ser enviada con encodeURIComponent si contiene slashes
router.delete('/:key', 
    authenticate, 
    uploadController.deleteImage
);

module.exports = router;
