"use client";

import React, { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Breadcrumbs, Anchor, Text, Container } from '@mantine/core';
import { IconHome, IconChevronRight } from '@tabler/icons-react';
import { getLocalizedPath } from '@/utils/i18nRoutes';
import { getTranslations } from '@/i18n/translations';

// Mapeo de slugs a nombres amigables
const FRIENDLY_NAMES = {
  es: {
    biblioteca: 'Biblioteca',
    manhwa: 'Manhwa',
    capitulo: 'Capítulo',
    populares: 'Populares',
    home: 'Inicio',
    perfil: 'Mi Perfil',
    colecciones: 'Colecciones',
    pedidos: 'Pedidos',
    pendiente: 'Pendiente',
    manga: 'Manga',
    mangas: 'Manga',
  },
  en: {
    library: 'Library',
    manhwa: 'Manhwa',
    chapter: 'Chapter',
    populares: 'Popular',
    home: 'Home',
    profile: 'My Profile',
    collections: 'Collections',
    pending: 'Pending',
    manga: 'Manga',
    genre: 'Genre',
    about: 'About',
  },
};

// Rutas donde NO mostrar breadcrumbs
const HIDDEN_PATHS = ['/', '/home', '/en/home', '/login', '/register', '/auth'];

// Componente interno que usa useSearchParams
function BreadcrumbsContent({ lang = 'es' }) {
  const t = getTranslations(lang).breadcrumbs;
  const pathname = usePathname() || '/';
  const searchParams = useSearchParams();
  const query = searchParams?.get('search') || '';

  // Ocultar en rutas específicas
  if (HIDDEN_PATHS.some(p => pathname === p || pathname.startsWith('/auth/'))) {
    return null;
  }

  const segments = pathname.split('/').filter(Boolean);
  const items = [];

  // Icono de inicio
  items.push(
    <Anchor 
      component={Link} 
      href={getLocalizedPath('/home', lang)}
      key="home"
      style={{ 
        display: 'flex', 
        alignItems: 'center',
        color: 'var(--mantine-color-cyan-4)',
        textDecoration: 'none',
      }}
    >
      <IconHome size={14} />
    </Anchor>
  );

  let accumulated = '';
  segments.forEach((seg, idx) => {
    accumulated += '/' + seg;
    const isLast = idx === segments.length - 1;
    
    // Obtener nombre amigable o formatear el slug
    let label = FRIENDLY_NAMES[lang]?.[seg.toLowerCase()];
    if (!label) {
      // Decodificar y capitalizar si no está en el mapeo
      label = decodeURIComponent(seg)
        .replace(/-/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
    }

    // Para capítulos, mostrar el número
    if (segments[idx - 1]?.toLowerCase() === 'capitulo' || segments[idx - 1]?.toLowerCase() === 'chapter') {
      label = `${t.chapterAbbrev} ${seg}`;
    }

    if (isLast && !query) {
      items.push(
        <Text 
          key={accumulated} 
          size="xs"
          c="dimmed"
          fw={500}
        >
          {label}
        </Text>
      );
    } else {
      items.push(
        <Anchor 
          component={Link} 
          href={accumulated} 
          key={accumulated}
          size="xs"
          c="cyan"
          fw={500}
        >
          {label}
        </Anchor>
      );
    }
  });

  if (query) {
    items.push(
      <Text key="search" size="xs" c="dimmed" fs="italic">
        &ldquo;{query}&rdquo;
      </Text>
    );
  }

  return (
    <Container size="lg" py={4}>
      <Breadcrumbs 
        separator={<IconChevronRight size={12} color="var(--mantine-color-dark-3)" />}
      >
        {items}
      </Breadcrumbs>
    </Container>
  );
}

// Componente exportado envuelto en Suspense para evitar errores de hidratación
export default function GlobalBreadcrumbs({ lang = 'es' }) {
  return (
    <Suspense fallback={null}>
      <BreadcrumbsContent lang={lang} />
    </Suspense>
  );
}
