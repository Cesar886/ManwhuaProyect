'use client';

import { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Card,
  Image,
  Text,
  Group,
  Stack,
  Button,
  Box,
  ActionIcon,
  SimpleGrid,
  Avatar,
  Tabs,
  Progress,
  Timeline,
  Modal,
  Skeleton,
  Badge,
  Paper,
  ThemeIcon,
  Tooltip,
  Center,
  useMantineColorScheme,
  Flex,
  rem,
  RingProgress,
} from '@mantine/core';
import { useMediaQuery, useHover } from '@mantine/hooks';
import {
  IconBook,
  IconHeart,
  IconUsers,
  IconEye,
  IconCalendar,
  IconClock,
  IconMapPin,
  IconLink,
  IconCamera,
  IconMail,
  IconChartBar,
  IconTrophy,
  IconFlame,
  IconBookmark,
  IconShare,
  IconSettings,
  IconPencil,
  IconAt,
  IconSparkles,
  IconCrown,
  IconStarFilled,
  IconArrowUpRight,
} from '@tabler/icons-react';
import { getCurrentUser } from '../../lib/api/client';
import { useAuth } from '../../contexts/AuthContext';
import styles from './UserProfile.module.css';

// Stat inline compacto con efecto premium
const InlineStat = ({ value, label, isDark }) => {
  const { hovered, ref } = useHover();

  return (
    <Stack
      gap={2}
      align="center"
      ref={ref}
      className={styles.inlineStat}
      style={{
        cursor: 'default',
        transition: 'transform 0.3s ease',
        transform: hovered ? 'scale(1.05)' : 'scale(1)',
      }}
    >
      <Text
        fw={700}
        size="xl"
        lh={1.2}
        className={hovered ? styles.shimmerText : ''}
        style={!hovered ? { color: isDark ? '#fff' : '#1e293b' } : {}}
      >
        {value}
      </Text>
      <Text size="xs" c="dimmed" tt="uppercase" style={{ letterSpacing: '0.5px' }}>{label}</Text>
    </Stack>
  );
};

// Card de Estadística Premium
const StatCard = ({ icon: Icon, label, value, color = 'cyan', subtext, isDark, compact }) => {
  const { hovered, ref } = useHover();

  const colorRGB = {
    cyan: '6, 182, 212',
    pink: '236, 72, 153',
    violet: '139, 92, 246',
    yellow: '234, 179, 8',
    orange: '249, 115, 22',
    teal: '20, 184, 166',
  };

  return (
    <Paper
      ref={ref}
      p={compact ? 'md' : 'lg'}
      radius="xl"
      className={styles.statCard}
      style={{
        position: 'relative',
        overflow: 'hidden',
        minHeight: compact ? 110 : 130,
        background: `linear-gradient(135deg, rgba(${colorRGB[color] || colorRGB.cyan}, 0.1) 0%, rgba(${colorRGB[color] || colorRGB.cyan}, 0.05) 100%)`,
      }}
    >
      <Group justify="space-between" align="flex-start" wrap="nowrap" style={{ position: 'relative', zIndex: 1 }}>
        <Stack gap={6}>
          <Text
            size={compact ? 'xs' : 'sm'}
            c="dimmed"
            tt="uppercase"
            fw={600}
            style={{ letterSpacing: '0.8px' }}
          >
            {label}
          </Text>
          <Text
            fw={800}
            style={{
              fontSize: compact ? rem(26) : rem(32),
              lineHeight: 1.1,
              color: `rgba(${colorRGB[color] || colorRGB.cyan}, 1)`,
            }}
          >
            {value}
          </Text>
          {subtext && (
            <Text size="xs" c="dimmed" mt={4}>
              {subtext}
            </Text>
          )}
        </Stack>

        <ThemeIcon
          size={compact ? 42 : 50}
          radius="xl"
          variant="light"
          color={color}
          style={{
            backgroundColor: `rgba(${colorRGB[color] || colorRGB.cyan}, ${hovered ? 0.15 : 0.1})`,
            transition: 'all 0.3s ease',
            transform: hovered ? 'scale(1.1)' : 'scale(1)',
          }}
        >
          <Icon size={compact ? 20 : 24} stroke={1.8} />
        </ThemeIcon>
      </Group>
    </Paper>
  );
};

