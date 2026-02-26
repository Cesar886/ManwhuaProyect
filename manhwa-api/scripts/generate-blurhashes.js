#!/usr/bin/env node
/**
 * Generador de BlurHash para capítulos de manhwa
 *
 * Uso:
 *   node generate-blurhashes.js <slug> <capInicio> [capFin]
 *
 * Ejemplos:
 *   node generate-blurhashes.js solo-leveling 1 50
 *   node generate-blurhashes.js tower-of-god 10
 */

const { encode } = require('blurhash');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SPACES_URL = process.env.DO_SPACES_URL || process.env.NEXT_PUBLIC_DO_SPACES_URL;
if (!SPACES_URL) {
  console.error('Error: DO_SPACES_URL o NEXT_PUBLIC_DO_SPACES_URL no está definida');
  process.exit(1);
}

const THUMB_SIZE = 32;
const BLURHASH_X = 4;
const BLURHASH_Y = 3;

async function fetchImage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function generateBlurhash(imageBuffer) {
  const { data, info } = await sharp(imageBuffer)
    .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const hash = encode(
    new Uint8ClampedArray(data),
    info.width,
    info.height,
    BLURHASH_X,
    BLURHASH_Y
  );

  return hash;
}

async function getOriginalDimensions(imageBuffer) {
  const metadata = await sharp(imageBuffer).metadata();
  return { w: metadata.width, h: metadata.height };
}

async function processChapter(slug, chapterNum) {
  const paddedChapter = String(chapterNum).padStart(4, '0');
  const baseUrl = `${SPACES_URL}/${slug}/cap-${paddedChapter}`;
  const imagesJsonUrl = `${baseUrl}/images.json`;
  const metaJsonUrl = `${baseUrl}/images-meta.json`;

  // Verificar si ya existe images-meta.json
  try {
    const existsRes = await fetch(metaJsonUrl, { method: 'HEAD' });
    if (existsRes.ok) {
      console.log(`  ⏭  Cap ${chapterNum}: images-meta.json ya existe, saltando`);
      return true;
    }
  } catch {
    // No existe, continuar
  }

  // Descargar images.json
  let imageUrls;
  try {
    const res = await fetch(imagesJsonUrl);
    if (!res.ok) {
      console.log(`  ⚠  Cap ${chapterNum}: images.json no encontrado (${res.status})`);
      return false;
    }
    imageUrls = await res.json();
  } catch (err) {
    console.log(`  ⚠  Cap ${chapterNum}: Error descargando images.json — ${err.message}`);
    return false;
  }

  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    console.log(`  ⚠  Cap ${chapterNum}: images.json vacío o inválido`);
    return false;
  }

  console.log(`  📖 Cap ${chapterNum}: ${imageUrls.length} imágenes`);
  const meta = [];

  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i];
    try {
      const buffer = await fetchImage(url);
      const [blurhash, dims] = await Promise.all([
        generateBlurhash(buffer),
        getOriginalDimensions(buffer),
      ]);
      meta.push({ url, blurhash, w: dims.w, h: dims.h });
      process.stdout.write(`    ✓ ${i + 1}/${imageUrls.length}\r`);
    } catch (err) {
      console.log(`    ✗ Imagen ${i + 1}: ${err.message}`);
      meta.push({ url, blurhash: null, w: null, h: null });
    }
  }

  console.log(); // Salto de línea después del progreso

  // Guardar images-meta.json localmente (para subir luego)
  const outDir = path.join(__dirname, '..', 'blurhash-output', slug, `cap-${paddedChapter}`);
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'images-meta.json');
  fs.writeFileSync(outPath, JSON.stringify(meta, null, 2));
  console.log(`  💾 Guardado: ${outPath}`);

  return true;
}

async function main() {
  const [, , slug, startStr, endStr] = process.argv;

  if (!slug || !startStr) {
    console.log('Uso: node generate-blurhashes.js <slug> <capInicio> [capFin]');
    process.exit(1);
  }

  const start = parseInt(startStr, 10);
  const end = endStr ? parseInt(endStr, 10) : start;

  console.log(`\n🔵 Generando blurhashes para "${slug}" — capítulos ${start}–${end}\n`);

  let success = 0;
  let failed = 0;

  for (let ch = start; ch <= end; ch++) {
    const ok = await processChapter(slug, ch);
    if (ok) success++;
    else failed++;
  }

  console.log(`\n✅ Completado: ${success} exitosos, ${failed} fallidos\n`);
}

main().catch((err) => {
  console.error('Error fatal:', err);
  process.exit(1);
});
