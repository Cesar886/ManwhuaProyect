'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Avatar, Badge, Box, Button, Center, Container, Group, Paper,
  SimpleGrid, Skeleton, Stack, Text, ThemeIcon, Title,
} from '@mantine/core';
import {
  IconArrowLeft, IconBookmark, IconBooks, IconCalendar,
  IconLink, IconMapPin, IconMessageCircle, IconStar, IconUsers,
} from '@tabler/icons-react';
import Header from '@/components/Header';
import { api } from '@/lib/api/client';
import styles from './PublicUserProfile.module.css';

const statItems = [
  ['followers', 'Seguidores', IconUsers],
  ['following', 'Siguiendo', IconUsers],
  ['collections', 'Colecciones', IconBooks],
  ['bookmarks', 'Guardados', IconBookmark],
  ['ratings', 'Calificaciones', IconStar],
  ['comments', 'Comentarios', IconMessageCircle],
];

export default function PublicUserProfilePage() {
  const { username: rawUsername } = useParams();
  const username = Array.isArray(rawUsername) ? rawUsername[0] : rawUsername;
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get('users', encodeURIComponent(username), { cache: true, cacheTTL: 30000 });
        if (active) setProfile(response?.data?.user || null);
      } catch (requestError) {
        if (active) setError(requestError?.status === 404 ? 'Este usuario no existe o su perfil no está disponible.' : 'No pudimos cargar este perfil. Inténtalo de nuevo.');
      } finally {
        if (active) setLoading(false);
      }
    };

    if (username) loadProfile();
    return () => { active = false; };
  }, [username]);

  const joinedAt = profile?.joinedAt
    ? new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(new Date(profile.joinedAt))
    : null;
  const safeWebsite = profile?.website && /^https?:\/\//i.test(profile.website) ? profile.website : null;

  return (
    <Box className={styles.page}>
      <Header />
      <Container size="md" className={styles.container}>
        <Button component={Link} href="/home" variant="subtle" color="gray" leftSection={<IconArrowLeft size={16} />} mb="md">
          Volver
        </Button>

        {loading && (
          <Paper className={styles.card} radius="xl" p="xl">
            <Stack align="center">
              <Skeleton circle height={128} />
              <Skeleton height={28} width={220} />
              <Skeleton height={18} width={150} />
              <Skeleton height={70} width="100%" />
            </Stack>
          </Paper>
        )}

        {!loading && error && (
          <Paper className={styles.card} radius="xl" p="xl">
            <Center><Stack align="center"><Title order={2}>Perfil no disponible</Title><Text c="dimmed" ta="center">{error}</Text></Stack></Center>
          </Paper>
        )}

        {!loading && profile && (
          <Stack gap="lg">
            <Paper className={styles.card} radius="xl" p={0}>
              <div className={styles.banner} style={profile.bannerUrl ? { backgroundImage: `url(${profile.bannerUrl})` } : undefined} />
              <Stack align="center" gap="sm" className={styles.identity}>
                <Avatar src={profile.avatarUrl} name={profile.displayName || profile.username} size={128} radius="50%" color="initials" className={styles.avatar} />
                <Group gap="xs" justify="center">
                  <Title order={1} ta="center">{profile.displayName || profile.username}</Title>
                  {profile.isPremium && <Badge variant="gradient" gradient={{ from: 'yellow', to: 'orange' }}>VIP</Badge>}
                </Group>
                <Text c="dimmed">@{profile.username}</Text>
                {profile.bio && <Text ta="center" maw={620} lh={1.7}>{profile.bio}</Text>}
                <Group gap="md" justify="center" c="dimmed">
                  {joinedAt && <Group gap={5}><IconCalendar size={15} /><Text size="sm">Se unió en {joinedAt}</Text></Group>}
                  {profile.location && <Group gap={5}><IconMapPin size={15} /><Text size="sm">{profile.location}</Text></Group>}
                  {safeWebsite && <Group component="a" href={safeWebsite} target="_blank" rel="noopener noreferrer nofollow" gap={5} className={styles.website}><IconLink size={15} /><Text size="sm">Sitio web</Text></Group>}
                </Group>
                <Badge size="lg" variant="light" color="yellow">Nivel {profile.level || 1} · {profile.levelInfo?.name || 'Lector'}</Badge>
              </Stack>
            </Paper>

            <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="md">
              {statItems.map(([key, label, Icon]) => (
                <Paper key={key} className={styles.stat} radius="lg" p="lg">
                  <Group wrap="nowrap">
                    <ThemeIcon variant="light" color="yellow" radius="xl" size="lg"><Icon size={19} /></ThemeIcon>
                    <div><Text fw={800} size="xl">{Number(profile.stats?.[key] || 0).toLocaleString('es-MX')}</Text><Text size="xs" c="dimmed">{label}</Text></div>
                  </Group>
                </Paper>
              ))}
            </SimpleGrid>
          </Stack>
        )}
      </Container>
    </Box>
  );
}
