/**
 * Script para procesar y optimizar imágenes de manhwa
 * 
 * Características:
 * - Convierte a WebP con diferentes calidades
 * - Genera múltiples tamaños (responsive)
 * - Crea thumbnails tiny para blur-up
 * - Genera blurhash o color dominante
 * - Organiza en estructura de carpetas
 * 
 * Uso:
 *   node optimize-images.js <input-folder> <output-folder>
 * 
 * Ejemplo:
 *   node optimize-images.js ./uploads/raw ./uploads/optimized
 */

const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

// Configuración
const CONFIG = {
  formats: ['webp', 'jpg'], // Formatos de salida
  sizes: [
    { name: 'tiny', width: 32, quality: 50 },    // Para blur-up (base64)
    { name: 'thumb', width: 300, quality: 75 },  // Thumbnail
    { name: 'medium', width: 800, quality: 80 }, // Mobile/Tablet
    { name: 'large', width: 1200, quality: 85 }, // Desktop
    { name: 'xlarge', width: 1600, quality: 85 } // High-res
  ],
  jpgQuality: 85,
  webpQuality: 85,
  pngCompressionLevel: 9,
  preserveMetadata: false // Remover metadata para reducir tamaño
};

/**
 * Procesar una imagen
 */
async function processImage(inputPath, outputDir, filename) {
  console.log(`\n📸 Procesando: ${filename}`);
  
  try {
    // Leer metadata de la imagen
    const metadata = await sharp(inputPath).metadata();
    console.log(`  Tamaño original: ${metadata.width}x${metadata.height}`);
    console.log(`  Formato: ${metadata.format}`);

    const baseName = path.parse(filename).name;
    const results = {
      original: filename,
      sizes: {},
      metadata: {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        aspectRatio: (metadata.width / metadata.height).toFixed(2)
      }
    };

    // Generar color dominante
    const dominantColor = await getDominantColor(inputPath);
    results.dominantColor = dominantColor;

    // Procesar cada tamaño
    for (const size of CONFIG.sizes) {
      console.log(`  → Generando ${size.name} (${size.width}px)...`);
      
      const sizeResults = {};
      
      // Generar versión WebP
      const webpPath = path.join(outputDir, `${baseName}-${size.name}.webp`);
      await sharp(inputPath)
        .resize(size.width, null, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .webp({
          quality: size.quality,
          effort: 6 // Máxima compresión (0-6)
        })
        .toFile(webpPath);

      const webpStats = await fs.stat(webpPath);
      sizeResults.webp = {
        path: path.basename(webpPath),
        size: webpStats.size,
        sizeKB: (webpStats.size / 1024).toFixed(2)
      };

      // Generar versión JPG (fallback)
      const jpgPath = path.join(outputDir, `${baseName}-${size.name}.jpg`);
      await sharp(inputPath)
        .resize(size.width, null, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({
          quality: size.quality,
          mozjpeg: true // Usar mozjpeg para mejor compresión
        })
        .toFile(jpgPath);

      const jpgStats = await fs.stat(jpgPath);
      sizeResults.jpg = {
        path: path.basename(jpgPath),
        size: jpgStats.size,
        sizeKB: (jpgStats.size / 1024).toFixed(2)
      };

      // Para tiny, generar base64
      if (size.name === 'tiny') {
        const buffer = await sharp(inputPath)
          .resize(size.width, null)
          .blur(5) // Blur para efecto blur-up
          .webp({ quality: 30 })
          .toBuffer();
        
        results.tinyBase64 = `data:image/webp;base64,${buffer.toString('base64')}`;
      }

      results.sizes[size.name] = sizeResults;
      
      console.log(`    WebP: ${sizeResults.webp.sizeKB}KB`);
      console.log(`    JPG: ${sizeResults.jpg.sizeKB}KB`);
    }

    // Guardar metadata JSON
    const metadataPath = path.join(outputDir, `${baseName}.json`);
    await fs.writeFile(metadataPath, JSON.stringify(results, null, 2));
    console.log(`  ✅ Metadata guardada: ${baseName}.json`);

    return results;

  } catch (error) {
    console.error(`  ❌ Error procesando ${filename}:`, error.message);
    return null;
  }
}

/**
 * Obtener color dominante de la imagen
 */
async function getDominantColor(imagePath) {
  try {
    const { dominant } = await sharp(imagePath)
      .resize(100, 100, { fit: 'cover' })
      .stats();

    const { r, g, b } = dominant;
    return `rgb(${r}, ${g}, ${b})`;
  } catch (error) {
    console.error('Error obteniendo color dominante:', error);
    return 'rgb(26, 26, 46)';
  }
}

/**
 * Procesar carpeta completa
 */
async function processFolder(inputFolder, outputFolder) {
  console.log('🚀 Iniciando optimización de imágenes...\n');
  console.log(`📁 Input: ${inputFolder}`);
  console.log(`📁 Output: ${outputFolder}\n`);

  // Crear carpeta de salida si no existe
  await fs.mkdir(outputFolder, { recursive: true });

  // Leer archivos de la carpeta
  const files = await fs.readdir(inputFolder);
  const imageFiles = files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);
  });

  console.log(`📊 Encontradas ${imageFiles.length} imágenes\n`);

  if (imageFiles.length === 0) {
    console.log('❌ No se encontraron imágenes para procesar');
    return;
  }

  const results = [];
  let totalOriginalSize = 0;
  let totalOptimizedSize = 0;

  // Procesar cada imagen
  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i];
    const inputPath = path.join(inputFolder, file);
    
    console.log(`[${i + 1}/${imageFiles.length}]`);
    
    const originalStats = await fs.stat(inputPath);
    totalOriginalSize += originalStats.size;

    const result = await processImage(inputPath, outputFolder, file);
    
    if (result) {
      results.push(result);
      
      // Calcular tamaño optimizado (medium webp como referencia)
      const optimizedSize = result.sizes.medium?.webp?.size || 0;
      totalOptimizedSize += optimizedSize;
    }
  }

  // Generar reporte final
  console.log('\n' + '='.repeat(50));
  console.log('📊 REPORTE FINAL');
  console.log('='.repeat(50));
  console.log(`Imágenes procesadas: ${results.length}/${imageFiles.length}`);
  console.log(`Tamaño original total: ${(totalOriginalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Tamaño optimizado total: ${(totalOptimizedSize / 1024 / 1024).toFixed(2)} MB`);
  
  const savings = totalOriginalSize - totalOptimizedSize;
  const savingsPercent = ((savings / totalOriginalSize) * 100).toFixed(2);
  
  console.log(`Ahorro: ${(savings / 1024 / 1024).toFixed(2)} MB (${savingsPercent}%)`);
  console.log('='.repeat(50));

  // Guardar reporte completo
  const reportPath = path.join(outputFolder, '_optimization-report.json');
  await fs.writeFile(reportPath, JSON.stringify({
    date: new Date().toISOString(),
    totalImages: results.length,
    totalOriginalSizeMB: (totalOriginalSize / 1024 / 1024).toFixed(2),
    totalOptimizedSizeMB: (totalOptimizedSize / 1024 / 1024).toFixed(2),
    savingsMB: (savings / 1024 / 1024).toFixed(2),
    savingsPercent,
    images: results
  }, null, 2));

  console.log(`\n📄 Reporte guardado: ${reportPath}`);
}

/**
 * Procesar capítulo específico
 * Útil para integrar con el flujo de subida
 */
async function processChapter(chapterFolder, manhwaSlug, chapterNum) {
  const outputFolder = path.join(
    chapterFolder,
    '..',
    'optimized',
    manhwaSlug,
    `capitulo-${chapterNum}`
  );

  await processFolder(chapterFolder, outputFolder);
  return outputFolder;
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Uso: node optimize-images.js <input-folder> <output-folder>');
    console.log('Ejemplo: node optimize-images.js ./uploads/raw ./uploads/optimized');
    process.exit(1);
  }

  const [inputFolder, outputFolder] = args;

  processFolder(inputFolder, outputFolder)
    .then(() => {
      console.log('\n✅ Optimización completada!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error:', error);
      process.exit(1);
    });
}

module.exports = {
  processImage,
  processFolder,
  processChapter
};
