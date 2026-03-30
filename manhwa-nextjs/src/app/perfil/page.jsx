"use client";

import { useState, useEffect, useCallback } from 'react';
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
  Progress,
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
  TextInput,
  Textarea,
} from '@mantine/core';
import { useMediaQuery, useHover } from '@mantine/hooks';
import { useAuth } from '@/contexts/AuthContext';
import {
  IconBook,
  IconHeart,
  IconUsers,
  IconCalendar,
  IconMapPin,
  IconCamera,
  IconMail,
  IconFlame,
  IconShare,
  IconSettings,
  IconPencil,
  IconSparkles,
  IconCrown,
  IconStarFilled,
  IconArrowUpRight,
  IconCheck,
  IconTrophy,
  IconLock,
  IconStar,
  IconMoon,
  IconMessage,
  IconBolt,
  IconShield,
  IconSword,
  IconDiamond,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { getCurrentUser } from '@/api/client';
import { getRecentProgress, getStreak } from '@/api/progress';
import styles from '@/app/user-profile/UserProfile.module.css';
import Link from 'next/link';
import Header from '@/components/Header';

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
  const { updateProfile } = useAuth();

  const isMobile = useMediaQuery('(max-width: 48em)');

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [avatars, setAvatars] = useState([]);
  const [openAvatarPicker, setOpenAvatarPicker] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState(null);
  const [copied, setCopied] = useState(false);
  const [recentReads, setRecentReads] = useState([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [streakData, setStreakData] = useState({ streak: 0, maxStreak: 0, readToday: false, chaptersRead: 0, totalDaysRead: 0 });
  const streak = streakData.streak;

  // Edit profile modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ display_name: '', bio: '', location: '' });
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    getCurrentUser()
      .then(res => {
        const data = res?.data?.user || res?.user || res?.data || res;
        if (data) {
          setUser(data);
          setAvatarSrc(data.avatar_url || data.avatar || null);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    getRecentProgress(6)
      .then(data => setRecentReads(Array.isArray(data) ? data : []))
      .catch(() => setRecentReads([]))
      .finally(() => setRecentLoading(false));

    getStreak()
      .then(data => setStreakData({
        streak: data?.streak || 0,
        maxStreak: data?.maxStreak || 0,
        readToday: data?.readToday || false,
        chaptersRead: data?.chaptersRead || 0,
        totalDaysRead: data?.totalDaysRead || 0,
      }))
      .catch(() => setStreakData({ streak: 0, maxStreak: 0, readToday: false, chaptersRead: 0, totalDaysRead: 0 }));
  }, []);

  const getInitials = () => {
    if (!user) return 'U';
    const name = user.display_name || user.name || user.username || 'U';
    const parts = String(name).split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'U';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const openEditModal = useCallback(() => {
    if (!user) return;
    setEditForm({
      display_name: user.display_name || user.name || user.username || '',
      bio: user.bio || '',
      location: user.location || '',
    });
    setEditOpen(true);
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setEditSaving(true);
    try {
      const userId = user.id || user._id;
      await updateProfile(userId, {
        display_name: editForm.display_name.trim(),
        bio: editForm.bio.trim(),
        location: editForm.location.trim(),
      });
      setUser(prev => ({
        ...prev,
        display_name: editForm.display_name.trim(),
        bio: editForm.bio.trim(),
        location: editForm.location.trim(),
      }));
      setEditOpen(false);
      notifications.show({ title: 'Perfil actualizado', message: 'Tus cambios se guardaron correctamente', color: 'cyan', icon: <IconCheck size={16} /> });
    } catch {
      notifications.show({ title: 'Error', message: 'No se pudo actualizar tu perfil', color: 'red' });
    } finally {
      setEditSaving(false);
    }
  };

  const handleShare = async () => {
    const name = user?.display_name || user?.name || user?.username || 'Usuario';
    const profileUrl = `${window.location.origin}/perfil`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Perfil de ${name} - Manhwa Imperial`, url: profileUrl });
      } catch {}
    } else {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      notifications.show({ title: 'Enlace copiado', message: 'El enlace de tu perfil se copió al portapapeles', color: 'cyan', icon: <IconCheck size={16} /> });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Ahora mismo';
    if (mins < 60) return `Hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Hace ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `Hace ${days}d`;
    return new Date(dateStr).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
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

  const stats = {
    followers: user.followers_count || user.stats?.followers || 0,
    following: user.following_count || user.stats?.following || 0,
    collections: user.collections_count || user.stats?.collections || 0,
    likes: user.likes_count || user.stats?.likes || 0,
    views: user.views_count || user.stats?.views || 0,
    chapters: streakData.chaptersRead || user.chapters_read || user.reading_count || 0,
    streak,
    bookmarks: user.bookmarks_count || user.stats?.bookmarks || 0,
  };

  const collections = user.collections || [];

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

  const avatarSize = isMobile ? 100 : 140;

  const bannerUrl = user.banner_url || user.banner || null;

  return (
    <Box className={`${styles.pageContainer} ${isDark ? styles.darkMode : styles.lightMode}`}>
      <Container size="lg" px={isMobile ? 'sm' : 'md'} py="sm">
        <Header />
      </Container>
      <Container size="lg" px={isMobile ? 'sm' : 'md'} pt={0}>

        {/* COVER BANNER */}
        <Box className={styles.coverBanner} style={{ position: 'relative', overflow: 'hidden', borderRadius: `0 0 ${rem(24)} ${rem(24)}` }}>
          {bannerUrl ? (
            <Image src={bannerUrl} alt="Banner de perfil" h={isMobile ? 160 : 240} style={{ objectFit: 'cover', width: '100%' }} />
          ) : (
            <Box h={isMobile ? 160 : 240} className={styles.coverBannerGradient} />
          )}
          <Box className={styles.coverBannerOverlay} />
        </Box>

        {/* HEADER CARD */}
        <Paper
          p={isMobile ? 'md' : 'xl'}
          radius={rem(24)}
          mb="xl"
          className={styles.headerCard}
          style={{ marginTop: isMobile ? -56 : -80, position: 'relative', zIndex: 2 }}
        >
          <Box className={styles.headerDecoration1} />
          <Box className={styles.headerDecoration2} />

          {/* MOBILE */}
          {isMobile ? (
            <Stack align="center" gap="md" style={{ position: 'relative', zIndex: 1 }}>
              <PremiumAvatar src={avatarSrc} size={100} initials={getInitials()} streak={streak} onCameraClick={() => setOpenAvatarPicker(true)} isDark={isDark} />
              <Stack gap={4} align="center">
                <Group gap="xs" justify="center" wrap="nowrap">
                  <Text fw={800} size="xl" className={styles.gradientText}>{userName}</Text>
                  <Badge variant="gradient" gradient={role.gradient} size="sm" leftSection={<RoleIcon size={10} />} className={styles.roleBadge}>{role.label}</Badge>
                </Group>
                <Text size="xs" c="dimmed" fw={500}>@{userUsername}</Text>
              </Stack>
              {userBio !== 'Sin biografía' && (
                <Text size="sm" c="dimmed" ta="center" maw={300} lh={1.5} style={{ opacity: 0.85 }}>{userBio}</Text>
              )}
              <Group gap={rem(24)} justify="center" py="xs" wrap="nowrap">
                <InlineStat value={formatNum(stats.chapters)} label="Caps. leídos" isDark={isDark} />
                <Box className={styles.statDivider} />
                <InlineStat value={streak} label="Racha" isDark={isDark} />
              </Group>
              <Group gap="xs" w="100%">
                <PremiumButton leftSection={<IconPencil size={15} />} style={{ flex: 1 }} isDark={isDark} onClick={openEditModal}>Editar</PremiumButton>
                <PremiumButton variant="outline" leftSection={copied ? <IconCheck size={15} /> : <IconShare size={15} />} style={{ flex: 1 }} isDark={isDark} onClick={handleShare}>
                  {copied ? 'Copiado' : 'Compartir'}
                </PremiumButton>
                <Tooltip label="Configuración" withArrow>
                  <ActionIcon variant="light" color="gray" size="lg" radius="xl" className={styles.settingsButton}><IconSettings size={18} /></ActionIcon>
                </Tooltip>
              </Group>
            </Stack>
          ) : (
            /* DESKTOP + TABLET */
            <Group gap="xl" align="flex-start" wrap="nowrap" style={{ position: 'relative', zIndex: 1 }}>
              <PremiumAvatar src={avatarSrc} size={avatarSize} initials={getInitials()} streak={streak} onCameraClick={() => setOpenAvatarPicker(true)} isDark={isDark} />
              <Stack gap="sm" style={{ flex: 1, minWidth: 0 }}>
                <Group gap="sm" wrap="wrap">
                  <Text fw={800} size={rem(30)} lh={1.1} className={styles.gradientText}>{userName}</Text>
                  <Badge variant="gradient" gradient={role.gradient} size="lg" leftSection={<RoleIcon size={13} />} className={styles.roleBadge}>{role.label}</Badge>
                </Group>
                <Text size="sm" c="dimmed" fw={500}>@{userUsername}</Text>
                {userBio !== 'Sin biografía' && (
                  <Text size="sm" maw={520} lh={1.6} style={{ opacity: 0.85 }}>{userBio}</Text>
                )}
                <Group gap="lg" mt={2} wrap="wrap">
                  {userLocation && (
                    <Group gap={6}>
                      <ThemeIcon size="xs" variant="light" color="cyan" radius="xl"><IconMapPin size={10} /></ThemeIcon>
                      <Text size="sm" c="dimmed">{userLocation}</Text>
                    </Group>
                  )}
                  <Group gap={6}>
                    <ThemeIcon size="xs" variant="light" color="violet" radius="xl"><IconCalendar size={10} /></ThemeIcon>
                    <Text size="sm" c="dimmed">
                      Se unió en {new Date(userJoinDate).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
                    </Text>
                  </Group>
                </Group>
                <Group gap={rem(40)} mt="md">
                  <InlineStat value={formatNum(stats.chapters)} label="Caps. leídos" isDark={isDark} />
                  <Box className={styles.statDivider} />
                  <InlineStat value={streak} label="Racha" isDark={isDark} />
                </Group>
              </Stack>
              <Stack gap="sm" align="flex-end" style={{ flexShrink: 0 }}>
                <PremiumButton leftSection={<IconPencil size={16} />} isDark={isDark} onClick={openEditModal}>Editar perfil</PremiumButton>
                <PremiumButton variant="outline" leftSection={copied ? <IconCheck size={16} /> : <IconShare size={16} />} isDark={isDark} onClick={handleShare}>
                  {copied ? 'Copiado' : 'Compartir'}
                </PremiumButton>
                <Tooltip label="Configuración" withArrow position="left">
                  <ActionIcon variant="light" color="gray" size="lg" radius="xl" mt={4} className={styles.settingsButton}><IconSettings size={20} /></ActionIcon>
                </Tooltip>
              </Stack>
            </Group>
          )}
        </Paper>


        {/* CONTINUAR LEYENDO */}
        <Paper p={isMobile ? 'md' : 'xl'} radius="xl" mb="xl" className={`${styles.infoCard} ${isDark ? styles.darkMode : styles.lightMode}`} style={{ position: 'relative', overflow: 'hidden' }}>
          <Box style={{ position: 'absolute', top: -60, left: -60, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <Stack gap="lg" style={{ position: 'relative', zIndex: 1 }}>
            <Group justify="space-between" align="center">
              <Group gap="sm">
                <ThemeIcon size="lg" radius="xl" variant="gradient" gradient={{ from: 'cyan', to: 'teal', deg: 135 }}>
                  <IconBook size={18} />
                </ThemeIcon>
                <Text fw={700} size={isMobile ? 'md' : 'lg'}>Continuar Leyendo</Text>
              </Group>
              <Link href="/biblioteca" style={{ textDecoration: 'none' }}>
                <Group gap={4}>
                  <Text size="sm" c="cyan" fw={600}>Ver todo</Text>
                  <IconArrowUpRight size={16} style={{ color: 'var(--mantine-color-cyan-5)' }} />
                </Group>
              </Link>
            </Group>
            {recentLoading ? (
              <SimpleGrid cols={{ base: 3, sm: 4, md: 6 }} spacing={isMobile ? 'xs' : 'sm'}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <Stack key={i} gap="xs">
                    <Skeleton height={isMobile ? 120 : 160} radius="lg" />
                    <Skeleton height={10} width="80%" radius="xl" />
                    <Skeleton height={8} width="50%" radius="xl" />
                  </Stack>
                ))}
              </SimpleGrid>
            ) : recentReads.length > 0 ? (
              <SimpleGrid cols={{ base: 3, sm: 4, md: 6 }} spacing={isMobile ? 'xs' : 'sm'}>
                {recentReads.slice(0, 6).map((item, i) => {
                  const slug = item.series?.slug || item.slug || '';
                  const title = item.series?.title || item.title || slug;
                  const chapter = item.chapter?.number ?? item.chapterNum;
                  const progress = item.progress || 0;
                  const cover = item.series?.coverUrl || item.series?.cover_url || '';
                  return (
                    <Link key={i} href={slug ? `/manhwa/${slug}` : '#'} style={{ textDecoration: 'none' }}>
                      <Stack gap={6}>
                        <Box style={{ position: 'relative', borderRadius: rem(12), overflow: 'hidden', aspectRatio: '2/3' }}>
                          {cover ? (
                            <Image src={cover} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <Box style={{ width: '100%', height: '100%', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <IconBook size={24} style={{ opacity: 0.3 }} />
                            </Box>
                          )}
                          <Box style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: rem(6), background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)' }}>
                            <Progress value={progress} color="cyan" size="xs" radius="xl" />
                          </Box>
                          {chapter && (
                            <Badge size="xs" variant="filled" color="dark" style={{ position: 'absolute', top: 6, right: 6, opacity: 0.85, fontSize: rem(9) }}>
                              Cap.{chapter}
                            </Badge>
                          )}
                        </Box>
                        <Text size="xs" fw={600} lineClamp={2} lh={1.3}>{title}</Text>
                      </Stack>
                    </Link>
                  );
                })}
              </SimpleGrid>
            ) : (
              <Center py="xl">
                <Stack align="center" gap="sm">
                  <ThemeIcon size={56} radius="xl" variant="light" color="cyan" style={{ opacity: 0.5 }}>
                    <IconBook size={28} stroke={1.5} />
                  </ThemeIcon>
                  <Text size="sm" c="dimmed" ta="center">Empieza a leer y tu progreso aparecerá aquí</Text>
                </Stack>
              </Center>
            )}
          </Stack>
        </Paper>

        {/* GAMIFICACIÓN */}
        <Grid gutter={isMobile ? 'sm' : 'lg'} mb="xl" align="stretch">

          {/* NIVEL DE USUARIO */}
          <Grid.Col span={{ base: 12, md: 5 }}>
            <Paper p={isMobile ? 'md' : 'xl'} radius="xl" h="100%" className={`${styles.infoCard} ${isDark ? styles.darkMode : styles.lightMode}`} style={{ position: 'relative', overflow: 'hidden' }}>
              <Box style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, rgba(234,179,8,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
              <Box style={{ position: 'absolute', bottom: -30, left: -30, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
              <Stack gap="lg" style={{ position: 'relative', zIndex: 1 }}>
                <Group justify="space-between" align="center" wrap="nowrap">
                  <Group gap="sm">
                    <ThemeIcon size="lg" radius="xl" variant="gradient" gradient={{ from: 'yellow', to: 'orange', deg: 135 }}><IconStar size={18} /></ThemeIcon>
                    <Text fw={700} size={isMobile ? 'md' : 'lg'}>Nivel de Usuario</Text>
                  </Group>
                  <Badge variant="gradient" gradient={{ from: 'yellow', to: 'orange' }} size="sm" leftSection={<IconSparkles size={10} />}>Próximamente</Badge>
                </Group>
                <Group gap="md" align="center" wrap="nowrap">
                  <Box style={{ width: isMobile ? 60 : 72, height: isMobile ? 60 : 72, flexShrink: 0, borderRadius: '50%', background: isDark ? 'linear-gradient(135deg, rgba(234,179,8,0.2), rgba(249,115,22,0.2))' : 'linear-gradient(135deg, rgba(234,179,8,0.15), rgba(249,115,22,0.15))', border: '2px solid rgba(234,179,8,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                    <Text fw={800} size="xl" style={{ color: 'var(--mantine-color-yellow-5)' }}>?</Text>
                  </Box>
                  <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                    <Text fw={600} size="sm" c="dimmed">Novato → Guerrero → Héroe → Leyenda</Text>
                    <Progress value={35} color="yellow" size="md" radius="xl" style={{ opacity: 0.4 }} />
                    <Text size="xs" c="dimmed">Sistema de XP por lectura en desarrollo</Text>
                  </Stack>
                </Group>
                <SimpleGrid cols={4} spacing="xs">
                  {[
                    { label: 'Novato', icon: IconBook, color: 'gray' },
                    { label: 'Guerrero', icon: IconSword, color: 'cyan' },
                    { label: 'Héroe', icon: IconShield, color: 'violet' },
                    { label: 'Leyenda', icon: IconCrown, color: 'yellow' },
                  ].map((lvl) => {
                    const LvlIcon = lvl.icon;
                    return (
                      <Stack key={lvl.label} align="center" gap={4} style={{ opacity: 0.4 }}>
                        <ThemeIcon size={isMobile ? 'sm' : 'md'} radius="xl" variant="light" color={lvl.color}><LvlIcon size={isMobile ? 12 : 14} /></ThemeIcon>
                        <Text size="xs" c="dimmed" ta="center" lh={1.2}>{lvl.label}</Text>
                      </Stack>
                    );
                  })}
                </SimpleGrid>
              </Stack>
            </Paper>
          </Grid.Col>

          {/* VITRINA DE INSIGNIAS */}
          <Grid.Col span={{ base: 12, md: 7 }}>
            <Paper p={isMobile ? 'md' : 'xl'} radius="xl" h="100%" className={`${styles.infoCard} ${isDark ? styles.darkMode : styles.lightMode}`} style={{ position: 'relative', overflow: 'hidden' }}>
              <Box style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
              <Stack gap="lg" style={{ position: 'relative', zIndex: 1 }}>
                <Group justify="space-between" align="center" wrap="nowrap">
                  <Group gap="sm">
                    <ThemeIcon size="lg" radius="xl" variant="gradient" gradient={{ from: 'cyan', to: 'violet', deg: 135 }}><IconTrophy size={18} /></ThemeIcon>
                    <Text fw={700} size={isMobile ? 'md' : 'lg'}>Vitrina de Insignias</Text>
                  </Group>
                  <Badge variant="gradient" gradient={{ from: 'cyan', to: 'violet' }} size="sm" leftSection={<IconSparkles size={10} />}>Próximamente</Badge>
                </Group>
                <SimpleGrid cols={isMobile ? 3 : 6} spacing={isMobile ? 'xs' : 'sm'}>
                  {[
                    { label: 'Lector\nNocturno', icon: IconMoon, color: 'violet', desc: 'Lee de madrugada' },
                    { label: 'Crítico', icon: IconMessage, color: 'cyan', desc: '10 comentarios' },
                    { label: 'Devorador', icon: IconFlame, color: 'orange', desc: '100 capítulos' },
                    { label: 'Veloz', icon: IconBolt, color: 'yellow', desc: 'Lee 5 caps en 1h' },
                    { label: 'Guardián', icon: IconShield, color: 'teal', desc: 'Racha de 30 días' },
                    { label: 'Diamante', icon: IconDiamond, color: 'blue', desc: '1000 capítulos' },
                  ].map((badge) => {
                    const BadgeIcon = badge.icon;
                    return (
                      <Tooltip key={badge.label} label={badge.desc} withArrow position="top">
                        <Stack align="center" gap={6} style={{ cursor: 'default', padding: rem(isMobile ? 6 : 10), borderRadius: rem(12), background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                          <Box style={{ position: 'relative' }}>
                            <ThemeIcon size={isMobile ? 40 : 52} radius="xl" variant="light" color="gray" style={{ opacity: 0.3, filter: 'grayscale(1)' }}>
                              <BadgeIcon size={isMobile ? 20 : 26} />
                            </ThemeIcon>
                            <ThemeIcon size={18} radius="xl" color="dark" variant="filled" style={{ position: 'absolute', bottom: -3, right: -3, opacity: 0.6, background: isDark ? 'rgba(15,23,42,0.9)' : 'rgba(100,100,100,0.8)' }}>
                              <IconLock size={10} />
                            </ThemeIcon>
                          </Box>
                          <Text size="xs" c="dimmed" ta="center" lh={1.2} style={{ opacity: 0.5, whiteSpace: 'pre-line' }}>{badge.label}</Text>
                        </Stack>
                      </Tooltip>
                    );
                  })}
                </SimpleGrid>
                <Text size="xs" c="dimmed" ta="center" style={{ opacity: 0.6 }}>Las insignias se desbloquearán automáticamente según tu actividad</Text>
              </Stack>
            </Paper>
          </Grid.Col>
        </Grid>

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
              const isSelected = avatarSrc === a;
              return (
                <Card
                  ref={ref}
                  key={i}
                  p={6}
                  radius="lg"
                  className={styles.avatarPickerItem}
                  style={{
                    border: `2px solid ${isSelected ? 'var(--mantine-color-cyan-5)' : hovered ? 'var(--mantine-color-cyan-5)' : 'transparent'}`,
                    transform: hovered ? 'scale(1.05)' : 'scale(1)',
                    boxShadow: isSelected
                      ? '0 4px 15px rgba(6, 182, 212, 0.4)'
                      : hovered ? '0 8px 25px rgba(6, 182, 212, 0.3)' : 'none',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                  onClick={async () => {
                    try {
                      const { default: api } = await import('@/api/client');
                      await api.put('users', 'avatar', { avatarUrl: a });
                      setAvatarSrc(a);
                      setOpenAvatarPicker(false);
                      setUser(prev => ({ ...prev, avatar_url: a }));
                      notifications.show({ title: 'Avatar actualizado', message: 'Tu avatar se ha cambiado correctamente', color: 'cyan' });
                    } catch (e) {
                      console.error(e);
                      notifications.show({ title: 'Error', message: 'No se pudo cambiar el avatar', color: 'red' });
                    }
                  }}
                >
                  <Avatar src={a} size="100%" radius="md" alt={`Avatar opción ${i + 1}`}>
                    {getInitials()}
                  </Avatar>
                  {isSelected && (
                    <ThemeIcon
                      size={20}
                      radius="xl"
                      color="cyan"
                      style={{ position: 'absolute', top: 4, right: 4 }}
                    >
                      <IconCheck size={12} />
                    </ThemeIcon>
                  )}
                </Card>
              );
            };
            return <AvatarCard key={i} />;
          })}
        </SimpleGrid>
      </Modal>

      {/* MODAL EDITAR PERFIL */}
      <Modal
        opened={editOpen}
        onClose={() => setEditOpen(false)}
        title={
          <Group gap="xs">
            <ThemeIcon size="md" radius="xl" variant="gradient" gradient={{ from: 'cyan', to: 'teal' }}>
              <IconPencil size={14} />
            </ThemeIcon>
            <Text fw={700} size="lg">Editar perfil</Text>
          </Group>
        }
        centered
        radius="xl"
        size={isMobile ? 'full' : 'lg'}
        overlayProps={{ backgroundOpacity: 0.6, blur: 10 }}
        classNames={{
          content: `${styles.modalContent} ${isDark ? styles.darkMode : styles.lightMode}`,
          header: styles.modalHeader,
        }}
        styles={{
          body: { padding: isMobile ? rem(16) : rem(24) },
        }}
      >
        <Stack gap="xl">
          {/* Preview del avatar + nombre */}
          <Paper
            p="lg"
            radius="xl"
            style={{
              background: isDark
                ? 'linear-gradient(145deg, rgba(6,182,212,0.08) 0%, rgba(139,92,246,0.06) 100%)'
                : 'linear-gradient(145deg, rgba(6,182,212,0.06) 0%, rgba(139,92,246,0.04) 100%)',
              border: `1px solid ${isDark ? 'rgba(6,182,212,0.15)' : 'rgba(6,182,212,0.2)'}`,
            }}
          >
            <Group gap="lg" align="center">
              <Box pos="relative">
                <Avatar
                  src={avatarSrc}
                  size={isMobile ? 64 : 80}
                  radius="50%"
                  style={{
                    boxShadow: '0 6px 24px rgba(6,182,212,0.25)',
                    border: `3px solid ${isDark ? 'rgba(6,182,212,0.4)' : 'rgba(6,182,212,0.5)'}`,
                  }}
                >
                  {getInitials()}
                </Avatar>
                <Tooltip label="Cambiar avatar" withArrow>
                  <ActionIcon
                    variant="gradient"
                    gradient={{ from: 'cyan', to: 'teal' }}
                    size="sm"
                    radius="xl"
                    pos="absolute"
                    bottom={-2}
                    right={-2}
                    onClick={() => { setEditOpen(false); setTimeout(() => setOpenAvatarPicker(true), 200); }}
                    style={{ border: `2px solid ${isDark ? '#1e293b' : '#fff'}`, zIndex: 2 }}
                  >
                    <IconCamera size={12} />
                  </ActionIcon>
                </Tooltip>
              </Box>
              <Stack gap={4} style={{ flex: 1 }}>
                <Text size={isMobile ? 'md' : 'lg'} fw={700} className={styles.gradientText} lineClamp={1}>
                  {editForm.display_name || 'Tu nombre'}
                </Text>
                <Text size="sm" c="dimmed">@{userUsername}</Text>
              </Stack>
            </Group>
          </Paper>

          {/* Campos del formulario */}
          <Stack gap="md">
            <TextInput
              label={<Text size="sm" fw={600} mb={4}>Nombre para mostrar</Text>}
              placeholder="¿Cómo te llamas?"
              value={editForm.display_name}
              onChange={(e) => setEditForm(prev => ({ ...prev, display_name: e.currentTarget.value }))}
              maxLength={50}
              radius="xl"
              size="md"
              leftSection={<IconUsers size={16} style={{ opacity: 0.5 }} />}
              error={editForm.display_name.trim().length === 0 ? 'El nombre no puede estar vacío' : null}
              styles={{
                input: {
                  background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                  border: `1.5px solid ${isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,0,0,0.08)'}`,
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                  '&:focus': { borderColor: 'var(--mantine-color-cyan-5)' },
                },
              }}
            />

            <Box>
              <Textarea
                label={<Text size="sm" fw={600} mb={4}>Biografía</Text>}
                placeholder="Cuéntale al mundo sobre ti, tus manhwas favoritos..."
                value={editForm.bio}
                onChange={(e) => setEditForm(prev => ({ ...prev, bio: e.currentTarget.value }))}
                maxLength={200}
                minRows={3}
                maxRows={5}
                autosize
                radius="lg"
                size="md"
                styles={{
                  input: {
                    background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                    border: `1.5px solid ${isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,0,0,0.08)'}`,
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                  },
                }}
              />
              <Group justify="flex-end" mt={6}>
                <Text
                  size="xs"
                  c={editForm.bio.length > 180 ? 'orange' : 'dimmed'}
                  fw={editForm.bio.length > 180 ? 600 : 400}
                >
                  {editForm.bio.length}/200
                </Text>
              </Group>
            </Box>

            <TextInput
              label={<Text size="sm" fw={600} mb={4}>Ubicación</Text>}
              placeholder="Ciudad, País"
              value={editForm.location}
              onChange={(e) => setEditForm(prev => ({ ...prev, location: e.currentTarget.value }))}
              maxLength={60}
              radius="xl"
              size="md"
              leftSection={<IconMapPin size={16} style={{ opacity: 0.5 }} />}
              styles={{
                input: {
                  background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                  border: `1.5px solid ${isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,0,0,0.08)'}`,
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                },
              }}
            />
          </Stack>

          {/* Botones de acción */}
          <Group justify="flex-end" gap="sm" mt="xs">
            <Button
              variant="default"
              radius="xl"
              size="md"
              onClick={() => setEditOpen(false)}
              style={{
                border: `1px solid ${isDark ? 'rgba(148,163,184,0.2)' : 'rgba(0,0,0,0.1)'}`,
              }}
            >
              Cancelar
            </Button>
            <PremiumButton
              isDark={isDark}
              onClick={handleSaveProfile}
              loading={editSaving}
              disabled={!editForm.display_name.trim()}
              leftSection={!editSaving ? <IconCheck size={16} /> : undefined}
              size="md"
            >
              Guardar cambios
            </PremiumButton>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}