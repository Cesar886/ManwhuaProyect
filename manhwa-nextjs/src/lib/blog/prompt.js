/**
 * ============================================================================
 * MANHWA IMPERIAL - SISTEMA DE GENERACIÓN DE BLOGS CON IA
 * Prompt Maestro v2.0 - Optimizado para SEO
 * ============================================================================
 * Uso: con este archivo generas artículos de blog via la API de Anthropic/OpenAI
 * y luego insertas el JSON resultante en src/lib/blog/posts.js
 * ============================================================================
 */

// ============================================================================
// SECCIÓN 1: PROMPT MAESTRO (System Instruction para la IA)
// ============================================================================

export const PROMPT_MAESTRO_SYSTEM = `
Eres un experto en SEO técnico, redacción persuasiva y cultura de cómics asiáticos (manhwa, manga, manhua y webtoons). Trabajas exclusivamente para Manhwa Imperial (manhwaimperial.site), la plataforma premium en español para leer manhwa.

Tu objetivo: generar artículos de blog altamente optimizados para posicionar en Google en español, diseñados para capturar tráfico orgánico desde búsquedas long-tail y convertir visitantes en lectores activos de la plataforma.

═══════════════════════════════════════════════════
FORMATO DE RESPUESTA OBLIGATORIO
═══════════════════════════════════════════════════

Devuelve ÚNICAMENTE un objeto JSON válido. Sin markdown, sin explicaciones, sin texto fuera del JSON.
Si no puedes generar el JSON, responde: {"error": "descripcion del problema"}

═══════════════════════════════════════════════════
ESTRUCTURA JSON REQUERIDA
═══════════════════════════════════════════════════

{
  "title": "string (50-60 caracteres)",
  "meta_description": "string (150-160 caracteres)",
  "slug": "string (URL amigable)",
  "featured_image_alt": "string (texto alt para imagen destacada, descriptivo y con keyword)",
  "category": "string (una de: guias | recomendaciones | noticias | cultura | tutoriales | rankings | comparativas)",
  "tags": ["array de 5-8 tags relevantes en español"],
  "reading_time_minutes": number,
  "target_keyword": "string (palabra clave principal del artículo)",
  "secondary_keywords": ["array de 3-5 keywords secundarias"],
  "html_content": "string (HTML semántico completo del artículo)",
  "schema_data": { objeto JSON-LD BlogPosting válido },
  "faq_schema": [ array de {question, answer} ],
  "internal_links_used": ["array de las rutas internas usadas en el artículo"],
  "word_count": number,
  "publishedAt": "string (fecha ISO 8601)",
  "updatedAt": "string (fecha ISO 8601)"
}

═══════════════════════════════════════════════════
REGLAS DE GENERACIÓN DETALLADAS
═══════════════════════════════════════════════════

1. "title" (Etiqueta <title>):
   - Entre 50 y 60 caracteres EXACTOS (cuenta cada carácter)
   - La palabra clave principal lo más a la IZQUIERDA posible
   - Incluir un gancho emocional o número si aplica
   - Usar pipe "|" o guion "—" para separar del nombre del sitio si hay espacio
   - Ejemplos buenos: "Manhwa de Nivelación: Top 15 que Debes Leer en 2026"
   - Ejemplos malos: "Los mejores manhwas de nivelación que puedes leer online" (muy largo)

2. "meta_description":
   - Entre 150 y 160 caracteres EXACTOS
   - Incluir la keyword principal de forma natural
   - Tono persuasivo que invite al clic (alto CTR)
   - Incluir un CTA implícito: "Descubre", "Encuentra", "Lee ahora"
   - Usar emojis solo si es relevante para el público joven (máximo 1)

3. "slug":
   - URL limpia, corta, en minúsculas, separada por guiones
   - Centrada en la keyword principal
   - Sin palabras vacías (de, el, la, los, las, en, un, una, y, o, que, para, por, con)
   - Sin fechas ni años
   - Sin caracteres especiales ni tildes
   - Máximo 5-6 palabras
   - Ejemplo: "mejores-manhwa-nivelacion", "donde-leer-manhwa-espanol"

4. "html_content" — EL CUERPO DEL ARTÍCULO:

   ESTRUCTURA HTML OBLIGATORIA:
   - NO incluir <h1> (se renderiza dinámicamente desde "title" en el frontend)
   - Usar <h2> para subtítulos principales (ideal para keywords secundarias)
   - Usar <h3> para subsecciones dentro de H2
   - Usar <h4> solo si es necesario para listas extensas de títulos

   REGLAS SEO DEL CONTENIDO:
   - La keyword principal DEBE aparecer en las primeras 100 palabras de forma natural
   - Densidad de keyword: 1-2% (natural, no forzado)
   - Usar semántica LSI obligatoriamente: sinónimos y vocabulario del nicho como:
     * capítulos, episodios, temporada, arco argumental
     * lectura online, leer gratis, plataforma, webtoon, webcomic
     * protagonista, MC, personaje principal, villano, antagonista
     * sistema de niveles, RPG, isekai, reencarnación, regresión, nivelación
     * manhwa coreano, manga japonés, manhua chino
     * arte a color, formato vertical, scroll, tira vertical
     * cazadores, mazmorras, torres, gremios, raids
     * romance, BL, GL, seinen, shounen, josei
   - Usar <strong> estratégicamente — máximo 1 cada 150-200 palabras
   - Usar <em> para términos en otros idiomas y títulos originales

   ENLACES OBLIGATORIOS (usar estas rutas):
   - <a href="/biblioteca">biblioteca completa</a>
   - <a href="/biblioteca?genero=accion">manhwas de acción</a>
   - <a href="/biblioteca?genero=romance">manhwas de romance</a>
   - <a href="/biblioteca?genero=fantasia">manhwas de fantasía</a>
   - <a href="/biblioteca?genero=isekai">manhwas isekai</a>
   - <a href="/biblioteca?genero=sistema">manhwas con sistema</a>
   - <a href="/biblioteca?genero=artes-marciales">manhwas de artes marciales</a>
   - <a href="/biblioteca?genero=bl">manhwas BL</a>
   - <a href="/biblioteca?genero=horror">manhwas de horror</a>
   - <a href="/blog">nuestro blog</a>
   - <a href="/populares">los más populares</a>
   - <a href="/home">últimas actualizaciones</a>
   - Mínimo 1 enlace EXTERNO con nofollow a fuente de alta autoridad

   LONGITUD Y FORMATO:
   - Mínimo 1,200 palabras para artículos estándar
   - Mínimo 2,000 palabras para guías y rankings
   - Párrafos cortos: 2-4 oraciones máximo (optimizado para lectura móvil)
   - Incluir al menos 1 lista ordenada (<ol>) o desordenada (<ul>)

   TONO Y ESTILO:
   - Cercano pero experto, como un amigo que sabe mucho de manhwa
   - Usar "tú" (informal, hispanoamericano)
   - Referirse a la audiencia como "lectores", "fans del manhwa"
   - Nunca usar contenido copiado, todo debe ser original

5. "schema_data" — JSON-LD de BlogPosting:
   {
     "@context": "https://schema.org",
     "@type": "BlogPosting",
     "headline": "[mismo que title]",
     "description": "[mismo que meta_description]",
     "author": { "@type": "Organization", "name": "Manhwa Imperial", "url": "https://manhwaimperial.site" },
     "publisher": { "@type": "Organization", "name": "Manhwa Imperial" },
     "datePublished": "[fecha actual ISO 8601]",
     "dateModified": "[fecha actual ISO 8601]",
     "mainEntityOfPage": { "@type": "WebPage", "@id": "https://manhwaimperial.site/blog/[slug]" },
     "inLanguage": "es",
     "keywords": "[target_keyword], [secondary_keywords separadas por coma]"
   }

6. "faq_schema" — Array de FAQs:
   [{ "question": "pregunta", "answer": "respuesta (50-150 palabras)" }]
   - Incluir 3-5 preguntas frecuentes REALES que la gente buscaría
   - Las preguntas deben contener variaciones long-tail de la keyword

═══════════════════════════════════════════════════
OPTIMIZACIONES AVANZADAS
═══════════════════════════════════════════════════

- TOPICAL AUTHORITY: Incluir contexto que demuestre expertise (datos, comparativas, análisis)
- E-E-A-T: Mostrar experiencia real con las obras mencionadas (opiniones fundamentadas)
- FEATURED SNIPPETS: Estructurar al menos 1 sección con formato de "definición" o "lista"
- PEOPLE ALSO ASK: Las FAQ deben responder preguntas reales del nicho
- MOBILE-FIRST: Párrafos cortos, subtítulos frecuentes, contenido escaneable
- FRESHNESS: Mencionar el año actual (2026) cuando sea relevante

TEMA O PALABRA CLAVE A DESARROLLAR: [KEYWORD_PLACEHOLDER]
`;

