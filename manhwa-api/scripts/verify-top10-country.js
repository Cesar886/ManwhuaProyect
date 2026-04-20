#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

// Carga .env local de manhwa-api si existe.
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

const DEFAULT_BASE_URL = 'http://localhost:3000';
const baseUrl = String(process.env.TOP10_BASE_URL || process.env.API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
const endpoint = process.env.TOP10_ENDPOINT || `${baseUrl}/api/series/top10-by-country`;
const requestTimeoutMs = Math.max(1000, parseInt(process.env.TOP10_TIMEOUT_MS || '12000', 10));
const apiKey = process.env.TOP10_API_KEY || process.env.INTERNAL_API_KEY || '';
const lang = process.env.TOP10_LANG || 'es';
const adult = process.env.TOP10_ADULT === 'true' ? 'true' : 'false';
const countries = String(process.env.TOP10_COUNTRIES || 'MX,AR,CL,CO')
  .split(',')
  .map((c) => c.trim().toUpperCase())
  .filter((c) => /^[A-Z]{2}$/.test(c));

if (countries.length < 2) {
  console.error('TOP10_COUNTRIES debe contener al menos 2 paises ISO alpha-2 (ej: MX,AR).');
  process.exit(1);
}

function buildUrl(country) {
  const url = new URL(endpoint);
  url.searchParams.set('lang', lang);
  url.searchParams.set('adult', adult);
  if (country) url.searchParams.set('country', country);
  return url.toString();
}

function getSlugList(payload) {
  const rows = Array.isArray(payload?.data?.series) ? payload.data.series : [];
  return rows.map((r) => String(r?.slug || '').trim()).filter(Boolean);
}

function equalLists(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function overlapCount(a, b) {
  const setB = new Set(b);
  let count = 0;
  for (const x of a) {
    if (setB.has(x)) count++;
  }
  return count;
}

function formatFetchError(err, url) {
  const cause = err?.cause || {};
  const code = cause?.code || err?.code || 'UNKNOWN';

  if (code === 'ECONNREFUSED') {
    return `No se pudo conectar a ${url} (ECONNREFUSED). ` +
      `La API probablemente no esta corriendo en ese host/puerto.`;
  }

  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return `No se pudo resolver el host de ${url} (${code}). Revisa TOP10_BASE_URL/TOP10_ENDPOINT.`;
  }

  if (code === 'UND_ERR_CONNECT_TIMEOUT' || err?.name === 'AbortError') {
    return `Timeout conectando a ${url}. Ajusta TOP10_TIMEOUT_MS o revisa conectividad.`;
  }

  return `Fallo de red al conectar con ${url}: ${err?.message || 'error desconocido'}${code ? ` [${code}]` : ''}`;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function preflightHealthCheck() {
  const healthUrl = `${baseUrl}/api/health`;
  const headers = {
    Accept: 'application/json',
    'User-Agent': 'top10-country-verifier/1.0',
  };
  if (apiKey) headers['x-api-key'] = apiKey;

  try {
    const res = await fetchWithTimeout(healthUrl, { headers });
    if (!res.ok) {
      throw new Error(`Healthcheck HTTP ${res.status}`);
    }
    return true;
  } catch (err) {
    const detail = formatFetchError(err, healthUrl);
    throw new Error(
      `${detail}\n` +
      `Sugerencias:\n` +
      `1) Inicia manhwa-api local (npm run dev o npm start).\n` +
      `2) Si pruebas contra servidor remoto, exporta TOP10_BASE_URL (ej: https://tu-dominio).\n` +
      `3) Verifica firewall/puerto y que INTERNAL_API_KEY sea valida.`
    );
  }
}

async function fetchTop10(country) {
  const url = buildUrl(country);
  const headers = {
    Accept: 'application/json',
    'X-Lang': lang,
    'User-Agent': 'top10-country-verifier/1.0',
  };

  if (apiKey) headers['x-api-key'] = apiKey;

  const startedAt = Date.now();
  let res;
  try {
    res = await fetchWithTimeout(url, { headers });
  } catch (err) {
    throw new Error(`[${country || 'GLOBAL'}] ${formatFetchError(err, url)}`);
  }
  const ms = Date.now() - startedAt;

  const rawText = await res.text();
  let body = null;
  try {
    body = JSON.parse(rawText);
  } catch {
    // noop
  }

  if (!res.ok) {
    const snippet = rawText.slice(0, 300).replace(/\s+/g, ' ');
    throw new Error(`[${country || 'GLOBAL'}] HTTP ${res.status} (${ms}ms): ${snippet}`);
  }

  if (!body || body.success !== true) {
    throw new Error(`[${country || 'GLOBAL'}] Respuesta inesperada (${ms}ms): ${rawText.slice(0, 300)}`);
  }

  const slugs = getSlugList(body);

  return {
    country: country || 'GLOBAL',
    ms,
    usedGlobalFallback: Boolean(body?.data?.usedGlobalFallback),
    resolvedFrom: body?.data?.resolvedFrom ?? null,
    detectedCountry: body?.data?.country ?? null,
    window: body?.data?.window ?? null,
    xCache: res.headers.get('x-cache') || null,
    slugs,
  };
}

async function main() {
  console.log('=== Verificacion Top10 por pais ===');
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Lang: ${lang} | Adult: ${adult}`);
  console.log(`Paises: ${countries.join(', ')}`);
  console.log(`Timeout: ${requestTimeoutMs}ms`);
  console.log(`API key: ${apiKey ? 'SI' : 'NO (solo funcionara si endpoint permite UA crawler/JWT)'}`);
  console.log('');

  await preflightHealthCheck();

  const results = [];

  // Incluye global para referencia.
  results.push(await fetchTop10(null));

  for (const cc of countries) {
    results.push(await fetchTop10(cc));
  }

  for (const r of results) {
    console.log(`- ${r.country}: rows=${r.slugs.length} fallback=${r.usedGlobalFallback} x-cache=${r.xCache || 'n/a'} ms=${r.ms}`);
    console.log(`  resolvedFrom=${r.resolvedFrom || 'n/a'} detectedCountry=${r.detectedCountry || 'n/a'} window=${r.window || 'n/a'}`);
    console.log(`  top=${r.slugs.slice(0, 10).join(', ') || '(vacio)'}`);
  }

  console.log('');
  console.log('=== Comparaciones pairwise ===');

  let allCountryListsEqual = true;
  const countryOnly = results.filter((r) => r.country !== 'GLOBAL');

  for (let i = 0; i < countryOnly.length; i++) {
    for (let j = i + 1; j < countryOnly.length; j++) {
      const a = countryOnly[i];
      const b = countryOnly[j];
      const eq = equalLists(a.slugs, b.slugs);
      const ov = overlapCount(a.slugs, b.slugs);
      if (!eq) allCountryListsEqual = false;
      console.log(`- ${a.country} vs ${b.country}: equal=${eq} overlap=${ov}/${Math.max(a.slugs.length, b.slugs.length)}`);
    }
  }

  const countriesUsingFallback = countryOnly.filter((r) => r.usedGlobalFallback).map((r) => r.country);

  console.log('');
  if (allCountryListsEqual) {
    console.log('RESULTADO: TODAS las listas por pais son iguales.');
    if (countriesUsingFallback.length > 0) {
      console.log(`Motivo probable: fallback global activo en ${countriesUsingFallback.join(', ')}.`);
    }
    process.exitCode = 2;
    return;
  }

  console.log('RESULTADO: Las listas por pais YA divergen (comportamiento esperado).');
  if (countriesUsingFallback.length > 0) {
    console.log(`Aviso: aun hay fallback global en ${countriesUsingFallback.join(', ')}.`);
  }
}

main().catch((err) => {
  console.error('Error ejecutando verificacion:', err.message);
  process.exit(1);
});
