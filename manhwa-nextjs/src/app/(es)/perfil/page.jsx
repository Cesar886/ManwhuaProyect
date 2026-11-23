"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  UnstyledButton,
  useComputedColorScheme,
  rem,
  TextInput,
  Select,
  Textarea,
  Indicator,
  Slider,
  Switch,
  Popover,
  ColorSwatch,
} from '@mantine/core';
import { useMediaQuery, useHover } from '@mantine/hooks';
import { useAuth } from '@/contexts/AuthContext';
import api, { followUser, unfollowUser, updateUserBanner } from '@/api/client';
import {
  IconBook,
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
  IconMessage,
  IconThumbUp,
  IconThumbDown,
  IconMessageCircle,
  IconBrandX,
  IconBrandInstagram,
  IconBrandDiscord,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { getCurrentUser } from '@/api/client';
import { getStreak, getStreakStreamUrl } from '@/api/progress';
import { getUserAchievements } from '@/api/achievements';
import { VitrinaLogros } from '@/components/achievements';
import styles from '@/app/(es)/user-profile/UserProfile.module.css';
import Link from 'next/link';
import Header from '@/components/Header';
import { getSocialLinkErrors, getSocialLinkInput } from '@/utils/socialLinks';
import SocialProfileLinks from '@/components/SocialProfileLinks';
import UserFollowListModal from '@/components/UserFollowListModal';
import { useProfilePresence } from '@/hooks/usePresence';

const MAX_DISPLAY_NAME_LENGTH = 10;
const DEFAULT_FAVORITE_CHARACTER_COLOR = '#E64980';
const FAVORITE_CHARACTER_PALETTE = [
  '#E64980',
  '#F06595',
  '#FA5252',
  '#FD7E14',
  '#FAB005',
  '#40C057',
  '#12B886',
  '#15AABF',
  '#228BE6',
  '#7950F2',
  '#AE3EC9',
];

const normalizeFavoriteCharacters = (characters) => {
  if (!Array.isArray(characters)) return [];
  return characters.slice(0, 3).map((character, index) => ({
    type: character?.type === 'husband' ? 'husband' : 'waifu',
    name: String(character?.name || '').normalize('NFC').trim().slice(0, 10),
    color: FAVORITE_CHARACTER_PALETTE.includes(String(character?.color || '').toUpperCase())
      ? String(character.color).toUpperCase()
      : DEFAULT_FAVORITE_CHARACTER_COLOR,
    position: index,
  }));
};

const FavoriteCharacterBadges = ({ characters }) => {
  const normalized = normalizeFavoriteCharacters(characters);
  if (normalized.length === 0) return null;

  const getBadgeTextColor = (hex) => {
    const channels = [1, 3, 5].map((index) =>
      parseInt(hex.slice(index, index + 2), 16) / 255
    ).map((value) =>
      value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    );
    const backgroundLuminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    const blackContrast = (backgroundLuminance + 0.05) / (0.0025 + 0.05);
    const whiteContrast = (1.05) / (backgroundLuminance + 0.05);
    return blackContrast >= whiteContrast ? '#20242A' : '#FFFFFF';
  };

  return (
    <Group gap={6} wrap="wrap" style={{ maxWidth: '100%' }}>
      {normalized.map((character) => (
        <Badge
          key={`${character.position}-${character.type}-${character.name}`}
          variant="light"
          radius="xl"
          size="sm"
          styles={{
            root: {
              backgroundColor: `${character.color}33`,
              color: getBadgeTextColor(character.color),
              border: `1px solid ${character.color}99`,
              textShadow: 'none',
            },
          }}
        >
          my {character.type} {character.name}
        </Badge>
      ))}
    </Group>
  );
};

const COUNTRY_CODES = `
AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ
BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ
CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ
DE DJ DK DM DO DZ
EC EE EG EH ER ES ET
FI FJ FK FM FO FR
GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY
HK HM HN HR HT HU
ID IE IL IM IN IO IQ IR IS IT
JE JM JO JP
KE KG KH KI KM KN KP KR KW KY KZ
LA LB LC LI LK LR LS LT LU LV LY
MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ
NA NC NE NF NG NI NL NO NP NR NU NZ
OM
PA PE PF PG PH PK PL PM PN PR PS PT PW PY
QA
RE RO RS RU RW
SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ
TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ
UA UG UM US UY UZ
VA VC VE VG VI VN VU
WF WS
YE YT
ZA ZM ZW
`.trim().split(/\s+/);

const PRIORITY_COUNTRY_CODES = [
  'MX', 'US', 'ES', 'AR', 'CO', 'CL', 'PE', 'VE', 'EC', 'GT', 'CU', 'BO', 'HN',
  'SV', 'NI', 'CR', 'PA', 'DO', 'PR', 'BR', 'CA', 'GB', 'FR', 'DE', 'IT', 'JP',
  'KR', 'CN', 'PT', 'AU',
];

const countryNames = new Intl.DisplayNames(['es'], { type: 'region' });
const getCountryFlag = (code) => String.fromCodePoint(
  ...code.toUpperCase().split('').map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65),
);
const countryNameByCode = new Map(
  COUNTRY_CODES.map((code) => [code, countryNames.of(code) || code]),
);
const countryOrder = [
  ...PRIORITY_COUNTRY_CODES,
  ...COUNTRY_CODES
    .filter((code) => !PRIORITY_COUNTRY_CODES.includes(code))
    .sort((a, b) => countryNameByCode.get(a).localeCompare(countryNameByCode.get(b), 'es')),
];
const countryOptions = countryOrder.map((code) => ({
  value: code,
  label: `${getCountryFlag(code)} ${countryNameByCode.get(code)}`,
}));
const normalizeCountryName = (name) => String(name)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLocaleLowerCase('es');
const getCountryCode = (location) => {
  const value = String(location || '').trim();
  if (countryNameByCode.has(value.toUpperCase())) return value.toUpperCase();
  const countryName = value.split(',').pop();
  return countryOptions.find(({ value: code }) => (
    normalizeCountryName(countryName) === normalizeCountryName(countryNameByCode.get(code))
  ))?.value || '';
};
const getCountry = (location) => {
  const code = getCountryCode(location);
  return code ? {
    code,
    flag: getCountryFlag(code),
    name: countryNameByCode.get(code),
  } : null;
};

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

// Estilos compartidos para todos los Tooltips de la página
const tooltipStyles = (isDark) => ({
  tooltip: {
    background: isDark ? 'rgba(15,23,42,0.97)' : 'rgba(255,255,255,0.97)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
    boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderRadius: rem(12),
    padding: `${rem(8)} ${rem(14)}`,
    color: isDark ? '#e2e8f0' : '#1e293b',
  },
  arrow: {
    background: isDark ? 'rgba(15,23,42,0.97)' : 'rgba(255,255,255,0.97)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
  },
});

// Avatar Premium con anillo animado e indicador de presencia
const AVATAR_COLORS = ['blue', 'cyan', 'violet', 'pink', 'indigo', 'red', 'teal', 'orange'];

const PremiumAvatar = ({ src, size, initials, name, streak, isDark, isOnline }) => {
  const { hovered, ref } = useHover();

  return (
    <Box pos="relative" ref={ref} className={styles.avatarContainer}>
      <Box className={styles.avatarRing} style={{ opacity: hovered ? 1 : 0.8 }} />
      <Box
        className={styles.avatarRingInner}
        style={{ background: isDark ? '#0f172a' : '#ffffff' }}
      />

      <Indicator
        inline
        disabled={!isOnline}
        size={20}
        offset={4}
        position="bottom-end"
        color="teal"
        withBorder
        processing
        styles={{
          indicator: {
            border: `3px solid ${isDark ? '#0f172a' : '#ffffff'}`,
            zIndex: 2,
          },
        }}
      >
        <Avatar
          src={src}
          name={name}
          color="initials"
          allowedInitialsColors={AVATAR_COLORS}
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
      </Indicator>

      {streak > 0 && (
        <Tooltip
          label={
            <Group gap={6} align="center">
              <IconFlame size={14} color="#f97316" />
              <Text size="sm" fw={700}>{streak} día{streak !== 1 ? 's' : ''} de racha</Text>
            </Group>
          }
          withArrow
          position="top"
          styles={tooltipStyles(isDark)}
        >
          <Badge
            color="orange"
            variant="gradient"
            gradient={{ from: 'orange', to: 'red', deg: 135 }}
            circle
            size="xl"
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
            <IconFlame size={14} />
          </Badge>
        </Tooltip>
      )}
    </Box>
  );
};