// ============================================================================
// SECCIÓN 2: BANCO DE PALABRAS CLAVE LONG-TAIL (100+ KEYWORDS)
// ============================================================================

export const LONG_TAIL_KEYWORDS = [
  // ─── PLATAFORMAS (Alta intención transaccional) ───────────────────────────
  { keyword: 'donde leer manhwa en español gratis', category: 'plataformas', priority: 'alta', intent: 'transaccional' },
  { keyword: 'paginas para leer manhwa en español', category: 'plataformas', priority: 'alta', intent: 'transaccional' },
  { keyword: 'sitios para leer manhwa en español online', category: 'plataformas', priority: 'alta', intent: 'transaccional' },
  { keyword: 'mejores paginas para leer manhwa gratis', category: 'plataformas', priority: 'alta', intent: 'transaccional' },
  { keyword: 'leer manhwa en español latino online', category: 'plataformas', priority: 'alta', intent: 'transaccional' },
  { keyword: 'aplicaciones para leer manhwa en español', category: 'plataformas', priority: 'alta', intent: 'transaccional' },
  { keyword: 'leer webtoon en español gratis online', category: 'plataformas', priority: 'alta', intent: 'transaccional' },
  { keyword: 'alternativas a tapas webtoon en español', category: 'plataformas', priority: 'alta', intent: 'transaccional' },
  { keyword: 'paginas como manhwas net en español', category: 'plataformas', priority: 'alta', intent: 'transaccional' },
  { keyword: 'alternativas a manhwa online para leer gratis', category: 'plataformas', priority: 'alta', intent: 'transaccional' },
  { keyword: 'webtoon en español app para celular', category: 'plataformas', priority: 'media', intent: 'transaccional' },
  { keyword: 'paginas para leer manhwa bl en español', category: 'plataformas', priority: 'alta', intent: 'transaccional' },
  { keyword: 'leer manhwa en el celular gratis', category: 'plataformas', priority: 'media', intent: 'transaccional' },
  { keyword: 'mejor app para leer manhwa offline', category: 'plataformas', priority: 'media', intent: 'transaccional' },
  { keyword: 'plataformas legales para leer manhwa en español', category: 'plataformas', priority: 'media', intent: 'informativa' },

  // ─── COMPETIDORES (Capturar tráfico de marca) ────────────────────────────
  { keyword: 'tapas webtoon en español catalogo', category: 'competidores', priority: 'alta', intent: 'navegacional' },
  { keyword: 'real manga manhwa en español', category: 'competidores', priority: 'alta', intent: 'navegacional' },
  { keyword: 'manhwas net alternativas en español', category: 'competidores', priority: 'alta', intent: 'navegacional' },
  { keyword: 'manhwa online pagina para leer gratis', category: 'competidores', priority: 'alta', intent: 'navegacional' },
  { keyword: 'webtoon app en español catalogo completo', category: 'competidores', priority: 'media', intent: 'navegacional' },
  { keyword: 'tappytoon en español como funciona', category: 'competidores', priority: 'media', intent: 'informativa' },
  { keyword: 'manta comics en español tiene manhwa', category: 'competidores', priority: 'media', intent: 'informativa' },
  { keyword: 'lezhin comics en español catalogo bl', category: 'competidores', priority: 'media', intent: 'navegacional' },
  { keyword: 'pocket comics vs webtoon cual es mejor', category: 'competidores', priority: 'media', intent: 'comparativa' },
  { keyword: 'mejores plataformas de manhwa 2026 comparativa', category: 'competidores', priority: 'alta', intent: 'comparativa' },

  // ─── RECOMENDACIONES POR GÉNERO ───────────────────────────────────────────
  { keyword: 'mejores manhwa de nivelacion para leer', category: 'recomendaciones', priority: 'alta', intent: 'informativa' },
  { keyword: 'manhwa con sistema de niveles tipo rpg', category: 'recomendaciones', priority: 'alta', intent: 'informativa' },
  { keyword: 'mejores manhwa de reencarnacion en español', category: 'recomendaciones', priority: 'alta', intent: 'informativa' },
  { keyword: 'manhwa isekai con protagonista op', category: 'recomendaciones', priority: 'alta', intent: 'informativa' },
  { keyword: 'mejores manhwa de romance en español', category: 'recomendaciones', priority: 'alta', intent: 'informativa' },
  { keyword: 'manhwa romance donde el protagonista es fuerte', category: 'recomendaciones', priority: 'media', intent: 'informativa' },
  { keyword: 'mejores manhwa bl en español para leer', category: 'recomendaciones', priority: 'alta', intent: 'informativa' },
  { keyword: 'manhwa bl con buena historia y arte', category: 'recomendaciones', priority: 'media', intent: 'informativa' },
  { keyword: 'mejores manhwa de artes marciales en español', category: 'recomendaciones', priority: 'alta', intent: 'informativa' },
  { keyword: 'manhwa de accion con peleas epicas', category: 'recomendaciones', priority: 'media', intent: 'informativa' },
  { keyword: 'manhwa de fantasia con magia y aventura', category: 'recomendaciones', priority: 'media', intent: 'informativa' },
  { keyword: 'mejores manhwa de terror y horror', category: 'recomendaciones', priority: 'media', intent: 'informativa' },
  { keyword: 'manhwa de comedia romantica para leer', category: 'recomendaciones', priority: 'media', intent: 'informativa' },
  { keyword: 'manhwa de venganza con protagonista inteligente', category: 'recomendaciones', priority: 'alta', intent: 'informativa' },
  { keyword: 'manhwa con protagonista villana reencarnada', category: 'recomendaciones', priority: 'alta', intent: 'informativa' },
  { keyword: 'mejores manhwa de regresion temporal', category: 'recomendaciones', priority: 'alta', intent: 'informativa' },
  { keyword: 'manhwa donde el debil se vuelve el mas fuerte', category: 'recomendaciones', priority: 'alta', intent: 'informativa' },
  { keyword: 'manhwa con cazadores de mazmorras', category: 'recomendaciones', priority: 'alta', intent: 'informativa' },
  { keyword: 'manhwa de supervivencia en otro mundo', category: 'recomendaciones', priority: 'media', intent: 'informativa' },
  { keyword: 'manhwa gl yuri en español para leer', category: 'recomendaciones', priority: 'media', intent: 'informativa' },

  // ─── TÍTULOS ESPECÍFICOS ──────────────────────────────────────────────────
  { keyword: 'solo leveling leer en español todos los capitulos', category: 'titulos', priority: 'alta', intent: 'transaccional' },
  { keyword: 'tower of god leer en español online', category: 'titulos', priority: 'alta', intent: 'transaccional' },
  { keyword: 'the beginning after the end manhwa en español', category: 'titulos', priority: 'alta', intent: 'transaccional' },
  { keyword: 'omniscient reader viewpoint leer en español', category: 'titulos', priority: 'alta', intent: 'transaccional' },
  { keyword: 'nano machine manhwa en español capitulos', category: 'titulos', priority: 'media', intent: 'transaccional' },
  { keyword: 'tomb raider king manhwa leer español', category: 'titulos', priority: 'media', intent: 'transaccional' },
  { keyword: 'true beauty manhwa leer en español', category: 'titulos', priority: 'media', intent: 'transaccional' },
  { keyword: 'eleceed manhwa en español donde leer', category: 'titulos', priority: 'media', intent: 'transaccional' },
  { keyword: 'legend of the northern blade manhwa español', category: 'titulos', priority: 'media', intent: 'transaccional' },
  { keyword: 'overgeared manhwa en español leer online', category: 'titulos', priority: 'media', intent: 'transaccional' },
  { keyword: 'return of the mount hua sect español', category: 'titulos', priority: 'media', intent: 'transaccional' },
  { keyword: 'second life ranker manhwa español capitulos', category: 'titulos', priority: 'media', intent: 'transaccional' },
  { keyword: 'the world after the fall manhwa español', category: 'titulos', priority: 'media', intent: 'transaccional' },
  { keyword: 'desde que capitulo del manhwa sigue el anime solo leveling', category: 'titulos', priority: 'alta', intent: 'informativa' },
  { keyword: 'order para leer solo leveling novela y manhwa', category: 'titulos', priority: 'media', intent: 'informativa' },

  // ─── COMPARATIVAS ─────────────────────────────────────────────────────────
  { keyword: 'manhwa parecidos a solo leveling en español', category: 'comparativas', priority: 'alta', intent: 'informativa' },
  { keyword: 'manhwa como tower of god para leer', category: 'comparativas', priority: 'alta', intent: 'informativa' },
  { keyword: 'manhwa similar a the beginning after the end', category: 'comparativas', priority: 'alta', intent: 'informativa' },
  { keyword: 'manhwa parecido a omniscient reader', category: 'comparativas', priority: 'media', intent: 'informativa' },
  { keyword: 'manhwa como eleceed con poderes sobrenaturales', category: 'comparativas', priority: 'media', intent: 'informativa' },
  { keyword: 'manhwa similar a true beauty romance', category: 'comparativas', priority: 'media', intent: 'informativa' },
  { keyword: 'manhwa como nano machine artes marciales', category: 'comparativas', priority: 'media', intent: 'informativa' },
  { keyword: 'manhwa parecidos a sweet home terror', category: 'comparativas', priority: 'media', intent: 'informativa' },
  { keyword: 'diferencia entre manhwa manga y manhua', category: 'comparativas', priority: 'alta', intent: 'informativa' },
  { keyword: 'manhwa vs webtoon cual es la diferencia', category: 'comparativas', priority: 'media', intent: 'informativa' },

  // ─── GUÍAS ────────────────────────────────────────────────────────────────
  { keyword: 'que es un manhwa y como se lee', category: 'guias', priority: 'alta', intent: 'informativa' },
  { keyword: 'como empezar a leer manhwa guia para principiantes', category: 'guias', priority: 'alta', intent: 'informativa' },
  { keyword: 'generos de manhwa explicados guia completa', category: 'guias', priority: 'media', intent: 'informativa' },
  { keyword: 'que manhwa leer si nunca has leido uno', category: 'guias', priority: 'alta', intent: 'informativa' },
  { keyword: 'como funciona el sistema de niveles en manhwa', category: 'guias', priority: 'media', intent: 'informativa' },
  { keyword: 'guia para entender manhwa isekai reencarnacion', category: 'guias', priority: 'media', intent: 'informativa' },
  { keyword: 'mejores manhwa para empezar a leer 2026', category: 'guias', priority: 'alta', intent: 'informativa' },
  { keyword: 'manhwa terminados completos para leer de una vez', category: 'guias', priority: 'alta', intent: 'informativa' },
  { keyword: 'manhwa con mas de 100 capitulos para leer', category: 'guias', priority: 'media', intent: 'informativa' },
  { keyword: 'manhwa cortos de menos de 50 capitulos', category: 'guias', priority: 'media', intent: 'informativa' },

  // ─── RANKINGS ─────────────────────────────────────────────────────────────
  { keyword: 'top 10 mejores manhwa de todos los tiempos', category: 'rankings', priority: 'alta', intent: 'informativa' },
  { keyword: 'ranking mejores manhwa 2026 actualizados', category: 'rankings', priority: 'alta', intent: 'informativa' },
  { keyword: 'top manhwa mas populares en español', category: 'rankings', priority: 'alta', intent: 'informativa' },
  { keyword: 'mejores manhwa completados que debes leer', category: 'rankings', priority: 'alta', intent: 'informativa' },
  { keyword: 'top 20 manhwa de accion mas epicos', category: 'rankings', priority: 'media', intent: 'informativa' },
  { keyword: 'mejores manhwa con protagonista femenina fuerte', category: 'rankings', priority: 'media', intent: 'informativa' },
  { keyword: 'top manhwa de romance historico coreano', category: 'rankings', priority: 'media', intent: 'informativa' },
  { keyword: 'mejores manhwa con adaptacion a anime', category: 'rankings', priority: 'alta', intent: 'informativa' },
  { keyword: 'manhwa mas populares en corea del sur', category: 'rankings', priority: 'media', intent: 'informativa' },
  { keyword: 'mejores manhwa nuevos 2026 para seguir', category: 'rankings', priority: 'alta', intent: 'informativa' },

  // ─── TEMÁTICA ESPECÍFICA (Long-tail puro) ─────────────────────────────────
  { keyword: 'manhwa donde el protagonista oculta su verdadero poder', category: 'tematica', priority: 'alta', intent: 'informativa' },
  { keyword: 'manhwa con protagonista que renace como villano', category: 'tematica', priority: 'media', intent: 'informativa' },
  { keyword: 'manhwa con torre de mazmorras y niveles', category: 'tematica', priority: 'alta', intent: 'informativa' },
  { keyword: 'manhwa con sistema de habilidades y estadisticas', category: 'tematica', priority: 'alta', intent: 'informativa' },
  { keyword: 'manhwa de regresion donde vuelve al pasado', category: 'tematica', priority: 'alta', intent: 'informativa' },
  { keyword: 'manhwa con invocacion de monstruos y criaturas', category: 'tematica', priority: 'media', intent: 'informativa' },
  { keyword: 'manhwa de academia con poderes sobrenaturales', category: 'tematica', priority: 'media', intent: 'informativa' },
  { keyword: 'manhwa con protagonista que sube de nivel solo', category: 'tematica', priority: 'alta', intent: 'informativa' },
  { keyword: 'manhwa donde el mundo es un juego rpg', category: 'tematica', priority: 'media', intent: 'informativa' },
  { keyword: 'manhwa con necromante como protagonista principal', category: 'tematica', priority: 'media', intent: 'informativa' },
  { keyword: 'manhwa con multiples lineas temporales y regresion', category: 'tematica', priority: 'media', intent: 'informativa' },
  { keyword: 'manhwa de supervivencia apocaliptica con monstruos', category: 'tematica', priority: 'media', intent: 'informativa' },
  { keyword: 'manhwa con duque frio que se enamora de la protagonista', category: 'tematica', priority: 'media', intent: 'informativa' },
  { keyword: 'manhwa de matrimonio forzado romance historico', category: 'tematica', priority: 'media', intent: 'informativa' },
  { keyword: 'manhwa con secretaria y ceo romance moderno', category: 'tematica', priority: 'media', intent: 'informativa' },

  // ─── NOTICIAS Y CULTURA ───────────────────────────────────────────────────
  { keyword: 'manhwa que tendran adaptacion anime 2026', category: 'noticias', priority: 'alta', intent: 'informativa' },
  { keyword: 'nuevos manhwa que salen esta semana español', category: 'noticias', priority: 'media', intent: 'informativa' },
  { keyword: 'manhwa mas leidos del mes en español', category: 'noticias', priority: 'media', intent: 'informativa' },
  { keyword: 'manhwa coreano tendencias populares 2026', category: 'noticias', priority: 'media', intent: 'informativa' },
  { keyword: 'porque los manhwa son tan populares ahora', category: 'noticias', priority: 'media', intent: 'informativa' },
  { keyword: 'historia del manhwa como surgio en corea', category: 'cultura', priority: 'baja', intent: 'informativa' },
  { keyword: 'por que los manhwa se leen en vertical', category: 'cultura', priority: 'baja', intent: 'informativa' },
  { keyword: 'manhwa licenciados oficialmente en español 2026', category: 'noticias', priority: 'media', intent: 'informativa' },

  // ─── FAQ / PEOPLE ALSO ASK ────────────────────────────────────────────────
  { keyword: 'cual es el mejor manhwa para empezar', category: 'faq', priority: 'alta', intent: 'informativa' },
  { keyword: 'cuantos capitulos tiene solo leveling manhwa', category: 'faq', priority: 'alta', intent: 'informativa' },
  { keyword: 'es lo mismo manhwa que manga', category: 'faq', priority: 'alta', intent: 'informativa' },
  { keyword: 'que manhwa tiene la mejor historia de todos', category: 'faq', priority: 'media', intent: 'informativa' },
  { keyword: 'se puede leer manhwa gratis legalmente', category: 'faq', priority: 'alta', intent: 'informativa' },
  { keyword: 'cuales son los generos mas populares de manhwa', category: 'faq', priority: 'media', intent: 'informativa' },
  { keyword: 'que manhwa tiene el mejor arte y dibujo', category: 'faq', priority: 'media', intent: 'informativa' },
  { keyword: 'por donde empezar a leer tower of god', category: 'faq', priority: 'media', intent: 'informativa' },
  { keyword: 'que manhwa son buenos para fans de solo leveling', category: 'faq', priority: 'alta', intent: 'informativa' },
  { keyword: 'los manhwa son de corea o de japon', category: 'faq', priority: 'media', intent: 'informativa' },
]

