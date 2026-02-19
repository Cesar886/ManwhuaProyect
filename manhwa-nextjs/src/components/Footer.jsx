"use client";

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { IconBrandInstagram, IconBrandTwitter, IconBrandDiscord } from '@tabler/icons-react';
import { ActionIcon, Container, Group, Text } from '@mantine/core';
import classes from './Footer.module.css';

const data = [
  {
    title: 'Leer Manhwa',
    links: [
      { label: 'Biblioteca de Manhwas', link: '/biblioteca' },
      { label: 'Manhwas Populares', link: '/populares' },
      { label: 'Colecciones de Manhwa', link: '/colecciones' },
    ],
  },
  {
    title: 'Géneros de Manhwa',
    links: [
      { label: 'Manhwa de Romance', link: '/genero/romance' },
      { label: 'Manhwa de Acción', link: '/genero/accion' },
      { label: 'Manhwa de Fantasía', link: '/genero/fantasia' },
    ],
  },
  {
    title: 'Comunidad',
    links: [
      { label: 'Discord', link: '/discord' },
      { label: 'Contacto', link: '/contacto' },
    ],
  },
];

function Footer() {
  const groups = data.map((group) => {
    const links = group.links.map((link, index) => (
      <Link
        key={index}
        className={classes.link}
        href={link.link}
      >
        {link.label}
      </Link>
    ));

    return (
      <div className={classes.wrapper} key={group.title}>
        <Text className={classes.title}>{group.title}</Text>
        {links}
      </div>
    );
  });

  return (
    <footer className={classes.footer}>
      <Container className={classes.inner}>
        <div className={classes.logo}>
          <Image
            src="/logo.png"
            alt="Manhwa Imperial - Leer Manhwa en Español Online Gratis"
            width={30}
            height={30}
          />
          <Text size="xs" c="dimmed" className={classes.description}>
            Manhwa Imperial: tu biblioteca para leer manhwa en español gratis. 
            Encuentra los mejores manhwas online, manhwa de romance, acción y más webtoons en español.
          </Text>
        </div>
        <div className={classes.groups}>{groups}</div>
      </Container>
      <Container className={classes.afterFooter}>
        <Text c="dimmed" size="sm">
          &copy; {new Date().getFullYear()} Manhwa Imperial
        </Text>

        <Group gap={0} className={classes.social} justify="flex-end" wrap="nowrap">
          <ActionIcon size="lg" color="gray" variant="subtle" aria-label="Twitter">
            <IconBrandTwitter size={18} stroke={1.5} />
          </ActionIcon>
          <ActionIcon size="lg" color="gray" variant="subtle" aria-label="Discord">
            <IconBrandDiscord size={18} stroke={1.5} />
          </ActionIcon>
          <ActionIcon size="lg" color="gray" variant="subtle" aria-label="Instagram">
            <IconBrandInstagram size={18} stroke={1.5} />
          </ActionIcon>
        </Group>
      </Container>
    </footer>
  );
}

export default React.memo(Footer);