export default function UserProfile() {
  const { user: authUser } = useAuth();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const { colorScheme } = useMantineColorScheme();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isDark = colorScheme === 'dark';

  // Cargar datos del usuario
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        if (authUser) {
          const response = await getCurrentUser();
          setUser(response.data || authUser);
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
        setUser(authUser); // Fallback al usuario de auth
      } finally {
        setLoading(false);
      }
    };

    loadUserProfile();
  }, [authUser]);

  if (loading) {
    return (
      <Container size="xl" py="xl">
        <Grid>
          <Grid.Col span={12}>
            <Paper p="xl" radius="lg">
              <Group>
                <Skeleton height={80} circle />
                <div style={{ flex: 1 }}>
                  <Skeleton height={24} width="40%" mb="sm" />
                  <Skeleton height={16} width="60%" />
                </div>
              </Group>
            </Paper>
          </Grid.Col>
        </Grid>
      </Container>
    );
  }

  if (!user) {
    return (
      <Container size="xl" py="xl">
        <Paper p="xl" radius="lg" style={{ textAlign: 'center' }}>
          <Text>Usuario no encontrado</Text>
        </Paper>
      </Container>
    );
  }

  // Stats ficticios para demo
  const stats = {
    manhwasRead: user.manhwasRead || 42,
    chaptersRead: user.chaptersRead || 1337,
    favorites: user.favorites || 23,
    collections: user.collections || 8,
    joinDate: user.createdAt || new Date().toISOString(),
  };

  return (
    <Container size="xl" py="xl">
      {/* Header del perfil */}
      <Paper
        p="xl"
        radius="xl"
        mb="xl"
        className={styles.profileHeader}
        style={{
          background: isDark 
            ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)'
            : 'linear-gradient(135deg, rgba(6, 182, 212, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%)',
        }}
      >
        <Grid>
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Center>
              <Stack align="center" gap="md">
                <Avatar
                  size={isMobile ? 80 : 120}
                  radius="xl"
                  name={user.displayName || user.username}
                  color="initials"
                  allowedInitialsColors={['cyan', 'pink', 'violet', 'yellow', 'orange', 'teal']}
                  style={{
                    border: '4px solid rgba(6, 182, 212, 0.3)',
                    boxShadow: '0 8px 32px rgba(6, 182, 212, 0.2)',
                  }}
                />
                <Stack gap={4} align="center">
                  <Text fw={700} size="xl" ta="center">
                    {user.displayName || user.username}
                  </Text>
                  <Group gap="xs">
                    <Badge color="cyan" variant="light">Lector</Badge>
                    <Badge color="violet" variant="light">Nivel {user.level || 1}</Badge>
                  </Group>
                  {user.email && (
                    <Text size="sm" c="dimmed" ta="center">
                      <IconAt size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                      {user.email}
                    </Text>
                  )}
                </Stack>
              </Stack>
            </Center>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 8 }}>
            <Stack gap="lg">
              {/* Stats en línea */}
              <Group justify="center" gap="xl">
                <InlineStat value={stats.manhwasRead} label="Manhwas" isDark={isDark} />
                <InlineStat value={stats.chaptersRead} label="Capítulos" isDark={isDark} />
                <InlineStat value={stats.favorites} label="Favoritos" isDark={isDark} />
                <InlineStat value={stats.collections} label="Colecciones" isDark={isDark} />
              </Group>

              {/* Progreso de lectura */}
              <Paper p="md" radius="lg" bg={isDark ? 'dark.7' : 'gray.0'}>
                <Group justify="space-between" mb="xs">
                  <Text size="sm" fw={600}>Progreso de lectura</Text>
                  <Text size="xs" c="dimmed">Mensual</Text>
                </Group>
                <Progress
                  value={75}
                  size="lg"
                  radius="xl"
                  color="cyan"
                  striped
                  animated
                />
                <Text size="xs" c="dimmed" mt="xs">
                  75% del objetivo mensual (20 capítulos)
                </Text>
              </Paper>

              {/* Acciones */}
              <Group>
                <Button
                  variant="gradient"
                  gradient={{ from: 'cyan', to: 'blue' }}
                  leftSection={<IconPencil size={16} />}
                  radius="xl"
                >
                  Editar Perfil
                </Button>
                <Button
                  variant="light"
                  leftSection={<IconShare size={16} />}
                  radius="xl"
                >
                  Compartir
                </Button>
                <ActionIcon size="lg" variant="light" color="gray" radius="xl">
                  <IconSettings size={18} />
                </ActionIcon>
              </Group>
            </Stack>
          </Grid.Col>
        </Grid>
      </Paper>

      {/* Tabs de contenido */}
      <Tabs value={activeTab} onChange={setActiveTab} radius="lg">
        <Tabs.List grow>
          <Tabs.Tab value="overview" leftSection={<IconChartBar size={16} />}>
            Resumen
          </Tabs.Tab>
          <Tabs.Tab value="library" leftSection={<IconBook size={16} />}>
            Biblioteca
          </Tabs.Tab>
          <Tabs.Tab value="activity" leftSection={<IconClock size={16} />}>
            Actividad
          </Tabs.Tab>
          <Tabs.Tab value="achievements" leftSection={<IconTrophy size={16} />}>
            Logros
          </Tabs.Tab>
        </Tabs.List>

        <Box pt="xl">
          <Tabs.Panel value="overview">
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
              <StatCard
                icon={IconBook}
                label="Total Leídos"
                value={stats.manhwasRead}
                color="cyan"
                subtext="+3 este mes"
                isDark={isDark}
                compact={isMobile}
              />
              <StatCard
                icon={IconEye}
                label="Capítulos"
                value={stats.chaptersRead}
                color="violet"
                subtext="+45 este mes"
                isDark={isDark}
                compact={isMobile}
              />
              <StatCard
                icon={IconHeart}
                label="Favoritos"
                value={stats.favorites}
                color="pink"
                subtext="Manhwas guardados"
                isDark={isDark}
                compact={isMobile}
              />
              <StatCard
                icon={IconBookmark}
                label="Colecciones"
                value={stats.collections}
                color="orange"
                subtext="Listas creadas"
                isDark={isDark}
                compact={isMobile}
              />
            </SimpleGrid>

            <Grid mt="xl">
              <Grid.Col span={{ base: 12, md: 8 }}>
                <Paper p="lg" radius="lg">
                  <Text fw={600} size="lg" mb="md">Actividad Reciente</Text>
                  <Timeline active={2} bulletSize={24} lineWidth={2} color="cyan">
                    <Timeline.Item
                      bullet={<IconBook size={12} />}
                      title="Completaste Solo Leveling"
                    >
                      <Text size="sm" c="dimmed">Hace 2 horas</Text>
                    </Timeline.Item>
                    <Timeline.Item
                      bullet={<IconHeart size={12} />}
                      title="Agregaste a favoritos Tower of God"
                    >
                      <Text size="sm" c="dimmed">Hace 1 día</Text>
                    </Timeline.Item>
                    <Timeline.Item
                      bullet={<IconUsers size={12} />}
                      title="Te uniste a la comunidad"
                    >
                      <Text size="sm" c="dimmed">Hace 1 semana</Text>
                    </Timeline.Item>
                  </Timeline>
                </Paper>
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 4 }}>
                <Paper p="lg" radius="lg">
                  <Text fw={600} size="lg" mb="md">Géneros Favoritos</Text>
                  <Stack gap="sm">
                    {[
                      { name: 'Acción', progress: 85, color: 'red' },
                      { name: 'Romance', progress: 70, color: 'pink' },
                      { name: 'Fantasy', progress: 95, color: 'violet' },
                      { name: 'Slice of Life', progress: 60, color: 'teal' },
                    ].map((genre) => (
                      <div key={genre.name}>
                        <Group justify="space-between" mb={5}>
                          <Text size="sm" fw={500}>{genre.name}</Text>
                          <Text size="sm" c="dimmed">{genre.progress}%</Text>
                        </Group>
                        <Progress value={genre.progress} color={genre.color} size="sm" />
                      </div>
                    ))}
                  </Stack>
                </Paper>
              </Grid.Col>
            </Grid>
          </Tabs.Panel>

          <Tabs.Panel value="library">
            <Paper p="xl" radius="lg" style={{ textAlign: 'center' }}>
              <IconBook size={48} style={{ opacity: 0.5, margin: '0 auto 16px' }} />
              <Text fw={600} size="lg" mb="sm">Tu biblioteca está vacía</Text>
              <Text c="dimmed" mb="md">
                Empieza a leer manhwas para que aparezcan aquí
              </Text>
              <Button variant="light">Explorar manhwas</Button>
            </Paper>
          </Tabs.Panel>

          <Tabs.Panel value="activity">
            <Paper p="xl" radius="lg" style={{ textAlign: 'center' }}>
              <IconClock size={48} style={{ opacity: 0.5, margin: '0 auto 16px' }} />
              <Text fw={600} size="lg" mb="sm">Sin actividad reciente</Text>
              <Text c="dimmed">La actividad aparecerá aquí conforme uses la plataforma</Text>
            </Paper>
          </Tabs.Panel>

          <Tabs.Panel value="achievements">
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
              {[
                { title: 'Primer paso', description: 'Leíste tu primer manhwa', icon: IconBook, unlocked: true },
                { title: 'Coleccionista', description: 'Tienes 10 manhwas en favoritos', icon: IconHeart, unlocked: false },
                { title: 'Maratonista', description: 'Leíste 100 capítulos', icon: IconFlame, unlocked: true },
                { title: 'Explorador', description: 'Leíste 5 géneros diferentes', icon: IconSparkles, unlocked: false },
              ].map((achievement, index) => (
                <Card key={index} p="lg" radius="lg" withBorder>
                  <Group>
                    <ThemeIcon
                      size="lg"
                      radius="xl"
                      color={achievement.unlocked ? 'yellow' : 'gray'}
                      variant={achievement.unlocked ? 'filled' : 'light'}
                    >
                      <achievement.icon size={20} />
                    </ThemeIcon>
                    <div>
                      <Text fw={600} size="sm">{achievement.title}</Text>
                      <Text size="xs" c="dimmed">{achievement.description}</Text>
                    </div>
                  </Group>
                </Card>
              ))}
            </SimpleGrid>
          </Tabs.Panel>
        </Box>
      </Tabs>
    </Container>
  );
}