// ============================================================================
// SECCIÓN 3: PROMPT PARA GENERAR KEYWORDS ADICIONALES
// ============================================================================

export const PROMPT_KEYWORD_GENERATOR = `
Eres un experto en SEO para el nicho de manhwa, webtoons y cómics coreanos en el mercado hispanohablante.

Tu tarea: Generar 50 palabras clave long-tail adicionales que personas hispanohablantes buscarían en Google relacionadas con leer manhwa online.

CONTEXTO:
- Sitio web: Manhwa Imperial (manhwaimperial.site)
- Idioma objetivo: Español (Latinoamérica y España)
- Audiencia: Lectores de manhwa de 16-35 años
- Competidores: webtoon, tapas, manhwas.net, manhwaonline, real manga

TIPOS DE KEYWORDS:
1. Transaccionales: "donde leer X", "paginas para leer X", "leer X gratis"
2. Informativas: "que es X", "mejores X", "como funciona X"
3. Comparativas: "X vs Y", "diferencia entre X y Y", "alternativas a X"
4. Navegacionales: búsquedas de títulos específicos + "en español" / "capitulos"
5. Long-tail temáticas: búsquedas muy específicas sobre tramas o tipos de historia

FORMATO DE RESPUESTA (JSON array):
[
  {
    "keyword": "la frase long-tail completa",
    "category": "plataformas|recomendaciones|titulos|comparativas|guias|rankings|tematica|noticias|faq",
    "priority": "alta|media|baja",
    "intent": "transaccional|informativa|comparativa|navegacional",
    "suggested_title": "Título SEO sugerido para un artículo"
  }
]
`

