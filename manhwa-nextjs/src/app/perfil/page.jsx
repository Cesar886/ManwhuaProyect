"use client";

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
  Transition,
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
import { getCurrentUser } from '@/api/client';
import styles from '@/app/user-profile/UserProfile.module.css';

// ============================================
// COMPONENTES AUXILIARES PREMIUM
// ============================================

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

// Card de Estadística Premium - MEJORADA PARA MOBILE
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

  const colorStyles = {
    cyan: styles.statCardCyan,
    pink: styles.statCardPink,
    violet: styles.statCardViolet,
    yellow: styles.statCardYellow,
    orange: styles.statCardOrange,
    teal: styles.statCardTeal,
  };

  return (
    <Paper
      ref={ref}
      p={compact ? 'md' : 'lg'}
      radius="xl"
      className={`${styles.statCard} ${colorStyles[color] || styles.statCardCyan}`}
      style={{
        position: 'relative',
        overflow: 'hidden',
        minHeight: compact ? 110 : 130,
      }}
    >
      {/* Efecto de brillo en hover */}
      <Box
        className={styles.statCardGlow}
        style={{
          background: `radial-gradient(circle at ${hovered ? '50%' : '0%'} 0%, rgba(${colorRGB[color] || colorRGB.cyan}, ${hovered ? 0.25 : 0}) 0%, transparent 50%)`,
        }}
      />

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
            className={styles.statValue}
            style={{
              fontSize: compact ? rem(26) : rem(32),
              background: `linear-gradient(135deg, var(--mantine-color-${color}-4) 0%, var(--mantine-color-${color}-6) 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {value}
          </Text>
          {subtext && (
            <Text size="xs" c="dimmed" style={{ opacity: 0.8 }}>{subtext}</Text>
          )}
        </Stack>
        <ThemeIcon
          size={compact ? 44 : 52}
          radius="xl"
          variant="gradient"
          gradient={{ from: color, to: color === 'cyan' ? 'teal' : color === 'pink' ? 'grape' : color === 'violet' ? 'indigo' : color, deg: 135 }}
          className={styles.statIcon}
          style={{
            boxShadow: `0 6px 20px rgba(${colorRGB[color] || colorRGB.cyan}, 0.4)`,
            transform: hovered ? 'scale(1.15) rotate(8deg)' : 'scale(1)',
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <Icon size={compact ? 22 : 26} stroke={1.5} />
        </ThemeIcon>
      </Group>
    </Paper>
  );
};

// Card de Colección Premium
const CollectionCardPreview = ({ collection, isDark }) => {
  const { hovered, ref } = useHover();

  return (
    <Card
      ref={ref}
      p={0}
      radius="xl"
      className={`${styles.collectionCard} ${isDark ? styles.darkMode : styles.lightMode}`}
    >
      <Box style={{ position: 'relative', overflow: 'hidden' }}>
        <Image
          src={collection.image}
          alt={`Vista previa de la colección de manhwas "${collection.name}" del usuario en Manhwa Imperial`}
          height={130}
          style={{
            objectFit: 'cover',
            transition: 'transform 0.5s ease',
            transform: hovered ? 'scale(1.1)' : 'scale(1)',
          }}
        />
        <Box className={styles.collectionCardOverlay} />
        <Badge
          color="cyan"
          variant="filled"
          size="sm"
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
          }}
        >
          {collection.items} obras
        </Badge>
      </Box>
      <Stack p="md" gap={6}>
        <Text size="sm" fw={700} lineClamp={1}>{collection.name}</Text>
        <Group justify="space-between">
          <Group gap={6}>
            <IconHeart size={14} style={{ color: 'var(--mantine-color-pink-5)' }} />
            <Text size="xs" c="dimmed" fw={500}>{collection.likes}</Text>
          </Group>
          <ActionIcon
            variant="subtle"
            color="cyan"
            size="sm"
            style={{
              opacity: hovered ? 1 : 0,
              transition: 'opacity 0.3s ease',
            }}
          >
            <IconArrowUpRight size={14} />
          </ActionIcon>
        </Group>
      </Stack>
    </Card>
  );
};

// Botón Premium
const PremiumButton = ({ children, variant = 'filled', color = 'cyan', leftSection, isDark, ...props }) => {
  const { hovered, ref } = useHover();

  if (variant === 'filled') {
    return (
      <Button
        ref={ref}
        color={color}
        radius="xl"
        leftSection={leftSection}
        className={styles.buttonPrimary}
        style={{
          boxShadow: hovered
            ? `0 8px 25px rgba(6, 182, 212, 0.5), 0 0 0 1px rgba(6, 182, 212, 0.3)`
            : '0 4px 15px rgba(6, 182, 212, 0.25)',
          transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        {...props}
      >
        {children}
      </Button>
    );
  }

  return (
    <Button
      ref={ref}
      variant="default"
      radius="xl"
      leftSection={leftSection}
      className={styles.buttonOutline}
      style={{
        border: `1px solid ${isDark ? 'rgba(6, 182, 212, 0.4)' : 'rgba(6, 182, 212, 0.5)'}`,
        background: hovered ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        color: isDark ? 'var(--mantine-color-cyan-4)' : 'var(--mantine-color-cyan-7)',
      }}
      {...props}
    >
      {children}
    </Button>
  );
};

// Avatar Premium con anillo animado
const PremiumAvatar = ({ src, size, initials, streak, onCameraClick, isDark }) => {
  const { hovered, ref } = useHover();

  return (
    <Box pos="relative" ref={ref} className={styles.avatarContainer}>
      <Box className={styles.avatarRing} style={{ opacity: hovered ? 1 : 0.8 }} />
      <Box
        className={styles.avatarRingInner}
        style={{ background: isDark ? '#0f172a' : '#ffffff' }}
      />
      <Avatar
        src={src}
        size={size}
        radius="50%"
        className={styles.avatarNormal}
        style={{
          position: 'relative',
          zIndex: 1,
          boxShadow: '0 10px 40px rgba(6, 182, 212, 0.3)',
          transition: 'transform 0.3s ease',
          transform: hovered ? 'scale(1.05)' : 'scale(1)',
        }}
      >
        {initials}
      </Avatar>

      <Tooltip label="Cambiar avatar" withArrow>
        <ActionIcon
          variant="gradient"
          gradient={{ from: 'cyan', to: 'teal', deg: 135 }}
          size="lg"
          radius="xl"
          pos="absolute"
          bottom={4}
          right={4}
          onClick={onCameraClick}
          className={styles.avatarCameraButton}
          style={{
            border: `3px solid ${isDark ? '#0f172a' : '#ffffff'}`,
            zIndex: 2,
            transform: hovered ? 'scale(1.1)' : 'scale(1)',
          }}
        >
          <IconCamera size={16} />
        </ActionIcon>
      </Tooltip>

      {streak > 0 && (
        <Tooltip label={`🔥 Racha de ${streak} días`} withArrow>
          <Badge
            color="orange"
            variant="gradient"
            gradient={{ from: 'orange', to: 'red', deg: 135 }}
            size="md"
            leftSection={<IconFlame size={12} />}
            pos="absolute"
            top={-8}
            right={-12}
            className={styles.avatarBadge}
            style={{
              boxShadow: '0 4px 15px rgba(249, 115, 22, 0.4)',
              border: `2px solid ${isDark ? '#0f172a' : '#ffffff'}`,
              zIndex: 3,
            }}
          >
            {streak}
          </Badge>
        </Tooltip>
      )}
    </Box>
  );
};

// Loading Skeleton Premium
const ProfileSkeleton = ({ isDark, isMobile }) => (
  <Box className={`${styles.skeletonContainer} ${isDark ? styles.darkMode : styles.lightMode}`} style={{ minHeight: '100vh', padding: isMobile ? '1rem' : '2rem' }}>
    <Container size="lg">
      <Paper p={isMobile ? 'md' : 'xl'} radius="xl" className={styles.skeletonCard}>
        <Stack align="center" gap="lg">
          <Skeleton height={isMobile ? 100 : 140} width={isMobile ? 100 : 140} circle style={{ opacity: 0.5 }} />
          <Skeleton height={28} width={180} radius="xl" style={{ opacity: 0.5 }} />
          <Skeleton height={18} width={120} radius="xl" style={{ opacity: 0.3 }} />
          <Group gap="xl" justify="center" mt="md">
            <Skeleton height={50} width={70} radius="lg" style={{ opacity: 0.4 }} />
            <Skeleton height={50} width={70} radius="lg" style={{ opacity: 0.4 }} />
            <Skeleton height={50} width={70} radius="lg" style={{ opacity: 0.4 }} />
          </Group>
        </Stack>
      </Paper>
    </Container>
  </Box>
);

// ============================================
// COMPONENTE PRINCIPAL
// ============================================
export default function UserProfile() {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  const isMobile = useMediaQuery('(max-width: 48em)');
  const isTablet = useMediaQuery('(min-width: 48em) and (max-width: 64em)');
  const isDesktop = !isMobile && !isTablet;

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [avatars, setAvatars] = useState([]);
  const [openAvatarPicker, setOpenAvatarPicker] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState(null);
  const [activeTab, setActiveTab] = useState('collections');

  useEffect(() => {
    import('@/api/client').then(mod => {
      const api = mod.default;
      api.get('upload', 'default-avatars')
        .then(res => setAvatars(res?.data?.avatars || res?.avatars || []))
        .catch(() => setAvatars([]));
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    getCurrentUser()
      .then(res => {
        const data = res?.data?.user || res?.user || res?.data || res;
        if (data) setUser(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const getInitials = () => {
    if (!user) return 'U';
    const name = user.display_name || user.name || user.username || 'U';
    const parts = String(name).split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'U';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  if (loading) return <ProfileSkeleton isDark={isDark} isMobile={isMobile} />;

  if (!user) {
    return (
      <Box className={`${styles.pageContainer} ${isDark ? styles.darkMode : styles.lightMode}`}>
        <Container size="sm" pt="xl">
          <Paper p="xl" radius="xl" ta="center" className={styles.errorCard}>
            <ThemeIcon size={80} radius="xl" variant="light" color="cyan" mb="lg" style={{ margin: '0 auto' }}>
              <IconUsers size={40} stroke={1.5} />
            </ThemeIcon>
            <Text size="lg" fw={600} mb="xs">No se pudo cargar el perfil</Text>
            <Text c="dimmed" mb="xl" size="sm">Hubo un problema al obtener tus datos</Text>
            <PremiumButton onClick={() => window.location.reload()} isDark={isDark}>
              Reintentar
            </PremiumButton>
          </Paper>
        </Container>
      </Box>
    );
  }

  const userName = user.display_name || user.name || user.username || 'Usuario';
  const userUsername = user.username || 'usuario';
  const userBio = user.bio || 'Sin biografía';
  const userEmail = user.email || '';
  const userLocation = user.location || '';
  const userJoinDate = user.created_at || user.createdAt || new Date().toISOString();
  const userRole = user.role || 'reader';

  const avatarProfile = (
    <Avatar
      name={userName}
      color="initials"
      allowedInitialsColors={['blue', 'red', 'cyan', 'indigo', 'pink', 'violet']}
    />
  );

  const stats = {
    followers: user.followers_count || user.stats?.followers || 0,
    following: user.following_count || user.stats?.following || 0,
    collections: user.collections_count || user.stats?.collections || 0,
    likes: user.likes_count || user.stats?.likes || 0,
    views: user.views_count || user.stats?.views || 0,
    chapters: user.chapters_read || 0,
    streak: user.current_streak || 0,
  };

  const collections = user.collections || [];
  const activity = user.activity || [];

  const formatNum = (n) => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(n);

  const roleBadges = {
    superadmin: { label: 'Super Admin', color: 'red', icon: IconCrown, gradient: { from: 'red', to: 'pink' } },
    admin: { label: 'Admin', color: 'orange', icon: IconCrown, gradient: { from: 'orange', to: 'yellow' } },
    moderator: { label: 'Mod', color: 'violet', icon: IconStarFilled, gradient: { from: 'violet', to: 'grape' } },
    translator: { label: 'Traductor', color: 'blue', icon: IconSparkles, gradient: { from: 'blue', to: 'cyan' } },
    vip: { label: 'VIP', color: 'yellow', icon: IconSparkles, gradient: { from: 'yellow', to: 'orange' } },
    reader: { label: 'Lector', color: 'gray', icon: IconBook, gradient: { from: 'gray', to: 'dark' } },
  };
  const role = roleBadges[userRole] || roleBadges.reader;
  const RoleIcon = role.icon;

  const avatarSize = isMobile ? 100 : isTablet ? 120 : 140;

  return (
    <Box className={`${styles.pageContainer} ${isDark ? styles.darkMode : styles.lightMode}`}>
      <Container size="lg" px={isMobile ? 'sm' : 'md'} pt={isMobile ? 'md' : 'xl'}>

        {/* HEADER CARD */}
        <Paper
          p={isMobile ? 'lg' : 'xl'}
          radius={rem(24)}
          mb="xl"
          className={styles.headerCard}
        >
          <Box className={styles.headerDecoration1} />
          <Box className={styles.headerDecoration2} />

          {/* MOBILE LAYOUT */}
          {isMobile && (
            <Stack align="center" gap="lg" style={{ position: 'relative', zIndex: 1 }}>
              <PremiumAvatar
                src={avatarSrc}
                size={avatarSize}
                initials={getInitials()}
                streak={stats.streak}
                onCameraClick={() => setOpenAvatarPicker(true)}
                isDark={isDark}
              />

              <Stack gap={6} align="center">
                <Group gap="xs" justify="center" wrap="nowrap">
                  <Text fw={800} size="xl" className={styles.gradientText}>
                    {userName}
                  </Text>
                  <Badge
                    variant="gradient"
                    gradient={role.gradient}
                    size="sm"
                    leftSection={<RoleIcon size={10} />}
                    className={styles.roleBadge}
                  >
                    {role.label}
                  </Badge>
                </Group>
                <Text size="sm" c="dimmed" fw={500}>@{userUsername}</Text>
              </Stack>

              <Text size="sm" c="dimmed" ta="center" maw={300} lh={1.5} style={{ opacity: 0.9 }}>
                {userBio}
              </Text>

              <Group gap={rem(32)} justify="center" py="xs">
                <InlineStat value={formatNum(stats.followers)} label="Seguidores" isDark={isDark} />
                <Box className={styles.statDivider} />
                <InlineStat value={formatNum(stats.following)} label="Siguiendo" isDark={isDark} />
                <Box className={styles.statDivider} />
                <InlineStat value={formatNum(stats.chapters)} label="Capítulos" isDark={isDark} />
              </Group>

              <Group gap="sm" justify="center" w="100%">
                <PremiumButton leftSection={<IconPencil size={16} />} style={{ flex: 1, maxWidth: 140 }} isDark={isDark}>
                  Editar
                </PremiumButton>
                <PremiumButton variant="outline" leftSection={<IconShare size={16} />} style={{ flex: 1, maxWidth: 140 }} isDark={isDark}>
                  Compartir
                </PremiumButton>
              </Group>
            </Stack>
          )}

          {/* TABLET LAYOUT */}
          {isTablet && (
            <Stack gap="xl" style={{ position: 'relative', zIndex: 1 }}>
              <Group gap="xl" align="flex-start">
                <PremiumAvatar
                  src={avatarSrc}
                  size={avatarSize}
                  initials={getInitials()}
                  streak={stats.streak}
                  onCameraClick={() => setOpenAvatarPicker(true)}
                  isDark={isDark}
                />

                <Stack gap="sm" style={{ flex: 1 }}>
                  <Group gap="sm">
                    <Text fw={800} size={rem(28)} className={styles.gradientText}>
                      {userName}
                    </Text>
                    <Badge
                      variant="gradient"
                      gradient={role.gradient}
                      size="md"
                      leftSection={<RoleIcon size={12} />}
                      className={styles.roleBadge}
                    >
                      {role.label}
                    </Badge>
                  </Group>
                  <Text size="md" c="dimmed" fw={500}>@{userUsername}</Text>
                  <Text size="sm" style={{ opacity: 0.85 }} maw={450} lh={1.5}>{userBio}</Text>
                  <Group gap="lg" mt={4}>
                    {userLocation && (
                      <Group gap={6}>
                        <ThemeIcon size="xs" variant="light" color="cyan" radius="xl">
                          <IconMapPin size={10} />
                        </ThemeIcon>
                        <Text size="sm" c="dimmed">{userLocation}</Text>
                      </Group>
                    )}
                    <Group gap={6}>
                      <ThemeIcon size="xs" variant="light" color="violet" radius="xl">
                        <IconCalendar size={10} />
                      </ThemeIcon>
                      <Text size="sm" c="dimmed">
                        Desde {new Date(userJoinDate).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' })}
                      </Text>
                    </Group>
                  </Group>
                </Stack>
              </Group>

              <Group justify="space-between" align="center">
                <Group gap={rem(48)}>
                  <InlineStat value={formatNum(stats.followers)} label="Seguidores" isDark={isDark} />
                  <InlineStat value={formatNum(stats.following)} label="Siguiendo" isDark={isDark} />
                  <InlineStat value={formatNum(stats.chapters)} label="Capítulos" isDark={isDark} />
                </Group>
                <Group gap="sm">
                  <PremiumButton leftSection={<IconPencil size={16} />} isDark={isDark}>Editar perfil</PremiumButton>
                  <PremiumButton variant="outline" leftSection={<IconShare size={16} />} isDark={isDark}>Compartir</PremiumButton>
                  <ActionIcon variant="subtle" color="gray" size="lg" radius="xl" className={styles.settingsButton}>
                    <IconSettings size={20} />
                  </ActionIcon>
                </Group>
              </Group>
            </Stack>
          )}

          {/* DESKTOP LAYOUT */}
          {isDesktop && (
            <Flex justify="space-between" align="flex-start" gap="xl" style={{ position: 'relative', zIndex: 1 }}>
              <Group gap="xl" align="flex-start" style={{ flex: 1 }}>
                <PremiumAvatar
                  src={avatarSrc}
                  size={avatarSize}
                  initials={getInitials()}
                  streak={stats.streak}
                  onCameraClick={() => setOpenAvatarPicker(true)}
                  isDark={isDark}
                />

                <Stack gap="sm" style={{ flex: 1 }}>
                  <Group gap="md">
                    <Text fw={800} size={rem(32)} lh={1.2} className={styles.gradientText}>
                      {userName}
                    </Text>
                    <Badge
                      variant="gradient"
                      gradient={role.gradient}
                      size="lg"
                      leftSection={<RoleIcon size={14} />}
                      className={styles.roleBadge}
                    >
                      {role.label}
                    </Badge>
                  </Group>
                  <Text size="md" c="dimmed" fw={500}>@{userUsername}</Text>
                  <Text size="md" maw={500} style={{ opacity: 0.85 }} lh={1.6}>{userBio}</Text>

                  <Group gap="xl" mt="sm">
                    {userLocation && (
                      <Group gap={8}>
                        <ThemeIcon size="sm" variant="light" color="cyan" radius="xl">
                          <IconMapPin size={12} />
                        </ThemeIcon>
                        <Text size="sm" c="dimmed">{userLocation}</Text>
                      </Group>
                    )}
                    <Group gap={8}>
                      <ThemeIcon size="sm" variant="light" color="violet" radius="xl">
                        <IconCalendar size={12} />
                      </ThemeIcon>
                      <Text size="sm" c="dimmed">
                        Se unió en {new Date(userJoinDate).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
                      </Text>
                    </Group>
                  </Group>

                  <Group gap={rem(48)} mt="lg">
                    <InlineStat value={formatNum(stats.followers)} label="Seguidores" isDark={isDark} />
                    <InlineStat value={formatNum(stats.following)} label="Siguiendo" isDark={isDark} />
                    <InlineStat value={formatNum(stats.chapters)} label="Capítulos" isDark={isDark} />
                  </Group>
                </Stack>
              </Group>

              <Stack gap="sm" align="flex-end">
                <PremiumButton leftSection={<IconPencil size={16} />} isDark={isDark}>Editar perfil</PremiumButton>
                <PremiumButton variant="outline" leftSection={<IconShare size={16} />} isDark={isDark}>Compartir</PremiumButton>
                <Tooltip label="Configuración" withArrow position="left">
                  <ActionIcon variant="light" color="gray" size="lg" radius="xl" mt="xs" className={styles.settingsButton}>
                    <IconSettings size={20} />
                  </ActionIcon>
                </Tooltip>
              </Stack>
            </Flex>
          )}
        </Paper>

        {/* STATS CARDS - MEJORADAS */}
        <SimpleGrid
          cols={{ base: 2, sm: 4 }}
          spacing={isMobile ? 'md' : 'lg'}
          mb="xl"
          className={styles.statsGrid}
        >
          <StatCard icon={IconBook} label="Colecciones" value={stats.collections} color="cyan" subtext="creadas" isDark={isDark} compact={isMobile} />
          <StatCard icon={IconHeart} label="Likes" value={formatNum(stats.likes)} color="pink" isDark={isDark} compact={isMobile} />
          <StatCard icon={IconEye} label="Vistas" value={formatNum(stats.views)} color="violet" isDark={isDark} compact={isMobile} />
          <StatCard icon={IconTrophy} label="Logros" value="0" color="yellow" subtext="próximamente" isDark={isDark} compact={isMobile} />
        </SimpleGrid>

        {/* INFO CARDS */}
        <Grid gutter={isMobile ? 'md' : 'lg'} mb="xl">
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Paper p={isMobile ? 'md' : 'lg'} radius="xl" h="100%" className={`${styles.infoCard} ${isDark ? styles.darkMode : styles.lightMode}`}>
              <Group gap="xs" mb="lg">
                <ThemeIcon size="lg" radius="xl" variant="gradient" gradient={{ from: 'cyan', to: 'teal', deg: 135 }}>
                  <IconUsers size={18} />
                </ThemeIcon>
                <Text fw={700} size="lg">Información</Text>
              </Group>
              <Stack gap="md">
                {userEmail && (
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap="xs">
                      <ThemeIcon size="xs" variant="light" color="cyan" radius="xl">
                        <IconMail size={10} />
                      </ThemeIcon>
                      <Text size="sm" c="dimmed">Correo</Text>
                    </Group>
                    <Text size="sm" fw={600} truncate maw={isMobile ? 140 : 200}>{userEmail}</Text>
                  </Group>
                )}
                <Group justify="space-between">
                  <Group gap="xs">
                    <ThemeIcon size="xs" variant="light" color="violet" radius="xl">
                      <IconCalendar size={10} />
                    </ThemeIcon>
                    <Text size="sm" c="dimmed">Miembro desde</Text>
                  </Group>
                  <Text size="sm" fw={600}>
                    {new Date(userJoinDate).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Group gap="xs">
                    <ThemeIcon size="xs" variant="light" color="orange" radius="xl">
                      <IconFlame size={10} />
                    </ThemeIcon>
                    <Text size="sm" c="dimmed">Racha actual</Text>
                  </Group>
                  <Badge
                    variant="gradient"
                    gradient={stats.streak > 0 ? { from: 'orange', to: 'red' } : { from: 'gray', to: 'dark' }}
                    size="md"
                  >
                    {stats.streak} días
                  </Badge>
                </Group>
              </Stack>
            </Paper>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 6 }}>
            <Paper p={isMobile ? 'md' : 'lg'} radius="xl" h="100%" className={`${styles.infoCard} ${isDark ? styles.darkMode : styles.lightMode}`}>
              <Group gap="xs" mb="lg">
                <ThemeIcon size="lg" radius="xl" variant="gradient" gradient={{ from: 'violet', to: 'grape', deg: 135 }}>
                  <IconChartBar size={18} />
                </ThemeIcon>
                <Text fw={700} size="lg">Progreso</Text>
              </Group>
              <Stack gap="lg">
                <Box>
                  <Group justify="space-between" mb={8}>
                    <Text size="sm" fw={500}>Likes recibidos</Text>
                    <Text size="xs" c="dimmed" fw={600}>{formatNum(stats.likes)}</Text>
                  </Group>
                  <Progress value={Math.min((stats.likes / 100) * 100, 100)} color="pink" size="md" radius="xl" className={styles.progressBar} />
                </Box>
                <Box>
                  <Group justify="space-between" mb={8}>
                    <Text size="sm" fw={500}>Capítulos leídos</Text>
                    <Text size="xs" c="dimmed" fw={600}>{formatNum(stats.chapters)}</Text>
                  </Group>
                  <Progress value={Math.min((stats.chapters / 1000) * 100, 100)} color="cyan" size="md" radius="xl" className={styles.progressBar} />
                </Box>
                <Box>
                  <Group justify="space-between" mb={8}>
                    <Text size="sm" fw={500}>Colecciones</Text>
                    <Text size="xs" c="dimmed" fw={600}>{stats.collections}/5</Text>
                  </Group>
                  <Progress value={(stats.collections / 5) * 100} color="teal" size="md" radius="xl" className={styles.progressBar} />
                </Box>
              </Stack>
            </Paper>
          </Grid.Col>
        </Grid>

        {/* TABS PREMIUM */}
        <Tabs
          value={activeTab}
          onChange={setActiveTab}
          variant="pills"
          radius="xl"
          classNames={{ tab: styles.tab, tabLabel: styles.tabLabel }}
        >
          <Tabs.List mb="xl" justify={isMobile ? 'center' : 'flex-start'} className={styles.tabsContainer}>
            <Tabs.Tab value="collections" leftSection={<IconBook size={16} />} px={isMobile ? 'md' : 'lg'}>
              {isMobile ? stats.collections : `Colecciones (${stats.collections})`}
            </Tabs.Tab>
            <Tabs.Tab value="bookmarks" leftSection={<IconBookmark size={16} />} px={isMobile ? 'md' : 'lg'}>
              {isMobile ? '' : 'Guardados'}
            </Tabs.Tab>
            <Tabs.Tab value="activity" leftSection={<IconClock size={16} />} px={isMobile ? 'md' : 'lg'}>
              {isMobile ? '' : 'Actividad'}
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="collections">
            {collections.length > 0 ? (
              <SimpleGrid cols={{ base: 2, sm: 2, md: 3, lg: 4 }} spacing={isMobile ? 'sm' : 'md'}>
                {collections.map(c => <CollectionCardPreview key={c.id} collection={c} isDark={isDark} />)}
              </SimpleGrid>
            ) : (
              <Paper p="xl" radius="xl" ta="center" className={`${styles.emptyState} ${isDark ? styles.darkMode : styles.lightMode}`}>
                <ThemeIcon size={70} radius="xl" variant="light" color="cyan" mb="lg" className={styles.emptyStateIcon}>
                  <IconBook size={35} stroke={1.5} />
                </ThemeIcon>
                <Text fw={600} size="lg" mb="xs" className={styles.emptyStateTitle}>No tienes colecciones</Text>
                <Text c="dimmed" size="sm" mb="xl" maw={300} mx="auto" className={styles.emptyStateText}>
                  Crea tu primera colección para organizar tus manhwas favoritos
                </Text>
                <PremiumButton leftSection={<IconSparkles size={16} />} isDark={isDark}>
                  Crear colección
                </PremiumButton>
              </Paper>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="bookmarks">
            <Paper p="xl" radius="xl" ta="center" className={`${styles.emptyState} ${isDark ? styles.darkMode : styles.lightMode}`}>
              <ThemeIcon size={70} radius="xl" variant="light" color="violet" mb="lg" className={styles.emptyStateIcon}>
                <IconBookmark size={35} stroke={1.5} />
              </ThemeIcon>
              <Text fw={600} size="lg" mb="xs" className={styles.emptyStateTitle}>No tienes guardados</Text>
              <Text c="dimmed" size="sm" maw={300} mx="auto" className={styles.emptyStateText}>
                Guarda capítulos y series para leerlos más tarde
              </Text>
            </Paper>
          </Tabs.Panel>

          <Tabs.Panel value="activity">
            <Paper p={isMobile ? 'md' : 'xl'} radius="xl" className={`${styles.activityCard} ${isDark ? styles.darkMode : styles.lightMode}`}>
              {activity.length > 0 ? (
                <Timeline active={-1} bulletSize={28} lineWidth={2} color="cyan" classNames={{ itemBullet: styles.timelineBullet }}>
                  {activity.map((item, i) => (
                    <Timeline.Item
                      key={i}
                      bullet={<IconClock size={14} />}
                      title={<Text size="sm" fw={600} className={styles.timelineTitle}>{item.action || 'Actividad'}</Text>}
                    >
                      <Text size="xs" c="dimmed" className={styles.timelineDate}>{item.date || ''}</Text>
                    </Timeline.Item>
                  ))}
                </Timeline>
              ) : (
                <Center py="xl">
                  <Stack align="center" gap="sm">
                    <ThemeIcon size={60} radius="xl" variant="light" color="gray">
                      <IconClock size={30} stroke={1.5} />
                    </ThemeIcon>
                    <Text fw={600} size="lg" className={styles.emptyStateTitle}>Sin actividad reciente</Text>
                    <Text c="dimmed" size="sm">Tu actividad de lectura aparecerá aquí</Text>
                  </Stack>
                </Center>
              )}
            </Paper>
          </Tabs.Panel>
        </Tabs>
      </Container>

      {/* MODAL AVATARES */}
      <Modal
        opened={openAvatarPicker}
        onClose={() => setOpenAvatarPicker(false)}
        title={
          <Group gap="xs">
            <ThemeIcon size="md" radius="xl" variant="gradient" gradient={{ from: 'cyan', to: 'teal' }}>
              <IconCamera size={14} />
            </ThemeIcon>
            <Text fw={700}>Seleccionar avatar</Text>
          </Group>
        }
        centered
        radius="xl"
        size={isMobile ? 'sm' : 'md'}
        overlayProps={{ backgroundOpacity: 0.6, blur: 10 }}
        classNames={{ content: `${styles.modalContent} ${isDark ? styles.darkMode : styles.lightMode}`, header: styles.modalHeader }}
      >
        <SimpleGrid cols={isMobile ? 3 : 4} spacing="sm">
          {avatars.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl" style={{ gridColumn: '1 / -1' }}>
              No hay avatares disponibles
            </Text>
          ) : avatars.map((a, i) => {
            const AvatarCard = () => {
              const { hovered, ref } = useHover();
              return (
                <Card
                  ref={ref}
                  key={i}
                  p={6}
                  radius="lg"
                  className={styles.avatarPickerItem}
                  style={{
                    border: `2px solid ${hovered ? 'var(--mantine-color-cyan-5)' : 'transparent'}`,
                    transform: hovered ? 'scale(1.05)' : 'scale(1)',
                    boxShadow: hovered ? '0 8px 25px rgba(6, 182, 212, 0.3)' : 'none',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                  onClick={async () => {
                    try {
                      const { default: api } = await import('@/api/client');
                      await api.put('users', 'avatar', { avatarUrl: a });
                      setOpenAvatarPicker(false);
                      setUser(prev => ({ ...prev, avatar_url: a }));
                    } catch (e) { console.error(e); }
                  }}
                >
                  {avatarProfile}
                </Card>
              );
            };
            return <AvatarCard key={i} />;
          })}
        </SimpleGrid>
      </Modal>
    </Box>
  );
}