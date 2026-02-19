const multer = require('multer');
const sharp = require('sharp');
const { uploadFile, generateFileName } = require('../config/spaces');

// Magic bytes para validación real del tipo de archivo
const MAGIC_BYTES = {
    jpeg: [0xFF, 0xD8, 0xFF],
    png:  [0x89, 0x50, 0x4E, 0x47],
    gif:  [0x47, 0x49, 0x46, 0x38],
    webp: [0x52, 0x49, 0x46, 0x46], // RIFF header
};

/**
 * Valida que el buffer sea realmente una imagen basándose en magic bytes.
 * No confía solo en el MIME type (spoofable).
 */
const isValidImageBuffer = (buffer) => {
    if (!buffer || buffer.length < 12) return false;
    return Object.values(MAGIC_BYTES).some(magic =>
        magic.every((byte, i) => buffer[i] === byte)
    );
};

// Configuración de almacenamiento en memoria
const storage = multer.memoryStorage();

// Filtro para validar imágenes (MIME check - primera capa)
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Formato de archivo no soportado. Sube solo imágenes.'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // Límite de 10MB
    }
});

/**
 * Middleware Factory para procesar subidas a Spaces
 * @param {string} type - Tipo de subida: 'avatar', 'cover', 'chapter', 'image'
 */
const uploadToSpaces = (type) => {
    return [
        // 1. Multer Middleware
        (req, res, next) => {
            if (type === 'chapter') {
                return upload.array('images', 60)(req, res, next);
            }
            return upload.single('image')(req, res, next);
        },
        
        // 2. Processing Middleware
        async (req, res, next) => {
            try {
                // Verificar si hay archivos
                if (type === 'chapter') {
                    if (!req.files || req.files.length === 0) return next();
                } else {
                    if (!req.file) return next();
                }

                const processFile = async (file, customName = null) => {
                    // Validación de magic bytes (segunda capa - anti spoofing)
                    if (!isValidImageBuffer(file.buffer)) {
                        throw Object.assign(
                            new Error('El archivo no es una imagen válida'),
                            { statusCode: 400 }
                        );
                    }

                    let pipeline = sharp(file.buffer);
                    let folder = 'others';

                    console.log(`🖼️ Procesando imagen: ${file.originalname} (${(file.size / 1024).toFixed(2)} KB)`);

                    switch (type) {
                        case 'avatar':
                            folder = 'avatars';
                            // Redimensionar a 256x256 circular (simulado con resize, el recorte circular es CSS)
                            // Pero sharp puede hacer composite si se requiere, aunque por ahora solo resize
                            pipeline = pipeline.resize(256, 256, { fit: 'cover' });
                            break;
                            
                        case 'cover':
                            folder = 'manhwa/covers';
                            // Portada optimizada - máximo 800px de ancho
                            pipeline = pipeline.resize({ width: 800, withoutEnlargement: true });
                            console.log(`📐 Tipo: Portada - Redimensionando a máx 800px de ancho`);
                            break;
                            
                        case 'chapter':
                            folder = 'manhwa/chapters';
                            // Optimizar ancho para lectura, mantener aspect ratio
                            pipeline = pipeline.resize({ width: 1200, withoutEnlargement: true });
                            break;
                            
                        default:
                            folder = 'uploads';
                            // Límite razonable para imágenes generales
                            pipeline = pipeline.resize({ width: 1920, withoutEnlargement: true });
                    }

                    // Convertir a WebP con calidad 85% (óptimo para portadas y capítulos)
                    const webpQuality = type === 'cover' ? 85 : 80;
                    const buffer = await pipeline
                        .webp({ quality: webpQuality, effort: 6 })
                        .toBuffer();

                    const webpSizeKB = (buffer.length / 1024).toFixed(2);
                    console.log(`✅ Convertido a WebP: ${webpSizeKB} KB (calidad: ${webpQuality}%)`);

                    const fileName = generateFileName(folder, customName || 'image.webp');
                    const publicUrl = await uploadFile(buffer, fileName, 'image/webp');
                    
                    console.log(`☁️ Subido a Spaces: ${publicUrl}`);
                    console.log(`🔑 Key: ${fileName}`);
                    
                    return {
                        originalName: file.originalname,
                        url: publicUrl,
                        key: fileName
                    };
                };

                // Procesamiento según tipo
                if (type === 'chapter') {
                    // Procesar múltiples archivos en paralelo
                    const promises = req.files.map(file => processFile(file));
                    const results = await Promise.all(promises);
                    // Colocar resultados en req.filesUrls para el controlador
                    req.filesUrls = results.map(r => r.url);
                    req.filesKeys = results.map(r => r.key);
                } else {
                    // Procesar archivo único
                    const result = await processFile(req.file);
                    req.fileUrl = result.url;
                    req.fileKey = result.key;
                }

                next();
            } catch (error) {
                console.error('Error procesando imagen para Spaces:', error);
                next(error);
            }
        }
    ];
};

module.exports = uploadToSpaces;