// ============================================================================
// SECCIÓN 4: UTILIDADES
// ============================================================================

/**
 * Genera el prompt final concatenando el System Instruction con la keyword
 */
export function buildPrompt(keyword) {
  return PROMPT_MAESTRO_SYSTEM.replace('[KEYWORD_PLACEHOLDER]', keyword)
}

/**
 * Selecciona keywords de una categoría específica
 */
export function getKeywordsByCategory(category, count = 5) {
  const filtered = LONG_TAIL_KEYWORDS.filter((k) => k.category === category)
  return filtered.sort(() => 0.5 - Math.random()).slice(0, count)
}

/**
 * Obtiene keywords de alta prioridad
 */
export function getHighPriorityKeywords(publishedSlugs = []) {
  return LONG_TAIL_KEYWORDS.filter((k) => k.priority === 'alta').filter((k) => {
    const slug = k.keyword
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
    return !publishedSlugs.includes(slug)
  })
}

/**
 * Genera un plan de publicación semanal (7 artículos) balanceado por categoría
 */
export function generateWeeklyPlan() {
  const categories = [
    'plataformas',
    'recomendaciones',
    'titulos',
    'comparativas',
    'rankings',
    'guias',
    'tematica',
  ]
  const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

  return categories.map((cat, i) => {
    const pool = LONG_TAIL_KEYWORDS.filter((k) => k.category === cat && k.priority !== 'baja')
    const selected = pool[Math.floor(Math.random() * pool.length)]
    return { day: days[i], keyword: selected.keyword, category: cat, intent: selected.intent }
  })
}

/**
 * Estadísticas del banco de keywords
 */
export function getKeywordStats() {
  const stats = { total: LONG_TAIL_KEYWORDS.length, byCategory: {}, byPriority: {}, byIntent: {} }
  LONG_TAIL_KEYWORDS.forEach((k) => {
    stats.byCategory[k.category] = (stats.byCategory[k.category] || 0) + 1
    stats.byPriority[k.priority] = (stats.byPriority[k.priority] || 0) + 1
    stats.byIntent[k.intent] = (stats.byIntent[k.intent] || 0) + 1
  })
  return stats
}

// ============================================================================
// SECCIÓN 5: EJEMPLO DE USO CON API DE ANTHROPIC
// ============================================================================
/*
import Anthropic from '@anthropic-ai/sdk'
import { buildPrompt } from './prompt.js'
import { addPost } from './posts.js'

async function generateBlogPost(keyword) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    messages: [{ role: 'user', content: buildPrompt(keyword) }],
  })

  const blogData = JSON.parse(response.content[0].text)
  // Validar y añadir a posts.js o a tu base de datos
  addPost(blogData)
  return blogData
}
*/
