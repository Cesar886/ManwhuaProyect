'use client';

import { Container } from '@mantine/core';
import Header from '@/components/Header';
import Comentarios from '@/components/Comentarios';
import { useAuth } from '@/contexts/AuthContext';
import { useLang } from '@/hooks/useLang';
import styles from './WallClient.module.css';

export default function WallClient({ lang: propLang }) {
  const { lang: routeLang, t } = useLang();
  const lang = propLang || routeLang;
  const auth = useAuth() || {};
  const user = auth.user || null;
  const openLogin = auth.openLogin || (() => {});

  return (
    <>
      <Header lang={lang} />
      <Container size="md" className={styles.page}>
        <Comentarios
          detailRequest={{
            id: '00000000-0000-0000-0000-000000000000',
            targetType: 'wall',
            targetId: '00000000-0000-0000-0000-000000000000',
            title: t.wall?.title,
          }}
          openLogin={openLogin}
          user={user}
          maxReplyDepth={1}
          variant="wall"
          lang={lang}
        />
      </Container>
    </>
  );
}
