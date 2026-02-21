"use client";

import Link from 'next/link';

/**
 * KEYWORDS_MAP - Mapeo de palabras clave a enlaces internos
 *
 * SEO: Convierte menciones naturales en la sinopsis en enlaces internos.
 * Similar a cómo Wikipedia enlaza conceptos mencionados en artículos.
 * Solo enlaza la primera aparición de cada keyword para no saturar.
 */
const KEYWORDS_MAP = [
  // Géneros principales
  { pattern: /\b(cazador(?:es)?)\b/gi, href: '/genero/accion', label: 'cazador' },
  { pattern: /\b(dungeons?|mazmorras?)\b/gi, href: '/genero/fantasia', label: 'dungeon' },
  { pattern: /\b(torre)\b/gi, href: '/genero/accion', label: 'torre' },
  { pattern: /\b(reencarnaci[oó]n|reencarnad[oa])\b/gi, href: '/genero/isekai', label: 'reencarnación' },
  { pattern: /\b(artes?\s*marciales?|murim)\b/gi, href: '/genero/artes-marciales', label: 'artes marciales' },
  { pattern: /\b(cultivaci[oó]n)\b/gi, href: '/genero/artes-marciales', label: 'cultivación' },
  { pattern: /\b(sistema)\b/gi, href: '/genero/sistema', label: 'sistema' },
  { pattern: /\b(venganza)\b/gi, href: '/genero/venganza', label: 'venganza' },
  { pattern: /\b(romance|rom[aá]ntic[oa])\b/gi, href: '/genero/romance', label: 'romance' },
  { pattern: /\b(magia|m[aá]gic[oa])\b/gi, href: '/genero/fantasia', label: 'magia' },
  { pattern: /\b(demonios?|demon)\b/gi, href: '/genero/supernatural', label: 'demonio' },
  { pattern: /\b(misterio)\b/gi, href: '/genero/misterio', label: 'misterio' },
  { pattern: /\b(isekai|otro\s*mundo)\b/gi, href: '/genero/isekai', label: 'isekai' },
];

/**
 * LinkedSynopsis - Synopsis con enlaces internos automáticos
 *
 * @param {Object} props
 * @param {string} props.text - Texto de la sinopsis
 * @param {string} props.className - Clase CSS
 * @param {string} [props.id] - ID del elemento para schema Speakable y anclas SEO
 */
export default function LinkedSynopsis({ text, className, id }) {
  if (!text) return null;

  // Rastrear qué hrefs ya se usaron (solo enlazar primera aparición por destino)
  const usedHrefs = new Set();
  const parts = [];
  let remaining = text;
  let keyIndex = 0;

  // Iterar por el texto buscando matches
  while (remaining.length > 0) {
    let earliestMatch = null;
    let earliestKeyword = null;

    for (const keyword of KEYWORDS_MAP) {
      if (usedHrefs.has(keyword.href)) continue;

      keyword.pattern.lastIndex = 0;
      const match = keyword.pattern.exec(remaining);
      if (match && (!earliestMatch || match.index < earliestMatch.index)) {
        earliestMatch = match;
        earliestKeyword = keyword;
      }
    }

    if (!earliestMatch || !earliestKeyword) {
      // No más matches, agregar el texto restante
      parts.push(remaining);
      break;
    }

    // Agregar texto antes del match
    if (earliestMatch.index > 0) {
      parts.push(remaining.slice(0, earliestMatch.index));
    }

    // Agregar el enlace
    usedHrefs.add(earliestKeyword.href);
    parts.push(
      <Link
        key={`link-${keyIndex++}`}
        href={earliestKeyword.href}
        style={{
          color: 'var(--imperial-primary, #667eea)',
          textDecoration: 'none',
          borderBottom: '1px dotted var(--imperial-primary, #667eea)',
          transition: 'opacity 0.2s',
        }}
        title={`Ver manhwas de ${earliestKeyword.label}`}
      >
        {earliestMatch[0]}
      </Link>
    );

    // Continuar con el texto después del match
    remaining = remaining.slice(earliestMatch.index + earliestMatch[0].length);
  }

  return <p id={id} className={className}>{parts}</p>;
}
