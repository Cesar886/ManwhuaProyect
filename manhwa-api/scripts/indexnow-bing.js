/**
 * IndexNow para Bing - Envía todas las URLs del sitio
 * Uso: node scripts/indexnow-bing.js [all|series|recent]
 *
 * all    → estáticas + series + capítulos  (default)
 * series → estáticas + series (sin capítulos)
 * recent → solo series actualizadas en últimos 14 días
 */

require('dotenv').config();

const API_BASE = process.env.NEXT_PUBLIC_API_URL_LOCAL || 'http://localhost:3000/api';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://manhwaimperial.site';
const INDEXNOW_KEY = 'f2cdd862b4624457846d2d3e59f308a8';
const INDEXNOW_API = 'https://api.indexnow.org/IndexNow';
const BATCH_SIZE = 10000;
const RECENT_DAYS = 14;

const mode = process.argv[2] || 'all';

const STATIC_PAGES = ['/', '/home', '/populares', '/colecciones', '/biblioteca', '/pedidos'];

async function fetchSeries() {
  const res = await fetch(`${API_BASE}/spaces/manhwas`, {
    headers: { 'x-api-key': process.env.INTERNAL_API_KEY || '' }
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const json = await res.json();
  return json.data?.series || json.series || [];
}

async function submitBatch(urls, batchNum) {
  const res = await fetch(INDEXNOW_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: new URL(SITE_URL).hostname,
      key: INDEXNOW_KEY,
      keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
      urlList: urls
    })
  });
  return res.status;
}

(async () => {
  console.log(`\n🚀 IndexNow Bing — modo: ${mode}`);
  console.log(`   API: ${API_BASE}`);
  console.log(`   Sitio: ${SITE_URL}\n`);

  const staticUrls = STATIC_PAGES.map(p => `${SITE_URL}${p}`);
  let seriesUrls = [];
  let chapterUrls = [];

  if (mode !== 'static') {
    process.stdout.write('📡 Obteniendo series desde API...');
    const series = await fetchSeries();
    console.log(` ${series.length} series`);

    const recentCutoff = Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000;

    const filtered = series.filter(s => {
      if (mode === 'recent') {
        const t = new Date(s.lastUpdated || s.updatedAt || 0).getTime();
        return t >= recentCutoff;
      }
      return true;
    });

    seriesUrls = filtered.map(s => `${SITE_URL}/manhwa/${s.slug}`);

    if (mode === 'all') {
      process.stdout.write('📚 Generando URLs de capítulos...');
      for (const s of filtered) {
        const count = s.chapterCount || 0;
        for (let n = count; n >= 1; n--) {
          chapterUrls.push(`${SITE_URL}/manhwa/${s.slug}/capitulo/${n}`);
        }
      }
      console.log(` ${chapterUrls.length} capítulos`);
    }
  }

  const allUrls = [...staticUrls, ...seriesUrls, ...chapterUrls];
  console.log(`\n📊 Total URLs a enviar: ${allUrls.length}`);
  console.log(`   • Estáticas: ${staticUrls.length}`);
  console.log(`   • Series:    ${seriesUrls.length}`);
  console.log(`   • Capítulos: ${chapterUrls.length}`);
  console.log(`   • Lotes:     ${Math.ceil(allUrls.length / BATCH_SIZE)}\n`);

  const results = [];
  for (let i = 0; i < allUrls.length; i += BATCH_SIZE) {
    const batch = allUrls.slice(i, i + BATCH_SIZE);
    const num = Math.floor(i / BATCH_SIZE) + 1;
    process.stdout.write(`📤 Enviando lote ${num} (${batch.length} URLs)...`);
    const status = await submitBatch(batch, num);
    const ok = status === 200 || status === 202;
    console.log(` HTTP ${status} ${ok ? '✅' : '❌'}`);
    results.push({ lote: num, urls: batch.length, status, ok });
  }

  const totalOk = results.filter(r => r.ok).reduce((s, r) => s + r.urls, 0);
  const allOk = results.every(r => r.ok);

  console.log('\n' + '─'.repeat(50));
  console.log(allOk ? '✅ COMPLETADO' : '⚠️  COMPLETADO CON ERRORES');
  console.log(`   URLs enviadas: ${totalOk} / ${allUrls.length}`);
  console.log('─'.repeat(50) + '\n');

  process.exit(allOk ? 0 : 1);
})().catch(err => {
  console.error('\n❌ Error fatal:', err.message);
  process.exit(1);
});
