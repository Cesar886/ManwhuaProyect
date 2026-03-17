/**
 * IMPERIAL-AGENT v3: Prompts para Modulo 6 — Generador de Paginas
 *
 * 4 tipos: lista, obra, resena, guia
 * Contenido optimizado para SEO + GEO + interlinking
 */

const PROMPT_VERSION = '3.0.0'

function getSystemPrompt(tipoPagina) {
  return `Editor jefe de Manhwa Imperial. Creas el mejor contenido de manhwa en espanol.
Tu contenido cumple cuatro objetivos simultaneos:
1. SEO: rankear en Google y Bing con la query + keywords secundarias
2. GEO: ser citado por ChatGPT, Copilot, Gemini cuando alguien pregunte sobre manhwa
3. UX: genuinamente util para lectores hispanos
4. INTERLINKING: enlazar a minimo 3 paginas existentes del sitio

Principios GEO-first:
- "Respuesta rapida" (50 palabras) al inicio = lo que las IAs extraen como snippet
- FAQs con respuestas de 1-2 oraciones = alimentan directamente a ChatGPT/Copilot
- Datos concretos (anos, capitulos, puntuaciones) = verificables por IAs
- Afirmaciones con fuente cuando sea posible = aumenta confianza
- Estructura clara H2/H3 = facilita extraccion por crawlers de IAs

E-E-A-T:
- Experiencia: "en Manhwa Imperial hemos analizado mas de X obras del genero"
- Expertise: usar terminologia correcta del nicho sin explicar lo obvio
- Autoridad: citar fuentes reconocidas (MyAnimeList, AniList)
- Confianza: fecha de actualizacion, autor = "Manhwa Imperial"

IMPORTANTE: Todo el contenido en espanol. Natural, no traducido. Sin relleno.`
}

function getUserPromptLista(data) {
  return `Query principal: "${data.query}"
${data.secondary_keywords ? `Keywords secundarias: ${JSON.stringify(data.secondary_keywords)}` : ''}
Impresiones Google: ${data.g_imp || data.impressions || 0} | Impresiones Bing: ${data.b_imp || data.impressionsBing || 0}
Tipo de pagina: lista
${data.paginas_relacionadas ? `Paginas del sitio para enlazar: ${JSON.stringify(data.paginas_relacionadas)}` : ''}

Devuelve SOLO este JSON:
{
  "slug": "/listas/${data.query.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}",
  "meta_title": "string — max 60 chars, keyword cerca del inicio",
  "meta_description": "string — max 155 chars, verbo de accion, beneficio claro",
  "h1": "string con keyword principal",
  "respuesta_rapida": "string — 50 palabras directas que respondan la query sin rodeos",
  "introduccion": "string — 120 palabras con keyword + contexto del nicho",
  "obras": [
    {
      "nombre": "string",
      "genero": ["array"],
      "capitulos": 0,
      "estado": "en emision|finalizado",
      "ano_inicio": 2024,
      "descripcion": "string — 60 palabras, por que destaca",
      "puntuacion": 8.5,
      "para_quien": "string — perfil del lector ideal",
      "donde_leer": "string — plataforma legal"
    }
  ],
  "faqs": [
    { "pregunta": "string — pregunta real que haria un usuario a ChatGPT", "respuesta": "string — 1-2 oraciones directas con dato concreto" }
  ],
  "enlaces_internos": [
    { "url": "/manhwa/slug", "anchor": "string natural", "posicion": "introduccion|obra_N|conclusion" }
  ],
  "fecha_actualizacion": "marzo 2026",
  "schema_itemlist": {},
  "schema_faqpage": {},
  "schema_speakable": { "@type": "SpeakableSpecification", "cssSelector": [".respuesta-rapida", ".faq-answer"] },
  "confidence_score": 0.0,
  "razon": "string — por que esta pagina merece existir y sera util"
}`
}

