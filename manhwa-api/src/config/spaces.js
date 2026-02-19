const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

// Configuración del cliente de Digital Ocean Spaces (compatible con S3)
const s3Client = new S3Client({
    endpoint: process.env.DO_SPACES_ENDPOINT, // Ej: https://sfo3.digitaloceanspaces.com
    region: process.env.DO_SPACES_REGION,     // Ej: sfo3
    credentials: {
        accessKeyId: process.env.DO_SPACES_KEY,
        secretAccessKey: process.env.DO_SPACES_SECRET
    }
});

/**
 * Genera un nombre de archivo único dentro de una estructura de carpetas
 * @param {string} folder - Carpeta destino (ej: 'manhwa', 'avatars', 'comments')
 * @param {string} originalName - Nombre original del archivo para preservar la extensión
 * @returns {string} - Ruta completa del archivo (Key) para usar en uploadFile
 */
const generateFileName = (folder, originalName) => {
    const ext = path.extname(originalName);
    const fileName = `${uuidv4()}${ext}`;
    // Limpiar slashes extra y asegurar formato carpeta/archivo
    const cleanFolder = folder.replace(/^\/+|\/+$/g, '');
    return `${cleanFolder}/${fileName}`;
};

/**
 * Sube un archivo a Digital Ocean Spaces
 * @param {Buffer} fileBuffer - Buffer del archivo
 * @param {string} fileName - Ruta/Nombre del archivo en el Space (Key)
 * @param {string} mimeType - Tipo MIME del archivo
 * @returns {Promise<string>} - URL pública del archivo subido
 */
const uploadFile = async (fileBuffer, fileName, mimeType) => {
    const bucketParams = {
        Bucket: process.env.DO_SPACES_BUCKET,
        Key: fileName,
        Body: fileBuffer,
        ACL: 'public-read', // Hace el archivo accesible públicamente
        ContentType: mimeType,
    };

    try {
        await s3Client.send(new PutObjectCommand(bucketParams));
        
        // Construir la URL pública
        // Opción 1: Usar el endpoint proporcionado si ya incluye el bucket (edge case)
        // Opción 2: Construcción estándar https://{bucket}.{region}.digitaloceanspaces.com/{key}
        // Para mayor consistencia con DO Spaces:
        const endpoint = process.env.DO_SPACES_ENDPOINT.replace('https://', '').replace('http://', '');
        
        // Si el endpoint configurado es solo la región (ej: sfo3.digitaloceanspaces.com)
        if (!endpoint.startsWith(process.env.DO_SPACES_BUCKET)) {
             return `https://${process.env.DO_SPACES_BUCKET}.${endpoint}/${fileName}`;
        }
        
        // Si el endpoint ya contiene el bucket o es un CDN personalizado
        return `https://${endpoint}/${fileName}`;

    } catch (err) {
        console.error('Error subiendo archivo a Spaces:', err);
        throw new Error('Error al subir imagen al servidor de almacenamiento');
    }
};

/**
 * Elimina un archivo de Digital Ocean Spaces
 * @param {string} fileUrlOrKey - URL completa o Key del archivo a eliminar
 * @returns {Promise<void>}
 */
const deleteFile = async (fileUrlOrKey) => {
    try {
        let key = fileUrlOrKey;

        // Si se pasa la URL completa, extraer la Key
        if (fileUrlOrKey.startsWith('http')) {
            const urlParts = fileUrlOrKey.split('/');
            // Asumiendo estructura estándar, la key empieza después del dominio
            // Esto puede variar si hay carpetas anidadas, una forma robusta es quitar el dominio
            // Considerando: https://bucket.region.digitaloceanspaces.com/carpeta/archivo.jpg
            // Key: carpeta/archivo.jpg
            
            // Buscar el bucket domain para eliminarlo
            const bucketDomain = `${process.env.DO_SPACES_BUCKET}.${process.env.DO_SPACES_ENDPOINT.replace(/^https?:\/\//, '')}`;
            const endpointDomain = process.env.DO_SPACES_ENDPOINT.replace(/^https?:\/\//, '');
            
            if (fileUrlOrKey.includes(bucketDomain)) {
                key = fileUrlOrKey.split(bucketDomain + '/')[1];
            } else if (fileUrlOrKey.includes(endpointDomain)) {
                // Caso donde el bucket es parte del path o endpoint custom
                // Si el endpoint es sfo3.digitaloceanspaces.com y url es bucket.sfo3... ya cubierto arriba
                // Si url es sfo3.../bucket/key (path style, menos común en DO público)
                 key = fileUrlOrKey.split(endpointDomain + '/')[1];
            } else {
                // Intento genérico: tomar todo después del tercer slash
                 const parts = fileUrlOrKey.split('/');
                 key = parts.slice(3).join('/');
            }
        }

        const bucketParams = {
            Bucket: process.env.DO_SPACES_BUCKET,
            Key: key,
        };

        await s3Client.send(new DeleteObjectCommand(bucketParams));
        logger.info(`Archivo eliminado de Spaces: ${key}`);
    } catch (err) {
        logger.error('Error eliminando archivo de Spaces:', err);
        // No lanzamos error para no detener procesos si el borrado falla (ej: archivo ya no existe)
    }
};

module.exports = {
    s3Client,
    uploadFile,
    deleteFile,
    generateFileName
};