// Loading Skeleton Premium
const ProfileSkeleton = ({ isDark, isMobile }) => (
  <Box className={`${styles.skeletonContainer} ${isDark ? styles.darkMode : styles.lightMode}`} style={{ minHeight: '100vh', padding: isMobile ? '1rem' : '2rem', paddingTop: isMobile ? 90 : 110 }}>
    <Header />
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
  const isDark = useComputedColorScheme() === 'dark';
  const { updateProfile, updateAvatar, updateFollowingCount, openLogin, user: authUser } = useAuth();
  const params = useParams();
  const router = useRouter();
  const routeUsername = Array.isArray(params?.username) ? params.username[0] : params?.username;

  const isMobile = useMediaQuery('(max-width: 48em)');

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [avatarSrc, setAvatarSrc] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef(null);
  const [bannerUploading, setBannerUploading] = useState(false);
  const bannerInputRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [recentReads, setRecentReads] = useState([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [streakData, setStreakData] = useState({ streak: 0, maxStreak: 0, readToday: false, chaptersRead: 0, totalDaysRead: 0 });
  const streak = streakData.streak;
  const [achievementsData, setAchievementsData] = useState(null);

  // Edit profile modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    display_name: '',
    bio: '',
    location: '',
    show_active_reader: true,
    social_links: { x: '', instagram: '', discord: '' },
    favorite_characters: [],
  });
  const [editSaving, setEditSaving] = useState(false);
  const [followListType, setFollowListType] = useState(null);
  const [followBusy, setFollowBusy] = useState(false);

  // Community interactions state
  const [userRatings, setUserRatings] = useState([]);
  const [ratingsLoading, setRatingsLoading] = useState(true);
  const [userComments, setUserComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [userBookmarks, setUserBookmarks] = useState([]);
  const [bookmarksLoading, setBookmarksLoading] = useState(true);
  const [profileTab, setProfileTab] = useState('continue');
  const [ratingsVisibleCount, setRatingsVisibleCount] = useState(6);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setUser(null);
    const loadProfile = routeUsername
      ? api.get('users', encodeURIComponent(routeUsername))
      : getCurrentUser().then((response) => {
        const currentUser = response?.data?.user || response?.user || response?.data || response;
        if (!currentUser?.username) return null;
        return api.get('users', encodeURIComponent(currentUser.username));
      });

    loadProfile
      .then((res) => {
        if (!res) {
          if (active) setUser(null);
          return;
        }
        const source = res?.data?.user || res?.user || res?.data || res;
        if (!source || !active) return;
        const data = routeUsername ? {
          ...source,
          display_name: source.displayName || source.display_name,
          avatar_url: source.avatarUrl || source.avatar_url,
          banner_url: source.bannerUrl || source.banner_url,
          banner_position_x: source.bannerPositionX ?? source.banner_position_x ?? 50,
          banner_position_y: source.bannerPositionY ?? source.banner_position_y ?? 50,
          show_active_reader: source.showActiveReader ?? source.show_active_reader,
          social_links: source.socialLinks || source.social_links,
          favorite_characters: normalizeFavoriteCharacters(source.favoriteCharacters || source.favorite_characters),
          favoriteCharacters: normalizeFavoriteCharacters(source.favoriteCharacters || source.favorite_characters),
          followers_count: source.stats?.followers ?? source.followers_count,
          following_count: source.stats?.following ?? source.following_count,
          collections_count: source.stats?.collections ?? source.collections_count,
          created_at: source.joinedAt || source.created_at,
        } : {
          ...source,
          banner_position_x: source.bannerPositionX ?? source.banner_position_x ?? 50,
          banner_position_y: source.bannerPositionY ?? source.banner_position_y ?? 50,
        };
        setUser(data);
        setAvatarSrc(data.avatar_url || data.avatarUrl || data.avatar || null);
      })
      .catch((error) => {
        if (active) {
          console.error('Error loading profile:', error);
          setUser(null);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [routeUsername]);

  const currentUserId = authUser?.id || authUser?._id;
  const profileUserId = user?.id || user?._id;
  const isOwner = Boolean(currentUserId && profileUserId && String(currentUserId) === String(profileUserId));
  const showActiveReader = user?.showActiveReader ?? user?.show_active_reader ?? true;
  const { isOnline } = useProfilePresence(profileUserId, showActiveReader);

  useEffect(() => {
    if (!user?.username) {
      setRecentReads([]);
      setRecentLoading(false);
      setStreakData({ streak: 0, maxStreak: 0, readToday: false, chaptersRead: 0, totalDaysRead: 0 });
      setAchievementsData(null);
      return;
    }

    let active = true;
    const username = encodeURIComponent(user.username);
    setRecentLoading(true);
    setAchievementsData(null);
    api.get('users', `${username}/progress?limit=6`)
      .then(response => {
        if (active) setRecentReads(response?.data?.recent || []);
      })
      .catch(error => {
        console.error('Error fetching public reading progress:', error);
        if (active) setRecentReads([]);
      })
      .finally(() => {
        if (active) setRecentLoading(false);
      });

    getUserAchievements(user.username)
      .then(data => {
        if (!active) return;
        setAchievementsData(data);
        if (!isOwner) {
          setStreakData({
            streak: data?.stats?.streak || 0,
            maxStreak: 0,
            readToday: false,
            chaptersRead: data?.stats?.totalChapters || 0,
            totalDaysRead: 0,
          });
        }
      })
      .catch(error => {
        console.error('Error fetching profile achievements:', error);
        if (active) setAchievementsData(null);
      });

    if (isOwner) {
      getStreak()
        .then(data => {
          if (active) {
            setStreakData({
              streak: data?.streak || 0,
              maxStreak: data?.maxStreak || 0,
              readToday: data?.readToday || false,
              chaptersRead: data?.chaptersRead || 0,
              totalDaysRead: data?.totalDaysRead || 0,
            });
          }
        })
        .catch(error => {
          console.error('Error fetching reading streak:', error);
          if (active) setStreakData({ streak: 0, maxStreak: 0, readToday: false, chaptersRead: 0, totalDaysRead: 0 });
        });
    } else {
      setStreakData({ streak: 0, maxStreak: 0, readToday: false, chaptersRead: 0, totalDaysRead: 0 });
    }

    return () => { active = false; };
  }, [user?.username, isOwner]);

  useEffect(() => {
    if (!user?.username) {
      setUserBookmarks([]);
      setBookmarksLoading(false);
      return;
    }

    let active = true;
    setBookmarksLoading(true);
    api.get('users', `${encodeURIComponent(user.username)}/bookmarks?page=1&limit=50`)
      .then(response => {
        if (active) setUserBookmarks(response?.data?.bookmarks || []);
      })
      .catch(error => {
        console.error('Error fetching profile favorites:', error);
        if (active) setUserBookmarks([]);
      })
      .finally(() => {
        if (active) setBookmarksLoading(false);
      });

    return () => { active = false; };
  }, [user?.username]);

  // SSE — actualizaciones de racha en tiempo real
  useEffect(() => {
    if (!isOwner) return;
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
      } catch { /* noop */ }
    });

    es.onerror = () => { es.close(); };

    return () => { es.close(); };
  }, [isOwner]);

  // Fetch user ratings and comments when user is loaded
  useEffect(() => {
    if (!user?.username) return;

    let active = true;

    const fetchCommunityData = async () => {
      setRatingsLoading(true);
      setCommentsLoading(true);

      try {
        const { default: api } = await import('@/api/client');
        const username = encodeURIComponent(user.username);
        const ratings = [];
        let ratingsPage = 1;
        let ratingsTotalPages = 1;

        do {
          const ratingsRes = await api.get('users', `${username}/ratings?page=${ratingsPage}&limit=50`);
          const pageData = ratingsRes?.data?.ratings || ratingsRes?.ratings || [];
          if (Array.isArray(pageData)) ratings.push(...pageData);
          ratingsTotalPages = ratingsRes?.data?.pagination?.totalPages
            || ratingsRes?.pagination?.totalPages
            || 1;
          ratingsPage += 1;
        } while (ratingsPage <= ratingsTotalPages);

        if (active) {
          setUserRatings([...ratings].sort((a, b) =>
            new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
          ));
        }
      } catch (e) {
        console.error('Error fetching ratings:', e);
        if (active) setUserRatings([]);
      } finally {
        if (active) setRatingsLoading(false);
      }

      try {
        const { default: api } = await import('@/api/client');
        const username = encodeURIComponent(user.username);
        const comments = [];
        let commentsPage = 1;
        let commentsTotalPages = 1;

        do {
          const commentsRes = await api.get('users', `${username}/comments?page=${commentsPage}&limit=50`);
          const pageData = commentsRes?.data?.comments || commentsRes?.comments || [];
          if (Array.isArray(pageData)) comments.push(...pageData);
          commentsTotalPages = commentsRes?.data?.pagination?.totalPages
            || commentsRes?.pagination?.totalPages
            || 1;
          commentsPage += 1;
        } while (commentsPage <= commentsTotalPages);

        if (active) setUserComments(comments);
      } catch (e) {
        console.error('Error fetching comments:', e);
        if (active) setUserComments([]);
      } finally {
        if (active) setCommentsLoading(false);
      }
    };

    fetchCommunityData();
    return () => { active = false; };
  }, [user?.username]);

  useEffect(() => {
    if (profileTab === 'ratings') setRatingsVisibleCount(6);
  }, [profileTab, user?.username]);

  const getInitials = () => {
    if (!user) return 'U';
    const name = user.display_name || user.name || user.username || 'U';
    const parts = String(name).split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'U';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const openEditModal = useCallback(() => {
    if (!isOwner || !user) return;
    setEditForm({
      display_name: (user.display_name || user.name || user.username || '').slice(0, MAX_DISPLAY_NAME_LENGTH),
      bio: user.bio || '',
      location: getCountryCode(user.location),
      show_active_reader: user.showActiveReader ?? user.show_active_reader ?? true,
      social_links: {
        x: getSocialLinkInput('x', user.social_links?.x || user.socialLinks?.x),
        instagram: getSocialLinkInput('instagram', user.social_links?.instagram || user.socialLinks?.instagram),
        discord: getSocialLinkInput('discord', user.social_links?.discord || user.socialLinks?.discord),
      },
      favorite_characters: normalizeFavoriteCharacters(
        user.favoriteCharacters || user.favorite_characters,
      ),
      banner_position_x: Number(user.banner_position_x ?? user.bannerPositionX ?? 50),
      banner_position_y: Number(user.banner_position_y ?? user.bannerPositionY ?? 50),
    });
    setEditOpen(true);
  }, [user, isOwner]);

  const handleSaveProfile = async () => {
    if (!isOwner || !user) return;
    const favoriteCharacters = (editForm.favorite_characters || []).slice(0, 3).map((character, index) => ({
      type: character?.type === 'husband' ? 'husband' : 'waifu',
      name: String(character?.name || '').normalize('NFC').trim(),
      color: FAVORITE_CHARACTER_PALETTE.includes(String(character?.color || '').toUpperCase())
        ? String(character?.color || '').toUpperCase()
        : DEFAULT_FAVORITE_CHARACTER_COLOR,
      position: index,
    }));
    const invalidFavoriteCharacter = favoriteCharacters.find((character) =>
      !character.name
      || [...character.name].length > 10
      || /[<>]/.test(character.name)
      || /javascript\s*:|script/i.test(character.name)
      || /[\u0000-\u001F\u007F]/.test(character.name)
    );
    if (invalidFavoriteCharacter) {
      notifications.show({
        title: 'Revisa tus personajes favoritos',
        message: 'Los nombres son obligatorios, deben tener máximo 10 caracteres y no pueden contener HTML ni scripts.',
        color: 'red',
      });
      return;
    }
    const socialErrors = getSocialLinkErrors(editForm.social_links);
    if (Object.keys(socialErrors).length > 0) {
      notifications.show({ title: 'Revisa tus redes sociales', message: Object.values(socialErrors)[0], color: 'red' });
      return;
    }

    setEditSaving(true);
    try {
      const userId = user.id || user._id;
      const displayName = editForm.display_name.trim().slice(0, MAX_DISPLAY_NAME_LENGTH);
      const response = await updateProfile(userId, {
        display_name: displayName,
        bio: editForm.bio.trim(),
        location: editForm.location || '',
        show_active_reader: editForm.show_active_reader,
        social_links: editForm.social_links,
        favorite_characters: favoriteCharacters,
      });
      const savedUser = response?.data?.user || response?.user || {};
      const savedUsername = savedUser.username || user.username;
      const savedSocialLinks = savedUser.socialLinks || savedUser.social_links || editForm.social_links;
      const savedFavoriteCharacters = normalizeFavoriteCharacters(
        savedUser.favoriteCharacters || savedUser.favorite_characters || favoriteCharacters,
      );
      setUser(prev => ({
        ...prev,
        ...savedUser,
        username: savedUsername,
        display_name: savedUser.displayName ?? savedUser.display_name ?? displayName,
        bio: savedUser.bio ?? editForm.bio.trim(),
        location: savedUser.location ?? editForm.location,
        show_active_reader: savedUser.showActiveReader ?? savedUser.show_active_reader ?? editForm.show_active_reader,
        social_links: savedSocialLinks,
        favoriteCharacters: savedFavoriteCharacters,
        favorite_characters: savedFavoriteCharacters,
      }));
      if (routeUsername && savedUsername !== user.username) {
        router.replace(`/users/${encodeURIComponent(savedUsername)}`, { scroll: false });
      }
      setEditOpen(false);
      notifications.show({ title: 'Perfil actualizado', message: 'Tus cambios se guardaron correctamente', color: 'cyan', icon: <IconCheck size={16} /> });
    } catch (error) {
      notifications.show({ title: 'Error al guardar', message: error?.message || 'No se pudo actualizar tu perfil', color: 'red' });
    } finally {
      setEditSaving(false);
    }
  };

  const handleAvatarSelection = async (event) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    event.currentTarget.value = '';

    if (!file.type.startsWith('image/')) {
      notifications.show({ title: 'Formato no válido', message: 'Selecciona un archivo de imagen.', color: 'red' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      notifications.show({ title: 'Imagen demasiado grande', message: 'El tamaño máximo permitido es 10 MB.', color: 'red' });
      return;
    }

    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const uploadResponse = await api.upload('upload', 'avatar', formData);
      const uploadedAvatarUrl = uploadResponse?.url || uploadResponse?.data?.url;
      if (!uploadedAvatarUrl) throw new Error('El servidor no devolvió la dirección de la imagen.');

      await updateAvatar(uploadedAvatarUrl);
      setAvatarSrc(uploadedAvatarUrl);
      setUser(prev => ({ ...prev, avatar_url: uploadedAvatarUrl }));
      notifications.show({ title: 'Foto actualizada', message: 'Tu nueva foto de perfil ya está lista.', color: 'cyan', icon: <IconCheck size={16} /> });
    } catch (error) {
      notifications.show({ title: 'No se pudo actualizar la foto', message: error?.message || 'Inténtalo de nuevo.', color: 'red' });
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleBannerSelection = async (event) => {
    const input = event.currentTarget;
    const file = input?.files?.[0];
    if (!file) return;
    input.value = '';
    if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
      notifications.show({ title: 'Imagen no válida', message: 'Selecciona una imagen de hasta 10 MB.', color: 'red' });
      return;
    }

    setBannerUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const response = await api.upload('upload', 'image', formData);
      const bannerUrl = response?.url || response?.data?.url;
      if (!bannerUrl) throw new Error('El servidor no devolvió la dirección del banner.');
      const positionX = Number(editForm.banner_position_x ?? user.banner_position_x ?? user.bannerPositionX ?? 50);
      const positionY = Number(editForm.banner_position_y ?? user.banner_position_y ?? user.bannerPositionY ?? 50);
      await updateUserBanner(bannerUrl, positionX, positionY);
      setUser((current) => ({
        ...current,
        banner_url: bannerUrl,
        bannerUrl,
        banner_position_x: positionX,
        banner_position_y: positionY,
        bannerPositionX: positionX,
        bannerPositionY: positionY,
      }));
      notifications.show({ title: 'Banner actualizado', message: 'Los visitantes ya pueden ver tu banner nuevo.', color: 'cyan' });
    } catch (error) {
      notifications.show({ title: 'No se pudo actualizar el banner', message: error?.message || 'Inténtalo de nuevo.', color: 'red' });
    } finally {
      setBannerUploading(false);
    }
  };

  const handleSaveBannerPosition = async () => {
    if (!user || !(user.banner_url || user.bannerUrl)) return;

    setBannerUploading(true);
    try {
      const bannerUrl = user.banner_url || user.bannerUrl;
      const positionX = editForm.banner_position_x;
      const positionY = editForm.banner_position_y;
      await updateUserBanner(bannerUrl, positionX, positionY);
      setUser((current) => ({
        ...current,
        banner_position_x: positionX,
        banner_position_y: positionY,
        bannerPositionX: positionX,
        bannerPositionY: positionY,
      }));
      notifications.show({ title: 'Encuadre actualizado', message: 'La posición de tu banner se guardó correctamente.', color: 'cyan', icon: <IconCheck size={16} /> });
    } catch (error) {
      notifications.show({ title: 'No se pudo guardar el encuadre', message: error?.message || 'Inténtalo de nuevo.', color: 'red' });
    } finally {
      setBannerUploading(false);
    }
  };

  const handleShare = async () => {
    const name = user?.display_name || user?.name || user?.username || 'Usuario';
    const profileUrl = `${window.location.origin}/users/${encodeURIComponent(user?.username || '')}`;
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

  const toggleFollow = async () => {
    if (!authUser) {
      openLogin();
      return;
    }
    if (!user || isOwner || followBusy) return;

    const wasFollowing = Boolean(user.isFollowing);
    setFollowBusy(true);
    setUser((current) => ({
      ...current,
      isFollowing: !wasFollowing,
      followers_count: Math.max(0, Number(current.followers_count || 0) + (wasFollowing ? -1 : 1)),
    }));

    try {
      const response = wasFollowing
        ? await unfollowUser(user.username)
        : await followUser(user.username);
      if (typeof response?.data?.followersCount === 'number') {
        setUser((current) => ({
          ...current,
          isFollowing: response.data.isFollowing,
          followers_count: response.data.followersCount,
          following_count: response.data.followingCount ?? current.following_count,
        }));
      }
      if (typeof response?.data?.viewerFollowingCount === 'number') {
        updateFollowingCount(response.data.viewerFollowingCount);
      }
    } catch (error) {
      setUser((current) => ({
        ...current,
        isFollowing: wasFollowing,
        followers_count: Math.max(0, Number(current.followers_count || 0) + (wasFollowing ? 1 : -1)),
      }));
      const message = error?.status === 401
        ? 'Inicia sesión nuevamente para seguir a este usuario.'
        : error?.status === 404
          ? 'Este usuario ya no está disponible.'
          : error?.message && error.message !== 'Error interno del servidor'
            ? error.message
            : 'No se pudo completar la acción. Verifica tu conexión e inténtalo de nuevo.';
      notifications.show({ title: 'No se pudo actualizar el seguimiento', message, color: 'red' });
    } finally {
      setFollowBusy(false);
    }
  };

  if (loading) return <ProfileSkeleton isDark={isDark} isMobile={isMobile} />;

  if (!user) {
    if (routeUsername) {
      return (
        <Box className={`${styles.pageContainer} ${isDark ? styles.darkMode : styles.lightMode}`}>
          <Header />
          <Container size="sm" pt={120}>
            <Paper p="xl" radius="xl" ta="center" className={styles.errorCard}>
              <Text size="xl" fw={800} className={styles.gradientText}>Perfil no disponible</Text>
              <Text c="dimmed" mt="sm">Este usuario no existe o su perfil no está disponible.</Text>
            </Paper>
          </Container>
        </Box>
      );
    }
    return (
      <Box className={`${styles.pageContainer} ${isDark ? styles.darkMode : styles.lightMode}`}>
        <Header />
        <Container size="sm" pt={120}>
          <Paper p="xl" radius="xl" ta="center" className={styles.errorCard} style={{ background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(10px)', border: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)' }}>
            <ThemeIcon size={80} radius="xl" variant="gradient" gradient={{ from: 'cyan', to: 'blue', deg: 135 }} mb="lg" style={{ margin: '0 auto', boxShadow: '0 8px 32px rgba(6, 182, 212, 0.3)' }}>
              <IconUsers size={40} stroke={1.5} />
            </ThemeIcon>
            <Text size="xl" fw={800} mb="xs" className={styles.gradientText}>Regístrate en Manhwa Imperial</Text>
            <Text c="dimmed" mb="xl" size="md" maw={400} mx="auto" lh={1.6}>
              Crea una cuenta gratuita para llevar un registro de tus lecturas, guardar tus manhwas favoritos, subir de nivel y participar con la comunidad.
            </Text>
            <Group justify="center">
              <Link href="/register" style={{ textDecoration: 'none', display: 'block' }}>
                <PremiumButton isDark={isDark} size="md">
                  Ir a Registrarse
                </PremiumButton>
              </Link>
            </Group>
          </Paper>
        </Container>
      </Box>
    );
  }

  const userName = user.display_name || user.name || user.username || 'Usuario';
  const userUsername = user.username || 'usuario';
  const userBio = user.bio || 'Sin biografía';
  const userLocation = user.location || '';
  const userCountry = getCountry(userLocation);
  const userJoinDate = user.created_at || user.createdAt;
  const userRole = user.role || 'reader';

  const stats = {
    followers: user.followers_count ?? user.stats?.followers ?? 0,
    following: user.following_count ?? user.stats?.following ?? 0,
    collections: user.collections_count || user.stats?.collections || 0,
    likes: user.likes_count || user.stats?.likes || 0,
    views: user.views_count || user.stats?.views || 0,
    chapters: streakData.chaptersRead || user.chapters_read || user.reading_count || 0,
    streak,
    bookmarks: user.bookmarks_count || user.stats?.bookmarks || 0,
  };
  const socialLinks = user.social_links || user.socialLinks || {};
  const hasSocialLinks = Boolean(socialLinks.x || socialLinks.instagram || socialLinks.discord);
  const favoriteCharacters = normalizeFavoriteCharacters(
    user.favoriteCharacters || user.favorite_characters,
  );

  const joinedDateLabel = userJoinDate
    ? new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(userJoinDate))
    : '';

  const updateOwnFollowingCount = ({ isFollowing }) => {
    if (!isOwner) return;
    setUser(prev => {
      const nextCount = Math.max(0, Number(prev.following_count ?? prev.stats?.following ?? 0) + (isFollowing ? 1 : -1));
      return {
        ...prev,
        following_count: nextCount,
        stats: { ...prev.stats, following: nextCount },
      };
    });
  };

  const formatNum = (n) => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(n);

  const roleBadges = {
    superadmin: { label: 'Super Admin', color: 'red', icon: IconCrown, gradient: { from: 'red', to: 'pink' } },
    admin: { label: 'Admin', color: 'orange', icon: IconCrown, gradient: { from: 'orange', to: 'yellow' } },
    // moderator: { label: 'Mod', color: 'violet', icon: IconStarFilled, gradient: { from: 'violet', to: 'grape' } },
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
      <Container size="lg" px={isMobile ? 0 : 'md'} pt={isMobile ? 72 : 96} className={styles.profileContainerShell}>

        {/* HEADER CARD */}
        <Paper
          p={isMobile ? 'md' : 'xl'}
          radius={rem(24)}
          mb="xl"
          className={`${styles.headerCard} ${styles.legacyHeaderCard}`}
          style={{ position: 'relative', zIndex: 2, overflow: 'hidden' }}
        >
          <Box
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: '0 0 auto',
              height: 190,
              backgroundImage: user.banner_url || user.bannerUrl
                ? `linear-gradient(to bottom, rgba(15,23,42,0.12), rgba(15,23,42,0.82)), url("${user.banner_url || user.bannerUrl}")`
                : 'linear-gradient(120deg, rgba(6,182,212,0.16), rgba(139,92,246,0.12))',
              backgroundPosition: `${user.banner_position_x ?? user.bannerPositionX ?? 50}% ${user.banner_position_y ?? user.bannerPositionY ?? 50}%`,
              backgroundSize: 'cover',
              pointerEvents: 'none',
            }}
          />
          <Box className={styles.headerDecoration1} />
          <Box className={styles.headerDecoration2} />

          {/* MOBILE */}
          {isMobile ? (
            <Stack align="center" gap="lg" style={{ position: 'relative', zIndex: 1 }}>
              <PremiumAvatar src={avatarSrc} size={110} initials={getInitials()} name={user?.display_name || user?.name || user?.username || ''} streak={streak} isDark={isDark} isOnline={isOnline} />
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
              <FavoriteCharacterBadges characters={favoriteCharacters} />
              <SocialProfileLinks links={socialLinks} />
              {isOwner && !hasSocialLinks && <Button variant="subtle" size="xs" onClick={openEditModal}>Agregar redes sociales</Button>}
              <Group gap={rem(48)} justify="center" mt="md" className={styles.headerStatsGrid}>
                <UnstyledButton onClick={() => setFollowListType('following')} aria-label={`Ver a quién sigue ${userName}`}>
                  <ProfileMetric icon={IconUsers} value={formatNum(stats.following)} label="Siguiendo" compact />
                </UnstyledButton>
                <UnstyledButton onClick={() => setFollowListType('followers')} aria-label={`Ver seguidores de ${userName}`}>
                  <ProfileMetric icon={IconUsers} value={formatNum(stats.followers)} label="Seguidores" compact />
                </UnstyledButton>
                {isOwner && <>
                  <ProfileMetric icon={IconBook} value={formatNum(stats.chapters)} label="Caps. leídos" compact color="cyan" />
                  <ProfileMetric icon={IconFlame} value={streak} label="Racha" compact color="orange" />
                </>}
              </Group>
              <Group gap="xs" w="100%">
                {isOwner
                  ? <PremiumButton leftSection={<IconPencil size={15} />} style={{ flex: 1 }} isDark={isDark} onClick={openEditModal}>Editar</PremiumButton>
                  : authUser && <PremiumButton style={{ flex: 1 }} isDark={isDark} onClick={toggleFollow} loading={followBusy}>{user.isFollowing ? 'Siguiendo' : 'Seguir'}</PremiumButton>}
                <PremiumButton variant="outline" leftSection={copied ? <IconCheck size={15} /> : <IconShare size={15} />} style={{ flex: 1 }} isDark={isDark} onClick={handleShare}>
                  {copied ? 'Copiado' : 'Compartir'}
                </PremiumButton>
              </Group>
            </Stack>
          ) : (
            /* DESKTOP + TABLET */
            <Group gap="xl" align="flex-start" wrap="nowrap" style={{ position: 'relative', zIndex: 1 }}>
              <PremiumAvatar src={avatarSrc} size={avatarSize} initials={getInitials()} name={user?.display_name || user?.name || user?.username || ''} streak={streak} isDark={isDark} isOnline={isOnline} />
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
                      <Badge
                        variant="light"
                        color="gray"
                        radius="xl"
                        leftSection={!userCountry && <IconMapPin size={10} />}
                        aria-label={userCountry ? `País: ${userCountry.name}` : `Ubicación: ${userLocation}`}
                        className={styles.profileMetaBadge}
                      >
                        {userCountry ? userCountry.flag : userLocation}
                      </Badge>
                    )}
                  </Group>
                </Stack>
                {userBio !== 'Sin biografía' && (
                  <Text size="sm" maw={540} lh={1.65} style={{ opacity: 0.75 }}>{userBio}</Text>
                )}
                <FavoriteCharacterBadges characters={favoriteCharacters} />
                <SocialProfileLinks links={socialLinks} />
                {isOwner && !hasSocialLinks && <Button variant="subtle" size="xs" onClick={openEditModal} w="fit-content">Agregar redes sociales</Button>}
                <Group gap={rem(56)} mt="lg" className={styles.headerStatsGrid}>
                  <UnstyledButton onClick={() => setFollowListType('following')} aria-label={`Ver a quién sigue ${userName}`}>
                    <ProfileMetric icon={IconUsers} value={formatNum(stats.following)} label="Siguiendo" />
                  </UnstyledButton>
                  <UnstyledButton onClick={() => setFollowListType('followers')} aria-label={`Ver seguidores de ${userName}`}>
                    <ProfileMetric icon={IconUsers} value={formatNum(stats.followers)} label="Seguidores" />
                  </UnstyledButton>
                  {isOwner && <>
                    <ProfileMetric icon={IconBook} value={formatNum(stats.chapters)} label="Caps. leídos" color="cyan" />
                    <ProfileMetric icon={IconFlame} value={streak} label="Racha" color="orange" />
                  </>}
                </Group>
              </Stack>
              <Stack gap="sm" align="flex-end" style={{ flexShrink: 0, padding: rem(9) }}>
                {isOwner
                  ? <PremiumButton leftSection={<IconPencil size={16} />} isDark={isDark} onClick={openEditModal}>Editar perfil</PremiumButton>
                  : authUser && <PremiumButton isDark={isDark} onClick={toggleFollow} loading={followBusy}>{user.isFollowing ? 'Siguiendo' : 'Seguir'}</PremiumButton>}
                <PremiumButton variant="outline" leftSection={copied ? <IconCheck size={16} /> : <IconShare size={16} />} isDark={isDark} onClick={handleShare}>
                  {copied ? 'Copiado' : 'Compartir'}
                </PremiumButton>
              </Stack>
            </Group>
          )}
        </Paper>

        {/* CABECERA PREMIUM ESTILO PERFIL SOCIAL */}
        <Paper p={0} radius={20} mb={16} className={styles.headerCard}>
          <Box
            aria-hidden="true"
            className={styles.profileBanner}
            style={{
              backgroundImage: user.banner_url || user.bannerUrl
                ? `linear-gradient(to bottom, rgba(15,23,42,0.05), rgba(15,23,42,0.78)), url("${user.banner_url || user.bannerUrl}")`
                : 'linear-gradient(135deg, #22d3ee 0%, #0891b2 48%, #172554 100%)',
              backgroundPosition: `${user.banner_position_x ?? user.bannerPositionX ?? 50}% ${user.banner_position_y ?? user.bannerPositionY ?? 50}%`,
              backgroundSize: 'cover',
            }}
          />
          <Box className={styles.profileHeaderBody}>
            <Box className={styles.profileAvatarActions}>
              <Box className={styles.profileAvatarWrap}>
                <PremiumAvatar src={avatarSrc} size={isMobile ? 88 : 120} initials={getInitials()} name={userName} streak={streak} isDark={isDark} isOnline={isOnline} />
              </Box>
              <Group gap="xs" wrap="nowrap" className={styles.profileActions}>
                {isOwner
                  ? <Button variant="default" radius="xl" h={36} leftSection={<IconPencil size={16} />} onClick={openEditModal} className={styles.profileActionButton}>Editar perfil</Button>
                  : authUser && <Button variant="default" radius="xl" h={36} onClick={toggleFollow} loading={followBusy} className={styles.profileActionButton}>{user.isFollowing ? 'Siguiendo' : 'Seguir'}</Button>}
                <Button variant="default" radius="xl" h={36} leftSection={copied ? <IconCheck size={16} /> : <IconShare size={16} />} onClick={handleShare} className={styles.profileActionButton}>
                  {copied ? 'Copiado' : 'Compartir'}
                </Button>
              </Group>
            </Box>

            <Box className={styles.profileIdentity}>
              <Group gap={8} wrap="nowrap" align="center" className={styles.profileNameRow}>
                <Text fw={700} size={isMobile ? 20 : 22} lh={1.15}>{userName}</Text>
                <Badge variant="light" color={role.color} size="sm" radius="sm" leftSection={<RoleIcon size={10} />}>{role.label}</Badge>
              </Group>
              <Text size="sm" c="dimmed" className={styles.profileUsername}>@{userUsername}</Text>
              {userBio !== 'Sin biografía' && (
                <Text size="sm" lh={1.55} className={styles.profileBio}>{userBio}</Text>
              )}
              <FavoriteCharacterBadges characters={favoriteCharacters} />
              <Group gap={12} wrap="wrap" className={styles.profileMetaRow}>
                <Group gap={6} wrap="nowrap" style={{ flexShrink: 0 }}>
                  <IconCalendar size={15} stroke={1.7} />
                  <Text size="sm" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                    Se unió en {joinedDateLabel}
                  </Text>
                </Group>
                {userLocation && (
                  <Group gap={6} wrap="nowrap">
                    {userCountry
                      ? <Text size="lg" lh={1} aria-label={`País: ${userCountry.name}`}>{userCountry.flag}</Text>
                      : <IconMapPin size={15} stroke={1.7} />}
                    {!userCountry && <Text size="sm" c="dimmed">{userLocation}</Text>}
                  </Group>
                )}
              </Group>
              <Box className={styles.profileStatsRow}>
                <UnstyledButton onClick={() => setFollowListType('following')} aria-label={`Ver a quién sigue ${userName}`}>
                  <Text size="sm"><Text span fw={700}>{formatNum(stats.following)}</Text>{' '}<Text span c="dimmed">Siguiendo</Text></Text>
                </UnstyledButton>
                <UnstyledButton onClick={() => setFollowListType('followers')} aria-label={`Ver seguidores de ${userName}`}>
                  <Text size="sm"><Text span fw={700}>{formatNum(stats.followers)}</Text>{' '}<Text span c="dimmed">Seguidores</Text></Text>
                </UnstyledButton>
                  <Text size="sm"><Text span fw={700}>{formatNum(stats.chapters)}</Text>{' '}<Text span c="dimmed">Caps. leídos</Text></Text>
                  <Text size="sm"><Text span fw={700}>{streak}</Text></Text>
                  <IconFlame size={13} stroke={2} className={styles.streakChipIcon} />

              </Box>
              {hasSocialLinks && <SocialProfileLinks links={socialLinks} />}
              {isOwner && !hasSocialLinks && (
                <Button variant="subtle" size="xs" onClick={openEditModal} className={styles.profileSocialEdit}>Agregar redes sociales</Button>
              )}
            </Box>
          </Box>
        </Paper>

        <Box className={styles.profileTabs} role="tablist" aria-label="Secciones del perfil">
          {[
            ['continue', 'Historial'],
            ['achievements', 'Logros'],
            ['favorites', 'Favoritos'],
            ['comments', 'Comentarios'],
            ['ratings', 'Calificaciones'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={profileTab === key}
              className={`${styles.profileTab} ${profileTab === key ? styles.profileTabActive : ''}`}
              onClick={() => setProfileTab(key)}
            >
              {label}
            </button>
          ))}
        </Box>

        {/* CONTINUAR LEYENDO */}
        <Paper p={isMobile ? 'md' : 'xl'} radius={20} mb={16} className={`${styles.infoCard} ${isDark ? styles.darkMode : styles.lightMode}`} style={{ position: 'relative', overflow: 'hidden', display: profileTab === 'continue' ? 'block' : 'none' }}>
          <Box style={{ position: 'absolute', top: -60, left: -60, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <Stack gap="lg" style={{ position: 'relative', zIndex: 1 }}>
            {recentLoading ? (
              <SimpleGrid cols={{ base: 3, sm: 4, md: 6 }} spacing={isMobile ? 'xs' : 'sm'} className={styles.readingGrid}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <Stack key={i} gap="xs">
                    <Skeleton height={isMobile ? 120 : 160} radius="lg" />
                    <Skeleton height={10} width="80%" radius="xl" />
                    <Skeleton height={8} width="50%" radius="xl" />
                  </Stack>
                ))}
              </SimpleGrid>
            ) : recentReads.length > 0 ? (
              <SimpleGrid cols={{ base: 3, sm: 4, md: 6 }} spacing={isMobile ? 'xs' : 'sm'} className={styles.readingGrid}>
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
                            <Badge size="xs" variant="filled" color="dark" style={{ position: 'absolute', top: 6, right: 6, opacity: 0.85, fontSize: rem(9), padding: '0.25rem 0.6rem', lineHeight: 1 }}>
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
                  <Text size="sm" c="dimmed" ta="center">No hay lecturas recientes para mostrar</Text>
                </Stack>
              </Center>
            )}
          </Stack>
        </Paper>

        {/* GAMIFICACIÓN */}
        <Grid gutter={16} mb={16} align="stretch" className={styles.gamificationGrid} style={{ display: profileTab === 'achievements' ? 'grid' : 'none' }}>
          <Grid.Col id="vitrina-logros" span={12}>
            <VitrinaLogros stats={achievementsData?.stats || { streak }} isDark={isDark} isMobile={isMobile} />
          </Grid.Col>
        </Grid>

        <Paper
          p={isMobile ? 'md' : 'xl'}
          radius={20}
          mb={16}
          className={`${styles.infoCard} ${isDark ? styles.darkMode : styles.lightMode}`}
          style={{ display: profileTab === 'favorites' ? 'block' : 'none' }}
        >
          <Stack gap="lg">
            {bookmarksLoading ? (
              <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }} spacing="sm">
                {[...Array(5)].map((_, index) => <Skeleton key={index} height={180} radius="lg" />)}
              </SimpleGrid>
            ) : userBookmarks.length ? (
              <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }} spacing="sm">
                {userBookmarks.map((bookmark) => (
                  <Link key={bookmark.id} href={`/manhwa/${bookmark.series.slug}`} style={{ textDecoration: 'none' }}>
                    <Stack gap="xs">
                      <Box style={{ position: 'relative', borderRadius: rem(12), overflow: 'hidden', aspectRatio: '2/3' }}>
                        {bookmark.series.coverUrl ? (
                          <Image src={bookmark.series.coverUrl} alt={bookmark.series.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <Center h="100%" bg={isDark ? 'dark.6' : 'gray.1'}><IconBook size={24} /></Center>
                        )}
                      </Box>
                      <Text size="xs" fw={600} lineClamp={2}>{bookmark.series.title}</Text>
                    </Stack>
                  </Link>
                ))}
              </SimpleGrid>
            ) : (
              <Center py="xl">
                <Text size="sm" c="dimmed">Este usuario aún no tiene favoritos públicos.</Text>
              </Center>
            )}
          </Stack>
        </Paper>

        {/* HISTORIAL DE INTERACCIONES (COMUNIDAD) */}
        <Paper p={isMobile ? 'md' : 'xl'} radius={20} mb={16} className={`${styles.infoCard} ${isDark ? styles.darkMode : styles.lightMode}`} style={{ position: 'relative', overflow: 'hidden', display: profileTab === 'ratings' || profileTab === 'comments' ? 'block' : 'none' }}>
          <Stack gap="lg" style={{ position: 'relative', zIndex: 1 }}>
            
            {/* Contenido según tab */}
            {profileTab === 'ratings' ? (
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
                    <Text c="dimmed" size="sm">No hay calificaciones para mostrar</Text>
                    <Button component={Link} href="/mangas" variant="light" color="violet" size="xs" radius="xl">
                      Explorar Manhwas
                    </Button>
                  </Stack>
                </Center>
              ) : (
                <Stack gap="sm">
                  {userRatings.slice(0, ratingsVisibleCount).map((rating) => (
                    <Link
                      key={rating.id}
                      href={rating.ratingType === 'chapter' && rating.chapterNumber
                        ? `/manhwa/${rating.series?.slug}/capitulo/${rating.chapterNumber}`
                        : `/manhwa/${rating.series?.slug}`}
                      style={{ textDecoration: 'none' }}
                    >
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
                                <Badge size="xs" variant="light" color="cyan" style={{ padding: '0.25rem 0.6rem', lineHeight: 1 }}>Cap. {rating.chapterNumber}</Badge>
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
                            {new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(rating.createdAt))}
                          </Text>
                        </Group>
                      </Paper>
                    </Link>
                  ))}
                  {ratingsVisibleCount < userRatings.length && (
                    <Center mt="xs">
                      <Button
                        variant="subtle"
                        color="gray"
                        size="xs"
                        radius="xl"
                        onClick={() => setRatingsVisibleCount((count) => count + 6)}
                      >
                        Ver más
                      </Button>
                    </Center>
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
                    <Text c="dimmed" size="sm">No hay comentarios para mostrar</Text>
                    <Button component={Link} href="/mangas" variant="light" color="cyan" size="xs" radius="xl">
                      Explorar Manhwas
                    </Button>
                  </Stack>
                </Center>
              ) : (
                <Stack gap="sm">
                  {userComments.map((comment) => (
                    <Link
                      key={comment.id}
                      href={comment.seriesSlug
                        ? comment.targetType === 'chapter' && comment.chapterNumber
                          ? `/manhwa/${comment.seriesSlug}/capitulo/${comment.chapterNumber}`
                          : `/manhwa/${comment.seriesSlug}`
                        : '#'}
                      style={{ textDecoration: 'none' }}
                    >
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
                                <Badge size="xs" variant="light" color={comment.targetType === 'chapter' ? 'cyan' : 'violet'} style={{ padding: '0.25rem 0.6rem', lineHeight: 1 }}>
                                  {comment.targetType === 'chapter' ? `Cap. ${comment.chapterNumber}` : 'Serie'}
                                </Badge>
                              </Stack>
                            </Group>
                            <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                              {new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(comment.createdAt))}
                            </Text>
                          </Group>
                          <Text size="sm" lineClamp={2} style={{ opacity: 0.85 }}>
                            {comment.isSpoiler ? (
                              <Badge size="xs" color="orange" variant="light" style={{ padding: '0.25rem 0.6rem', lineHeight: 1 }}>Spoiler oculto</Badge>
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
                </Stack>
              )
            )}
          </Stack>
        </Paper>

      </Container>

      {/* MODAL EDITAR PERFIL */}
      {isOwner && <Modal
        opened={editOpen}
        onClose={() => setEditOpen(false)}
        title={
          <Group gap="md" wrap="nowrap">
            <ThemeIcon
              size={42}
              radius="xl"
              variant="gradient"
              gradient={{ from: 'cyan', to: 'teal' }}
              style={{ boxShadow: '0 6px 18px rgba(6,182,212,0.28)', flexShrink: 0 }}
            >
              <IconPencil size={19} />
            </ThemeIcon>
            <Stack gap={2}>
              <Text fw={800} size="lg" lh={1.2}>Editar perfil</Text>
              <Text size="xs" c="dimmed" fw={500}>Personaliza cómo te ve la comunidad</Text>
            </Stack>
          </Group>
        }
        centered
        radius="xl"
        size={isMobile ? 'full' : 680}
        overlayProps={{ backgroundOpacity: 0.6, blur: 10 }}
        classNames={{
          content: `${styles.modalContent} ${isDark ? styles.darkMode : styles.lightMode}`,
          header: styles.modalHeader,
        }}
        styles={{
          header: {
            padding: `${rem(isMobile ? 18 : 24)} ${rem(isMobile ? 18 : 30)}`,
            margin: 0,
          },
          body: { padding: isMobile ? rem(18) : rem(30) },
        }}
      >
        <Stack gap={isMobile ? 'lg' : rem(24)}>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarSelection}
            hidden
          />
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/*"
            onChange={handleBannerSelection}
            hidden
          />
          {/* Preview del avatar + nombre */}
          <Paper
            p={isMobile ? 'md' : 'lg'}
            radius={rem(20)}
            className={styles.profileEditorPreview}
            style={{
              background: isDark
                ? 'linear-gradient(135deg, rgba(6,182,212,0.13), rgba(139,92,246,0.12) 65%, rgba(15,23,42,0.2))'
                : 'linear-gradient(135deg, rgba(6,182,212,0.1), rgba(139,92,246,0.08) 65%, rgba(255,255,255,0.8))',
              border: `1px solid ${isDark ? 'rgba(148,163,184,0.2)' : 'rgba(6,182,212,0.18)'}`,
            }}
          >
            <Group gap="lg" align="center">
              <Box pos="relative">
                <Avatar
                  src={avatarSrc}
                  name={user?.display_name || user?.name || user?.username || ''}
                  color="initials"
                  allowedInitialsColors={AVATAR_COLORS}
                  size={isMobile ? 64 : 80}
                  radius="50%"
                  style={{
                    boxShadow: '0 6px 24px rgba(6,182,212,0.25)',
                    border: `3px solid ${isDark ? 'rgba(6,182,212,0.4)' : 'rgba(6,182,212,0.5)'}`,
                  }}
                >
                  {getInitials()}
                </Avatar>
                <Tooltip
                  label={<Text size="sm" fw={600}>{avatarUploading ? 'Subiendo foto...' : 'Cambiar foto de perfil'}</Text>}
                  withArrow
                  position="top"
                  styles={tooltipStyles(isDark)}
                >
                  <ActionIcon
                    variant="gradient"
                    gradient={{ from: 'cyan', to: 'teal' }}
                    size="sm"
                    radius="xl"
                    pos="absolute"
                    bottom={-2}
                    right={-2}
                    loading={avatarUploading}
                    disabled={avatarUploading}
                    onClick={() => avatarInputRef.current?.click()}
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
                <Text size="xs" c="dimmed">Tu perfil, a tu manera.</Text>
              </Stack>
            </Group>
          </Paper>
          <Button
            variant="light"
            color="cyan"
            leftSection={<IconCamera size={16} />}
            loading={bannerUploading}
            disabled={bannerUploading}
            onClick={() => bannerInputRef.current?.click()}
            fullWidth={isMobile}
            radius="xl"
            size="md"
          >
            Cambiar banner
          </Button>
          {(user.banner_url || user.bannerUrl) && (
            <Paper p="md" radius="lg" withBorder>
              <Stack gap="md">
                <Box
                  role="img"
                  aria-label="Vista previa del encuadre del banner"
                  style={{
                    height: 150,
                    borderRadius: rem(12),
                    backgroundImage: `linear-gradient(rgba(15,23,42,0.12), rgba(15,23,42,0.4)), url("${user.banner_url || user.bannerUrl}")`,
                    backgroundPosition: `${editForm.banner_position_x}% ${editForm.banner_position_y}%`,
                    backgroundSize: 'cover',
                  }}
                />
                <Text size="sm" fw={600}>Ajustar encuadre del banner</Text>
                <Box>
                  <Text size="xs" c="dimmed" mb={6}>Horizontal</Text>
                  <Slider
                    min={0}
                    max={100}
                    step={1}
                    value={editForm.banner_position_x}
                    onChange={(value) => setEditForm((prev) => ({ ...prev, banner_position_x: value }))}
                    label={(value) => `${value}%`}
                    aria-label="Posición horizontal del banner"
                  />
                </Box>
                <Box>
                  <Text size="xs" c="dimmed" mb={6}>Vertical</Text>
                  <Slider
                    min={0}
                    max={100}
                    step={1}
                    value={editForm.banner_position_y}
                    onChange={(value) => setEditForm((prev) => ({ ...prev, banner_position_y: value }))}
                    label={(value) => `${value}%`}
                    aria-label="Posición vertical del banner"
                  />
                </Box>
                <Button
                  variant="light"
                  color="cyan"
                  loading={bannerUploading}
                  disabled={bannerUploading}
                  onClick={handleSaveBannerPosition}
                >
                  Guardar posición
                </Button>
              </Stack>
            </Paper>
          )}

          {/* Campos del formulario */}
          <Stack gap="md">
            <Box>
              <Text fw={750} size="sm">Información personal</Text>
              <Text size="xs" c="dimmed" mt={3}>Cuéntanos un poco sobre ti.</Text>
            </Box>
            <TextInput
              label={<Text size="sm" fw={600} mb={4}>Nombre para mostrar</Text>}
              placeholder="¿Cómo te llamas?"
              value={editForm.display_name}
              onChange={(e) => {
                const displayName = e.currentTarget.value.slice(0, MAX_DISPLAY_NAME_LENGTH);
                setEditForm(prev => ({ ...prev, display_name: displayName }));
              }}
              maxLength={MAX_DISPLAY_NAME_LENGTH}
              radius="xl"
              size="md"
              leftSection={<IconUsers size={16} style={{ opacity: 0.5 }} />}
              error={editForm.display_name.trim().length === 0 ? 'El nombre no puede estar vacío' : null}
              styles={{
                section: {
                  position: 'absolute',
                  left: rem(12),
                  top: 0,
                  bottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                },
                input: {
                  paddingLeft: rem(44),
                  paddingRight: rem(12),
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
                onChange={(e) => {
                  const bio = e.currentTarget.value;
                  setEditForm(prev => ({ ...prev, bio }));
                }}
                maxLength={200}
                minRows={3}
                maxRows={5}
                autosize
                radius="lg"
                size="md"
                styles={{
                  input: {
                    paddingLeft: rem(12),
                    paddingRight: rem(12),
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

            <Select
              label={<Text size="sm" fw={600} mb={4}>Ubicación</Text>}
              placeholder="Selecciona tu país"
              value={editForm.location}
              onChange={(location) => {
                setEditForm(prev => ({ ...prev, location }));
              }}
              data={countryOptions}
              searchable={false}
              clearable
              radius="xl"
              size="md"
              leftSection={<IconMapPin size={16} style={{ opacity: 0.5 }} />}
              styles={{
                section: {
                  color: 'var(--mantine-color-dimmed)',
                },
                input: {
                  paddingLeft: rem(44),
                  paddingRight: rem(12),
                  background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                  border: `1.5px solid ${isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,0,0,0.08)'}`,
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                  '&:focus': { borderColor: 'var(--mantine-color-cyan-5)' },
                },
              }}
            />
            <Paper
              p={isMobile ? 'md' : 'lg'}
              radius="xl"
              style={{
                background: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(15,23,42,0.018)',
                border: `1px solid ${isDark ? 'rgba(148,163,184,0.14)' : 'rgba(15,23,42,0.08)'}`,
              }}
            >
              <Stack gap="sm">
                <Group justify="space-between" align="flex-start" gap="md">
                  <Box>
                    <Group gap={8} align="center">
                      <Text fw={750} size="sm">Waifu / Husband</Text>
                      <Badge variant="light" color="pink" size="sm" radius="xl">
                        {editForm.favorite_characters.length}/3
                      </Badge>
                    </Group>
                    <Text size="xs" c="dimmed" mt={3}>
                      Elige hasta 3 personajes para mostrarlos en tu perfil.
                    </Text>
                  </Box>
                  <Button
                    variant="light"
                    radius="xl"
                    size="xs"
                    leftSection={<IconPlus size={14} />}
                    disabled={editForm.favorite_characters.length >= 3}
                    onClick={() => setEditForm((prev) => ({
                      ...prev,
                      favorite_characters: [
                        ...prev.favorite_characters,
                        {
                          type: 'waifu',
                          name: '',
                          color: DEFAULT_FAVORITE_CHARACTER_COLOR,
                          position: prev.favorite_characters.length,
                        },
                      ].slice(0, 3),
                    }))}
                  >
                    Añadir
                  </Button>
                </Group>

                {(editForm.favorite_characters || []).map((character, index) => {
                  const safeCharacter = {
                    type: character?.type === 'husband' ? 'husband' : 'waifu',
                    name: typeof character?.name === 'string' ? character.name : '',
                    color: FAVORITE_CHARACTER_PALETTE.includes(String(character?.color || '').toUpperCase())
                      ? String(character.color).toUpperCase()
                      : DEFAULT_FAVORITE_CHARACTER_COLOR,
                    position: Number.isInteger(character?.position) ? character.position : index,
                  };
                  return (
                  <Box
                    key={safeCharacter.position}
                    className={styles.favoriteCharacterRow}
                    style={{
                      '--character-color': safeCharacter.color,
                    }}
                  >
                    <Text className={styles.favoriteCharacterIndex} size="xs" fw={700} c="dimmed">
                      {index + 1}
                    </Text>
                    <Select
                      aria-label={`Tipo del personaje ${index + 1}`}
                      searchable={false}
                      allowDeselect={false}
                      value={safeCharacter.type}
                      data={[
                        { value: 'waifu', label: 'Waifu' },
                        { value: 'husband', label: 'Husband' },
                      ]}
                      onChange={(type) => setEditForm((prev) => ({
                        ...prev,
                        favorite_characters: prev.favorite_characters.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, type: type || 'waifu' } : item
                        ),
                      }))}
                      size="xs"
                      radius="md"
                    />
                    <TextInput
                      aria-label={`Nombre del personaje ${index + 1}`}
                      placeholder="Nombre"
                      value={safeCharacter.name}
                      maxLength={10}
                      error={safeCharacter.name.trim(undefined)}
                      rightSection={
                        <Text size="9px" c="dimmed" mr={6} style={{ whiteSpace: 'nowrap' }}>
                          {[...safeCharacter.name].length}/10
                        </Text>
                      }
                      rightSectionWidth={42}
                      onChange={(event) => {
                        const rawName = event?.target?.value
                          ?? event?.currentTarget?.value
                          ?? '';
                        const name = String(rawName).normalize('NFC').slice(0, 10);
                        setEditForm((prev) => ({
                          ...prev,
                          favorite_characters: prev.favorite_characters.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, name }
                              : item
                          ),
                        }));
                      }}
                      size="xs"
                      radius="md"
                    />
                    <Popover withinPortal shadow="md" position="bottom" withArrow>
                      <Popover.Target>
                        <ActionIcon
                          aria-label={`Elegir color del personaje ${index + 1}`}
                          variant="outline"
                          radius="md"
                          size={42}
                          style={{
                            borderColor: `${safeCharacter.color}CC`,
                            backgroundColor: `${safeCharacter.color}18`,
                          }}
                        >
                          <Box
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: rem(6),
                              backgroundColor: safeCharacter.color,
                              border: '1px solid rgba(32,36,42,0.22)',
                            }}
                          />
                        </ActionIcon>
                      </Popover.Target>
                      <Popover.Dropdown>
                        <SimpleGrid cols={4} spacing="xs">
                          {FAVORITE_CHARACTER_PALETTE.map((color) => (
                            <ColorSwatch
                              key={color}
                              color={color}
                              size={28}
                              radius="md"
                              aria-label={`Elegir color ${color}`}
                              style={{ cursor: 'pointer', border: safeCharacter.color === color ? '2px solid #20242A' : undefined }}
                              onClick={() => setEditForm((prev) => ({
                                ...prev,
                                favorite_characters: prev.favorite_characters.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, color } : item
                                ),
                              }))}
                            />
                          ))}
                        </SimpleGrid>
                      </Popover.Dropdown>
                    </Popover>
                    <ActionIcon
                      aria-label={`Eliminar personaje ${index + 1}`}
                      variant="subtle"
                      color="red"
                      radius="xl"
                      size={32}
                      onClick={() => setEditForm((prev) => ({
                        ...prev,
                        favorite_characters: prev.favorite_characters
                          .filter((_, itemIndex) => itemIndex !== index)
                          .map((item, itemIndex) => ({ ...item, position: itemIndex })),
                      }))}
                    >
                      <IconTrash size={15} />
                    </ActionIcon>
                  </Box>
                  );
                })}
              </Stack>
            </Paper>
            <Paper
              p={isMobile ? 'md' : 'lg'}
              radius="xl"
              style={{
                background: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(15,23,42,0.018)',
                border: `1px solid ${isDark ? 'rgba(148,163,184,0.14)' : 'rgba(15,23,42,0.08)'}`,
              }}
            >
              <Stack gap="sm">
                <Box mb={4}>
                  <Text fw={750} size="sm">Redes sociales</Text>
                  <Text size="xs" c="dimmed" mt={3}>Conecta tus perfiles con otros lectores.</Text>
                </Box>
                <TextInput
                  label="X"
                  placeholder="@usuario o https://x.com/usuario"
                  value={editForm.social_links.x}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setEditForm(prev => ({ ...prev, social_links: { ...prev.social_links, x: value } }));
                  }}
                  maxLength={256}
                  leftSection={<IconBrandX size={16} />}
                  error={getSocialLinkErrors(editForm.social_links).x}
                  radius="xl"
                  styles={{
                    section: { position: 'absolute', left: rem(12), top: 0, bottom: 0, display: 'flex', alignItems: 'center' },
                    input: { paddingLeft: rem(44), paddingRight: rem(12) },
                  }}
                />
                <TextInput
                  label="Instagram"
                  placeholder="@usuario o https://instagram.com/usuario"
                  value={editForm.social_links.instagram}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setEditForm(prev => ({ ...prev, social_links: { ...prev.social_links, instagram: value } }));
                  }}
                  maxLength={256}
                  leftSection={<IconBrandInstagram size={16} />}
                  error={getSocialLinkErrors(editForm.social_links).instagram}
                  radius="xl"
                  styles={{
                    section: { position: 'absolute', left: rem(12), top: 0, bottom: 0, display: 'flex', alignItems: 'center' },
                    input: { paddingLeft: rem(44), paddingRight: rem(12) },
                  }}
                />
                <TextInput
                  label="Discord"
                  placeholder="@usuario"
                  value={editForm.social_links.discord}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setEditForm(prev => ({ ...prev, social_links: { ...prev.social_links, discord: value } }));
                  }}
                  maxLength={33}
                  leftSection={<IconBrandDiscord size={16} />}
                  error={getSocialLinkErrors(editForm.social_links).discord}
                  radius="xl"
                  styles={{
                    section: { position: 'absolute', left: rem(12), top: 0, bottom: 0, display: 'flex', alignItems: 'center' },
                    input: { paddingLeft: rem(44), paddingRight: rem(12) },
                  }}
                />
                <Text size="xs" c="dimmed">Deja vacío cualquier campo para eliminar esa red social.</Text>
              </Stack>
            </Paper>
            <Paper
              p="md"
              radius="lg"
              className={styles.profileEditorPreference}
              style={{
                background: isDark ? 'rgba(255,255,255,0.035)' : 'rgba(15,23,42,0.025)',
                border: `1px solid ${isDark ? 'rgba(148,163,184,0.13)' : 'rgba(15,23,42,0.07)'}`,
              }}
            >
              <Switch
                label={<Text fw={600} size="sm">Mostrarme como lector activo</Text>}
                description="Permite que otros usuarios vean tu avatar mientras lees."
                checked={editForm.show_active_reader}
                onChange={(event) => {
                  const showActiveReader = event.currentTarget.checked;
                  setEditForm((prev) => ({ ...prev, show_active_reader: showActiveReader }));
                }}
                color="yellow"
                size="md"
              />
            </Paper>
          </Stack>

          {/* Botones de acción */}
          <Group justify="flex-end" gap="sm" mt="xs" grow={isMobile}>
            <Button
              variant="default"
              radius="xl"
              size="md"
              fullWidth={isMobile}
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
              disabled={
                !editForm.display_name.trim()
                || editForm.favorite_characters.some((character) =>
                  !String(character?.name || '').trim()
                  || [...String(character?.name || '').trim()].length > 10
                  || /[<>]/.test(String(character?.name || ''))
                  || /javascript\s*:|script/i.test(String(character?.name || ''))
                )
              }
              leftSection={!editSaving ? <IconCheck size={16} /> : undefined}
              size="md"
              fullWidth={isMobile}
            >
              Guardar cambios
            </PremiumButton>
          </Group>
        </Stack>
      </Modal>}

      <UserFollowListModal
        opened={Boolean(followListType)}
        onClose={() => setFollowListType(null)}
        username={userUsername}
        type={followListType}
        onFollowChange={updateOwnFollowingCount}
      />
    </Box>
  );
}