function getUserPromptObra(data) {
  return `Query principal: "${data.query}"
${data.secondary_keywords ? `Keywords secundarias: ${JSON.stringify(data.secondary_keywords)}` : ''}
Impresiones Google: ${data.g_imp || data.impressions || 0} | Impresiones Bing: ${data.b_imp || data.impressionsBing || 0}
Tipo de pagina: obra
${data.paginas_relacionadas ? `Paginas del sitio para enlazar: ${JSON.stringify(data.paginas_relacionadas)}` : ''}

Devuelve SOLO este JSON:
{
  "slug": "/manhwa/${data.query.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}",
  "meta_title": "string — max 60 chars",
  "meta_description": "string — max 155 chars",
  "h1": "string con nombre de la obra",
  "respuesta_rapida": "string — 50 palabras: que es, genero, por que leerlo",
  "sinopsis": "string — 150-200 palabras sin spoilers",
  "generos": ["array"],
  "capitulos": 0,
  "estado": "en emision|finalizado",
  "ano_inicio": 2024,
  "donde_leer_legal": "string — plataforma y como acceder",
  "manhwas_similares": [{ "nombre": "string", "razon": "string — por que es similar", "url_interna": "string o null" }],
  "faqs": [
    { "pregunta": "string — pregunta que alguien haria sobre esta obra", "respuesta": "string — 1-2 oraciones directas" }
  ],
  "enlaces_internos": [
    { "url": "/listas/slug", "anchor": "string", "posicion": "similar|faqs|conclusion" }
  ],
  "fecha_actualizacion": "marzo 2026",
  "schema_book": {},
  "schema_faqpage": {},
  "schema_speakable": { "@type": "SpeakableSpecification", "cssSelector": [".respuesta-rapida", ".faq-answer"] },
  "confidence_score": 0.0,
  "razon": "string"
}`
}

function getUserPromptResena(data) {
  return `Query principal: "${data.query}"
${data.secondary_keywords ? `Keywords secundarias: ${JSON.stringify(data.secondary_keywords)}` : ''}
Impresiones Google: ${data.g_imp || data.impressions || 0} | Impresiones Bing: ${data.b_imp || data.impressionsBing || 0}
Tipo de pagina: resena
${data.paginas_relacionadas ? `Paginas del sitio para enlazar: ${JSON.stringify(data.paginas_relacionadas)}` : ''}

Devuelve SOLO este JSON:
{
  "slug": "/blog/resena-${data.query.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}",
  "meta_title": "string — max 60 chars",
  "meta_description": "string — max 155 chars, incluir puntuacion",
  "h1": "string — Resena de [Obra]: Vale la Pena?",
  "respuesta_rapida": "string — 50 palabras con veredicto directo y puntuacion",
  "puntuaciones": {
    "global": 0.0,
    "historia": 0.0,
    "arte": 0.0,
    "personajes": 0.0,
    "ritmo": 0.0
  },
  "veredicto": "string — 80 palabras con opinion clara y argumentada",
  "para_quien_es": "string — perfil del lector ideal para esta obra",
  "pros": ["string — aspecto positivo concreto"],
  "contras": ["string — aspecto negativo concreto"],
  "faqs": [
    { "pregunta": "string — 'es bueno X?', 'vale la pena X?'", "respuesta": "string — 1-2 oraciones directas" }
  ],
  "enlaces_internos": [
    { "url": "/manhwa/slug-obra", "anchor": "string", "posicion": "veredicto|similar|conclusion" }
  ],
  "fecha_actualizacion": "marzo 2026",
  "schema_review": {},
  "schema_faqpage": {},
  "confidence_score": 0.0,
  "razon": "string"
}`
}

function getUserPromptGuia(data) {
  return `Query principal: "${data.query}"
${data.secondary_keywords ? `Keywords secundarias: ${JSON.stringify(data.secondary_keywords)}` : ''}
Impresiones Google: ${data.g_imp || data.impressions || 0} | Impresiones Bing: ${data.b_imp || data.impressionsBing || 0}
Tipo de pagina: guia
${data.paginas_relacionadas ? `Paginas del sitio para enlazar: ${JSON.stringify(data.paginas_relacionadas)}` : ''}

Devuelve SOLO este JSON:
{
  "slug": "/blog/${data.query.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}",
  "meta_title": "string — max 60 chars",
  "meta_description": "string — max 155 chars",
  "h1": "string con keyword",
  "respuesta_rapida": "string — 50 palabras que respondan directamente la query",
  "pasos": [
    { "titulo": "string", "contenido": "string — 80 palabras", "tip": "string o null" }
  ],
  "faqs": [
    { "pregunta": "string", "respuesta": "string — 1-2 oraciones directas" }
  ],
  "enlaces_internos": [
    { "url": "/ruta/destino", "anchor": "string", "posicion": "paso_N|faqs|conclusion" }
  ],
  "fecha_actualizacion": "marzo 2026",
  "schema_howto": {},
  "schema_faqpage": {},
  "schema_speakable": { "@type": "SpeakableSpecification", "cssSelector": [".respuesta-rapida", ".faq-answer"] },
  "confidence_score": 0.0,
  "razon": "string"
}`
}

function getUserPrompt(tipoPagina, data) {
  switch (tipoPagina) {
    case 'lista': return getUserPromptLista(data)
    case 'resena': return getUserPromptResena(data)
    case 'guia': return getUserPromptGuia(data)
    default: return getUserPromptObra(data)
  }
}

module.exports = { getSystemPrompt, getUserPrompt, PROMPT_VERSION }
