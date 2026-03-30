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
  IconFlame,
  IconShare,
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
  IconThumbUp,
  IconThumbDown,
  IconMessageCircle,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { getCurrentUser } from '@/api/client';
import { getRecentProgress, getStreak, getStreakStreamUrl } from '@/api/progress';
import { StreakFlame, VitrinaLogros } from '@/components/achievements';
import styles from '@/app/user-profile/UserProfile.module.css';
import Link from 'next/link';
import Header from '@/components/Header';

// ============================================
// COMPONENTES AUXILIARES PREMIUM
// ============================================

// Métrica del header principal (sin background)
const ProfileMetric = ({ icon: Icon, label, value, compact = false, color = 'gray', premium = false }) => {
  const { hovered, ref } = useHover();

  const colorConfig = {
    cyan:   { from: 'cyan',   to: 'teal',   rgb: '6, 182, 212',   textFrom: 'var(--mantine-color-cyan-4)',   textTo: 'var(--mantine-color-teal-5)' },
    orange: { from: 'orange', to: 'red',    rgb: '249, 115, 22',  textFrom: 'var(--mantine-color-orange-4)', textTo: 'var(--mantine-color-red-5)'  },
    gray:   { from: 'gray',   to: 'dark',   rgb: '148, 163, 184', textFrom: null, textTo: null },
  };
  const c = colorConfig[color] || colorConfig.gray;
  const isColored = color !== 'gray';

  return (
    <Stack
      ref={ref}
      gap={compact ? 6 : 8}
      align="center"
      style={{
        transition: 'all 0.3s ease',
        opacity: hovered ? 1 : 0.92,
        position: 'relative',
      }}
    >
      <ThemeIcon
        size={compact ? 38 : 44}
        radius="xl"
        variant={isColored ? 'gradient' : 'subtle'}
        gradient={isColored ? { from: c.from, to: c.to, deg: 135 } : undefined}
        color={!isColored ? 'gray' : undefined}
        style={{
          transition: 'all 0.3s ease',
          transform: hovered ? 'scale(1.12)' : 'scale(1)',
          boxShadow: isColored ? `0 4px 18px rgba(${c.rgb}, ${hovered ? 0.55 : 0.35})` : undefined,
          opacity: isColored ? 1 : 0.6,
        }}
      >
        <Icon size={compact ? 19 : 22} stroke={1.8} />
      </ThemeIcon>
      <Stack gap={3} align="center" style={{ minWidth: 0 }}>
        <Text
          fw={800}
          size={compact ? 'xl' : rem(28)}
          lh={1}
          style={{
            letterSpacing: '-0.03em',
            ...(isColored ? {
              background: `linear-gradient(135deg, ${c.textFrom} 0%, ${c.textTo} 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            } : {}),
          }}
        >
          {value}
        </Text>
        <Group gap={4} align="center" wrap="nowrap">
          <Text size="xs" c="dimmed" fw={600} tt="uppercase" style={{ letterSpacing: '0.8px', opacity: 0.65 }}>
            {label}
          </Text>
          {premium && (
            <IconCrown size={10} style={{ color: 'var(--mantine-color-yellow-4)', opacity: 0.9, flexShrink: 0 }} />
          )}
        </Group>
      </Stack>
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
            leftSection={<StreakFlame streak={streak} iconOnly />}
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

  // Community interactions state
  const [userRatings, setUserRatings] = useState([]);
  const [ratingsLoading, setRatingsLoading] = useState(true);
  const [userComments, setUserComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [communityTab, setCommunityTab] = useState('ratings'); // 'ratings' | 'comments'

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

  // SSE — actualizaciones de racha en tiempo real
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const url = getStreakStreamUrl();
    const es = new EventSource(url, { withCredentials: true });

    es.addEventListener('streak-update', (e) => {
      try {
        const data = JSON.parse(e.data);
        setStreakData({
          streak: data?.streak || 0,
          maxStreak: data?.maxStreak || 0,
          readToday: data?.readToday || false,
          chaptersRead: data?.chaptersRead || 0,
          totalDaysRead: data?.totalDaysRead || 0,
        });
      } catch (_) { /* noop */ }
    });

    es.onerror = () => { es.close(); };

    return () => { es.close(); };
  }, []);

  // Fetch user ratings and comments when user is loaded
  useEffect(() => {
    if (!user?.username) return;

    const fetchCommunityData = async () => {
      try {
        const { default: api } = await import('@/api/client');
        
        // Fetch ratings
        const ratingsRes = await api.get('users', `${user.username}/ratings?limit=10`);
        const ratingsData = ratingsRes?.data?.ratings || ratingsRes?.ratings || [];
        setUserRatings(Array.isArray(ratingsData) ? ratingsData : []);
      } catch (e) {
        console.error('Error fetching ratings:', e);
        setUserRatings([]);
      } finally {
        setRatingsLoading(false);
      }

      try {
        const { default: api } = await import('@/api/client');
        
        // Fetch comments
        const commentsRes = await api.get('users', `${user.username}/comments?limit=10`);
        const commentsData = commentsRes?.data?.comments || commentsRes?.comments || [];
        setUserComments(Array.isArray(commentsData) ? commentsData : []);
      } catch (e) {
        console.error('Error fetching comments:', e);
        setUserComments([]);
      } finally {
        setCommentsLoading(false);
      }
    };

    fetchCommunityData();
  }, [user?.username]);

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
  const joinedDateLabel = new Date(userJoinDate).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });

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

  return (
    <Box className={`${styles.pageContainer} ${isDark ? styles.darkMode : styles.lightMode}`}>
      <Header />
      <Container size="lg" px={isMobile ? 'sm' : 'md'} pt={isMobile ? 90 : 110}>

        {/* HEADER CARD */}
        <Paper
          p={isMobile ? 'md' : 'xl'}
          radius={rem(24)}
          mb="xl"
          className={styles.headerCard}
          style={{ position: 'relative', zIndex: 2 }}
        >
          <Box className={styles.headerDecoration1} />
          <Box className={styles.headerDecoration2} />

          {/* MOBILE */}
          {isMobile ? (
            <Stack align="center" gap="lg" style={{ position: 'relative', zIndex: 1 }}>
              <PremiumAvatar src={avatarSrc} size={110} initials={getInitials()} streak={streak} onCameraClick={() => setOpenAvatarPicker(true)} isDark={isDark} />
              <Stack gap={8} align="center">
                <Stack gap={4} align="center">
                  <Text fw={800} size={rem(26)} lh={1.1} className={styles.gradientText} ta="center">{userName}</Text>
                  <Badge variant="gradient" gradient={{ from: role.gradient.from, to: role.gradient.to, deg: 135 }} size="sm" leftSection={<RoleIcon size={10} />} className={`${styles.roleBadge} ${styles.roleBadgeMinimal}`}>{role.label}</Badge>
                </Stack>
                <Group gap={8} justify="center" wrap="wrap">
                  <Badge variant="light" color="gray" radius="xl" className={styles.profileMetaBadge}>@{userUsername}</Badge>
                  <Badge variant="light" color="gray" radius="xl" leftSection={<IconCalendar size={10} />} className={styles.profileMetaBadge}>
                    Se unió en {joinedDateLabel}
                  </Badge>
                </Group>
              </Stack>
              {userBio !== 'Sin biografía' && (
                <Text size="sm" c="dimmed" ta="center" maw={320} lh={1.6} style={{ opacity: 0.75 }}>{userBio}</Text>
              )}
              <Group gap={rem(48)} justify="center" mt="md" className={styles.headerStatsGrid}>
                <ProfileMetric icon={IconBook} value={formatNum(stats.chapters)} label="Caps. leídos" compact color="cyan" />
                <StreakFlame streak={streak} compact />
              </Group>
              <Group gap="xs" w="100%">
                <PremiumButton leftSection={<IconPencil size={15} />} style={{ flex: 1 }} isDark={isDark} onClick={openEditModal}>Editar</PremiumButton>
                <PremiumButton variant="outline" leftSection={copied ? <IconCheck size={15} /> : <IconShare size={15} />} style={{ flex: 1 }} isDark={isDark} onClick={handleShare}>
                  {copied ? 'Copiado' : 'Compartir'}
                </PremiumButton>
              </Group>
            </Stack>
          ) : (
            /* DESKTOP + TABLET */
            <Group gap="xl" align="flex-start" wrap="nowrap" style={{ position: 'relative', zIndex: 1 }}>
              <PremiumAvatar src={avatarSrc} size={avatarSize} initials={getInitials()} streak={streak} onCameraClick={() => setOpenAvatarPicker(true)} isDark={isDark} />
              <Stack gap="md" style={{ flex: 1, minWidth: 0 }}>
                <Stack gap={6}>
                  <Group gap="sm" wrap="wrap" align="center">
                    <Text fw={800} size={rem(32)} lh={1.05} className={styles.gradientText}>{userName}</Text>
                    <Badge variant="gradient" gradient={{ from: role.gradient.from, to: role.gradient.to, deg: 135 }} size="md" leftSection={<RoleIcon size={12} />} className={`${styles.roleBadge} ${styles.roleBadgeMinimal}`}>{role.label}</Badge>
                  </Group>
                  <Group gap={8} wrap="wrap" className={styles.profileMetaGroup}>
                    <Badge variant="light" color="gray" radius="xl" className={styles.profileMetaBadge}>@{userUsername}</Badge>
                    <Badge variant="light" color="gray" radius="xl" leftSection={<IconCalendar size={10} />} className={styles.profileMetaBadge}>
                      Se unió en {joinedDateLabel}
                    </Badge>
                    {userLocation && (
                      <Badge variant="light" color="gray" radius="xl" leftSection={<IconMapPin size={10} />} className={styles.profileMetaBadge}>
                        {userLocation}
                      </Badge>
                    )}
                  </Group>
                </Stack>
                {userBio !== 'Sin biografía' && (
                  <Text size="sm" maw={540} lh={1.65} style={{ opacity: 0.75 }}>{userBio}</Text>
                )}
                <Group gap={rem(56)} mt="lg" className={styles.headerStatsGrid}>
                  <ProfileMetric icon={IconBook} value={formatNum(stats.chapters)} label="Caps. leídos" color="cyan" />
                  <StreakFlame streak={streak} />
                </Group>
              </Stack>
              <Stack gap="sm" align="flex-end" style={{ flexShrink: 0 }}>
                <PremiumButton leftSection={<IconPencil size={16} />} isDark={isDark} onClick={openEditModal}>Editar perfil</PremiumButton>
                <PremiumButton variant="outline" leftSection={copied ? <IconCheck size={16} /> : <IconShare size={16} />} isDark={isDark} onClick={handleShare}>
                  {copied ? 'Copiado' : 'Compartir'}
                </PremiumButton>
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
                  const chapter = item.chapter?.number;
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
        <Grid gutter={isMobile ? 'md' : 'xl'} mb="xl" align="stretch">

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
            <VitrinaLogros streak={streak} isDark={isDark} isMobile={isMobile} />
          </Grid.Col>
        </Grid>

        {/* HISTORIAL DE INTERACCIONES (COMUNIDAD) */}
        <Paper p={isMobile ? 'md' : 'xl'} radius="xl" mb="xl" className={`${styles.infoCard} ${isDark ? styles.darkMode : styles.lightMode}`} style={{ position: 'relative', overflow: 'hidden' }}>
          <Box style={{ position: 'absolute', top: -50, right: -50, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <Box style={{ position: 'absolute', bottom: -40, left: -40, width: 150, height: 150, borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <Stack gap="lg" style={{ position: 'relative', zIndex: 1 }}>
            {/* Header con tabs */}
            <Group justify="space-between" align="center" wrap="nowrap">
              <Group gap="sm">
                <ThemeIcon size="lg" radius="xl" variant="gradient" gradient={{ from: 'violet', to: 'cyan', deg: 135 }}>
                  <IconMessageCircle size={18} />
                </ThemeIcon>
                <Text fw={700} size={isMobile ? 'md' : 'lg'}>Actividad en la Comunidad</Text>
              </Group>
            </Group>

            {/* Tabs de navegación */}
            <Group gap="xs">
              <Button
                variant={communityTab === 'ratings' ? 'filled' : 'subtle'}
                color={communityTab === 'ratings' ? 'violet' : 'gray'}
                size="sm"
                radius="xl"
                leftSection={<IconStarFilled size={14} />}
                onClick={() => setCommunityTab('ratings')}
              >
                Mis Calificaciones ({userRatings.length})
              </Button>
              <Button
                variant={communityTab === 'comments' ? 'filled' : 'subtle'}
                color={communityTab === 'comments' ? 'cyan' : 'gray'}
                size="sm"
                radius="xl"
                leftSection={<IconMessage size={14} />}
                onClick={() => setCommunityTab('comments')}
              >
                Mis Comentarios ({userComments.length})
              </Button>
            </Group>

            {/* Contenido según tab */}
            {communityTab === 'ratings' ? (
              // TAB: Calificaciones
              ratingsLoading ? (
                <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} height={90} radius="lg" />
                  ))}
                </SimpleGrid>
              ) : userRatings.length === 0 ? (
                <Center py="xl">
                  <Stack align="center" gap="xs">
                    <ThemeIcon size={48} radius="xl" variant="light" color="gray">
                      <IconStarFilled size={24} style={{ opacity: 0.4 }} />
                    </ThemeIcon>
                    <Text c="dimmed" size="sm">Aún no has calificado ninguna obra</Text>
                    <Button component={Link} href="/mangas" variant="light" color="violet" size="xs" radius="xl">
                      Explorar manhwas
                    </Button>
                  </Stack>
                </Center>
              ) : (
                <Stack gap="sm">
                  {userRatings.slice(0, 5).map((rating) => (
                    <Link key={rating.id} href={`/manhwa/${rating.series?.slug}`} style={{ textDecoration: 'none' }}>
                      <Paper p="sm" radius="lg" withBorder style={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, transition: 'all 0.2s', background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)' }} className={styles.ratingCard}>
                        <Group gap="sm" wrap="nowrap">
                          <Box style={{ width: 50, height: 70, borderRadius: rem(8), overflow: 'hidden', flexShrink: 0 }}>
                            {rating.series?.coverUrl ? (
                              <Image src={rating.series.coverUrl} alt={rating.series?.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <Box style={{ width: '100%', height: '100%', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <IconBook size={20} style={{ opacity: 0.3 }} />
                              </Box>
                            )}
                          </Box>
                          <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                            <Group gap={6} wrap="nowrap">
                              <Text size="sm" fw={600} lineClamp={1}>{rating.series?.title || 'Sin título'}</Text>
                              {rating.ratingType === 'chapter' && (
                                <Badge size="xs" variant="light" color="cyan">Cap. {rating.chapterNumber}</Badge>
                              )}
                            </Group>
                            <Group gap={4}>
                              {[...Array(5)].map((_, i) => (
                                <IconStarFilled
                                  key={i}
                                  size={14}
                                  style={{ color: i < Math.round(rating.score / 2) ? 'var(--mantine-color-yellow-5)' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)') }}
                                />
                              ))}
                              <Text size="xs" c="dimmed" ml={4}>{rating.score}/10</Text>
                            </Group>
                            {rating.review && (
                              <Text size="xs" c="dimmed" lineClamp={1} style={{ fontStyle: 'italic' }}>&ldquo;{rating.review}&rdquo;</Text>
                            )}
                          </Stack>
                          <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                            {new Date(rating.createdAt).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                          </Text>
                        </Group>
                      </Paper>
                    </Link>
                  ))}
                  {userRatings.length > 5 && (
                    <Text size="xs" c="dimmed" ta="center">+ {userRatings.length - 5} calificaciones más</Text>
                  )}
                </Stack>
              )
            ) : (
              // TAB: Comentarios
              commentsLoading ? (
                <Stack gap="sm">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} height={80} radius="lg" />
                  ))}
                </Stack>
              ) : userComments.length === 0 ? (
                <Center py="xl">
                  <Stack align="center" gap="xs">
                    <ThemeIcon size={48} radius="xl" variant="light" color="gray">
                      <IconMessage size={24} style={{ opacity: 0.4 }} />
                    </ThemeIcon>
                    <Text c="dimmed" size="sm">Aún no has comentado en ninguna obra</Text>
                    <Button component={Link} href="/mangas" variant="light" color="cyan" size="xs" radius="xl">
                      Explorar mangas
                    </Button>
                  </Stack>
                </Center>
              ) : (
                <Stack gap="sm">
                  {userComments.slice(0, 5).map((comment) => (
                    <Link key={comment.id} href={comment.seriesSlug ? `/manhwa/${comment.seriesSlug}${comment.chapterNumber ? `/${comment.chapterNumber}` : ''}` : '#'} style={{ textDecoration: 'none' }}>
                      <Paper p="sm" radius="lg" withBorder style={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, transition: 'all 0.2s', background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)' }} className={styles.commentCard}>
                        <Stack gap="xs">
                          <Group justify="space-between" wrap="nowrap">
                            <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                              {comment.coverUrl && (
                                <Box style={{ width: 32, height: 44, borderRadius: rem(6), overflow: 'hidden', flexShrink: 0 }}>
                                  <Image src={comment.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </Box>
                              )}
                              <Stack gap={2} style={{ minWidth: 0 }}>
                                <Text size="xs" fw={600} lineClamp={1}>{comment.targetTitle || 'Comentario'}</Text>
                                <Badge size="xs" variant="light" color={comment.targetType === 'chapter' ? 'cyan' : 'violet'}>
                                  {comment.targetType === 'chapter' ? `Cap. ${comment.chapterNumber}` : 'Serie'}
                                </Badge>
                              </Stack>
                            </Group>
                            <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                              {new Date(comment.createdAt).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                            </Text>
                          </Group>
                          <Text size="sm" lineClamp={2} style={{ opacity: 0.85 }}>
                            {comment.isSpoiler ? (
                              <Badge size="xs" color="orange" variant="light">Spoiler oculto</Badge>
                            ) : comment.content}
                          </Text>
                          <Group gap="md">
                            <Group gap={4}>
                              <IconThumbUp size={12} style={{ opacity: 0.5 }} />
                              <Text size="xs" c="dimmed">{comment.likesCount || 0}</Text>
                            </Group>
                            <Group gap={4}>
                              <IconThumbDown size={12} style={{ opacity: 0.5 }} />
                              <Text size="xs" c="dimmed">{comment.dislikesCount || 0}</Text>
                            </Group>
                            {comment.repliesCount > 0 && (
                              <Group gap={4}>
                                <IconMessageCircle size={12} style={{ opacity: 0.5 }} />
                                <Text size="xs" c="dimmed">{comment.repliesCount} respuestas</Text>
                              </Group>
                            )}
                          </Group>
                        </Stack>
                      </Paper>
                    </Link>
                  ))}
                  {userComments.length > 5 && (
                    <Text size="xs" c="dimmed" ta="center">+ {userComments.length - 5} comentarios más</Text>
                  )}
                </Stack>
              )
            )}
          </Stack>
        </Paper>

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
