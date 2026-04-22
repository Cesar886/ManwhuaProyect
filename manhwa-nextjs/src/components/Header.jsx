'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';
import {
  IconChevronDown,
  IconHome,
  IconBook,
  IconBooks,
  IconTrendingUp,
  IconMoon,
  IconSun,
  IconLogout,
  IconUser,
  IconFlame,
  IconSearch,
  IconCrown,
} from '@tabler/icons-react';
import {
  Avatar,
  Group,
  Menu,
  Text,
  UnstyledButton,
  ActionIcon,
  TextInput,
  Badge,
  Stack,
  Button,
  Container,
  ThemeIcon,
  useMantineColorScheme,
  Box,
} from '@mantine/core';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext'
import { getStreak } from '../api/progress';
import { useLang } from '../hooks/useLang';
import { getLocalizedPath } from '../utils/i18nRoutes';
import styles from './Header.module.css';

function Header({ colorScheme, toggleColorScheme, lang: propLang }) {
  const [userMenuOpened, setUserMenuOpened] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [streakDays, setStreakDays] = useState(null);
  const [searchActive, setSearchActive] = useState(false);
  const [headerSearch, setHeaderSearch] = useState('');
  const headerRef = useRef(null);
  const router = useRouter();
  const { lang: detectedLang, t } = useLang();

  // Usar lang del prop o detectado
  const lang = propLang || detectedLang;

  // Tabs de navegación (dinámicas según idioma)
  const NAVIGATION_TABS = useMemo(() => [
    { label: t.common.home, icon: IconHome, value: 'home', path: getLocalizedPath('/home', lang) },
    { label: t.common.library, icon: IconBooks, value: 'library', path: getLocalizedPath(lang === 'en' ? '/library' : '/biblioteca', lang) },
    { label: 'Manga', icon: IconBook, value: 'manga', path: getLocalizedPath(lang === 'en' ? '/manga' : '/mangas', lang) },
    // { label: t.common.profile, icon: IconUser, value: 'profile', path: getLocalizedPath('/perfil', lang) },
  ], [lang, t]);

  // Items del menú del usuario (dinámicos según idioma)
  const USER_MENU_ITEMS = useMemo(() => [
    { icon: IconUser, label: t.common.profile, color: 'blue', action: 'perfil' },
    { icon: IconCrown, label: 'VIP', color: 'yellow', action: 'vip' },
    { icon: IconLogout, label: t.common.logout, color: 'red', action: 'cerrar_sesion' },
  ], [t]);

  // Calcular altura del header y establecer variable CSS
  useEffect(() => {
    setMounted(true);

    const updateHeaderHeight = () => {
      if (headerRef.current) {
        const height = headerRef.current.offsetHeight;
        document.documentElement.style.setProperty('--header-height', `${height}px`);
        document.documentElement.style.setProperty('--header-height-mobile', `${height}px`);
      }
    };

    updateHeaderHeight();
    window.addEventListener('resize', updateHeaderHeight);
    return () => window.removeEventListener('resize', updateHeaderHeight);
  }, []);

  const pathname = usePathname();

  const mantineColor = useMantineColorScheme();
  const activeColorScheme = colorScheme ?? mantineColor.colorScheme;
  const activeToggle = toggleColorScheme ?? mantineColor.toggleColorScheme;
  const isDark = activeColorScheme === 'dark';

  // Derivar pestaña activa
  const normalizedPath = (pathname || '').toLowerCase().replace(/\/+$/, '') || '/';
  const pathSegments = normalizedPath.split('/').filter(Boolean);
  const hasSegment = (segment) => pathSegments.includes(segment);

  const activeTab = (hasSegment('biblioteca') || hasSegment('library')) ? 'library'
    : (hasSegment('mangas') || hasSegment('manga')) ? 'manga'
      : (hasSegment('perfil') || hasSegment('profile')) ? 'profile'
        : 'home';

  const handleHeaderSearchSubmit = (event) => {
    event.preventDefault();
    const value = headerSearch.trim();
    const basePath = getLocalizedPath('/biblioteca', lang);

    if (!value) {
      router.push(basePath);
      return;
    }

    const params = new URLSearchParams();
    params.set('search', value);
    router.push(`${basePath}?${params.toString()}`);
  };

  // Usuario provisto por el contexto (puede ser null fuera del provider)
  const auth = useAuth() || {};
  const {
    user: authUser = null,
    openLogin = () => { },
    doLogout = async () => { },
  } = auth;
  const user = authUser || null;

  useEffect(() => {
    let isActive = true;

    if (!user) {
      setStreakDays(null);
      return undefined;
    }

    const loadStreak = async () => {
      try {
        const data = await getStreak();
        if (isActive) {
          setStreakDays(Number(data?.streak) || 0);
        }
      } catch {
        if (isActive) {
          setStreakDays(0);
        }
      }
    };

    loadStreak();

    return () => {
      isActive = false;
    };
  }, [user?.id]);

  // Normalize user shape for UI
  const uiUser = useMemo(() => user ? {
    id: user.id || user.userId || user._id || null,
    displayName: user.displayName || user.display_name || user.username || user.name || (user.id ? String(user.id) : ''),
    email: user.email || user.mail || '',
    level: user.level || 0,
    createdAt: user.createdAt || user.created_at || null,
  } : null, [user]);

  const memberSinceText = useMemo(() => {
    if (!uiUser?.createdAt) return null
    const created = new Date(uiUser.createdAt)
    if (isNaN(created.getTime())) return null
    const now = new Date()
    const diffMs = now - created
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const th = t.header;
    if (diffDays < 1) return th.memberSinceToday
    if (diffDays === 1) return th.memberSinceYesterday
    if (diffDays < 30) return th.memberForDays.replace('{n}', diffDays)
    const diffMonths = Math.floor(diffDays / 30)
    if (diffMonths < 12) {
      const unit = diffMonths === 1 ? th.memberUnitMonth : th.memberUnitMonths
      return th.memberForMonthsTpl.replace('{n}', diffMonths).replace('{unit}', unit)
    }
    const diffYears = Math.floor(diffMonths / 12)
    const remainMonths = diffMonths % 12
    const yUnit = diffYears === 1 ? th.memberUnitYear : th.memberUnitYears
    if (remainMonths === 0) {
      return th.memberForYearsTpl.replace('{n}', diffYears).replace('{unit}', yUnit)
    }
    const mUnit = remainMonths === 1 ? th.memberUnitMonth : th.memberUnitMonths
    return th.memberForYearsMonthsTpl
      .replace('{y}', diffYears).replace('{yUnit}', yUnit)
      .replace('{m}', remainMonths).replace('{mUnit}', mUnit)
  }, [uiUser?.createdAt, t]);

  // Stable handler for user menu actions
  const handleUserAction = useMemo(() => ({
    perfil: () => router.push(getLocalizedPath(lang === 'en' ? '/profile' : '/perfil', lang)),
    vip: () => router.push(getLocalizedPath('/vip', lang)),
    cerrar_sesion: async () => {
      try { await doLogout(); } catch (e) { console.warn('Logout failed', e); }
      router.push(getLocalizedPath('/home', lang));
    },
  }), [router, doLogout, lang]);

  return (
    <>
      <Box
        ref={headerRef}
        className={styles.header}
      >
        {/* Main Header Section (2 niveles) */}
        <Container size="lg" py="xs">
          {/* Nivel superior: Logo a la izquierda, Notificaciones / Tema / Usuario a la derecha */}
          <Group justify="space-between" align="center" wrap="nowrap" maw={800} mx="auto" w="100%">
            {/* Logo */}
            <UnstyledButton
              onClick={() => {
                try { router.push(getLocalizedPath('/home', lang)); } catch { void 0; }
              }}
              className={styles.logoGroup}
              style={{ minWidth: 0, flex: '0 1 auto' }}
              aria-label={t.header.goToHome}
            >
              <Group gap="sm" className={styles.logoGroup} style={{ minWidth: 0, flex: '0 1 auto' }}>
                <Image
                  src="/logo.png"
                  alt={t.header.logoAlt}
                  width={40}
                  height={40}
                  className={styles.logoImage}
                  priority
                />
                <div className={styles.logoTextContainer}>
                  <Text fw={700} className={styles.logoText}>
                    <span className={styles.logoGradient}>Manhwa</span>
                    <span className={styles.logoSecondary}> Imperial</span>
                  </Text>
                  <Text size="xs" className={styles.logoSubtext}>
                    BY IA IMPERIAL
                  </Text>
                </div>
              </Group>
            </UnstyledButton>

            {/* Right: Solo Notificaciones, Tema y Usuario */}
            <Group gap="xs" wrap="nowrap" style={{ flex: '0 0 auto' }}>
              {streakDays !== null && (
                <Group gap={4} wrap="nowrap" className={styles.streakChip}>
                  <IconFlame size={13} stroke={2} className={styles.streakChipIcon} />
                  <Text size="xs" fw={700} className={styles.streakChipText}>{streakDays}</Text>
                </Group>
              )}

              {/* Theme Toggle */}
              {
                /* Use provided colorScheme/toggleColorScheme if passed from parent (App).
                   Otherwise fall back to Mantine hook so Header works standalone. */
              }
              <ActionIcon
                variant="subtle"
                size="lg"
                radius="xl"
                className={styles.themeToggleBtn}
                onClick={() => {
                  if (typeof activeToggle === 'function') activeToggle();
                }}
                aria-label={mounted
                  ? (activeColorScheme === 'dark' ? t.header.switchLightTheme : t.header.switchDarkTheme)
                  : t.header.switchTheme}
              >
                {/* Renderizar icono solo después del montaje para evitar hydration mismatch */}
                {mounted ? (
                  activeColorScheme === 'dark' ? (
                    <IconSun size={18} stroke={1.8} />
                  ) : (
                    <IconMoon size={18} stroke={1.8} />
                  )
                ) : (
                  <IconMoon size={18} stroke={1.8} />
                )}
              </ActionIcon>

              {/* User Menu (muestra Menu si hay usuario, sino botón de login) */}
              {uiUser ? (
                <Menu
                  width={300}
                  position="bottom-end"
                  offset={8}
                  transitionProps={{ transition: 'scale-y', duration: 200 }}
                  onClose={() => setUserMenuOpened(false)}
                  onOpen={() => setUserMenuOpened(true)}
                  withinPortal
                  shadow="xl"
                  classNames={{ dropdown: styles.userMenuDropdown }}
                >
                  <Menu.Target>
                    <UnstyledButton
                      className={`${styles.userMenuButton} ${userMenuOpened ? styles.userMenuButtonActive : ''}`}
                    >
                      <Group gap={6} wrap="nowrap">
                        <Avatar
                          name={uiUser.displayName || 'Usuario'}
                          color="initials"
                          allowedInitialsColors={['blue', 'red', 'cyan', 'indigo', 'pink', 'violet']}
                          radius="xl"
                          size={30}
                          style={{
                            border: '2px solid var(--accent-cyan-0-25)',
                            boxShadow: '0 3px 10px rgba(0, 0, 0, 0.08)'
                          }}
                        />
                        <Stack gap={2} className={styles.userInfo}>
                          <Group gap={4}>
                            <Text fw={600} size="sm">
                              {uiUser.displayName}
                            </Text>
                            <Badge size="xs" variant="filled" color="cyan">
                              {uiUser.level}
                            </Badge>
                          </Group>
                          <Text size="xs" c="dimmed">
                            {uiUser.email}
                          </Text>
                        </Stack>
                        <IconChevronDown
                          size={16}
                          stroke={1.5}
                          className={styles.hideOnMobile}
                          style={{
                            transition: 'transform 0.3s ease',
                            transform: userMenuOpened ? 'rotate(180deg)' : 'rotate(0deg)',
                          }}
                        />
                      </Group>
                    </UnstyledButton>
                  </Menu.Target>

                  <Menu.Dropdown>
                    <Stack gap={0}>
                      {/* User Info Preview */}
                      <Box p="lg" className={styles.userInfoSection}>
                        <Group justify="space-between" mb="xs">
                          <div>
                            <Text fw={600} size="sm">
                              {uiUser.displayName}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {uiUser.email}
                            </Text>
                          </div>
                          <Badge color="cyan">{uiUser.level}</Badge>
                        </Group>
                        {memberSinceText && (
                          <Text size="xs" c="dimmed">
                            {memberSinceText}
                          </Text>
                        )}
                      </Box>

                      <Menu.Divider />

                      {/* Menu Items */}
                      {USER_MENU_ITEMS.map((item) => {
                        const ItemIcon = item.icon;
                        const isVIP = item.action === 'vip';
                        return (
                          <div key={item.label}>
                            <Menu.Item
                              leftSection={
                                <ThemeIcon
                                  size="lg"
                                  variant="light"
                                  color={item.color}
                                  radius="md"
                                  className={styles.menuItemIcon}
                                >
                                  <ItemIcon size={18} />
                                </ThemeIcon>
                              }
                              onClick={handleUserAction[item.action] || (() => router.push('/'))}
                              className={`${styles.menuItem} ${isVIP ? styles.menuItemVip : ''} ${item.color === 'red' ? styles.menuItemDanger : ''}`}
                            >
                              <Group justify="space-between" w="100%" gap="md">
                                <span>{item.label}</span>
                                {isVIP && <Badge size="sm" variant="light" color="yellow">Premium</Badge>}
                              </Group>
                            </Menu.Item>
                            {item.divider && <Menu.Divider />}
                          </div>
                        );
                      })}
                    </Stack>
                  </Menu.Dropdown>
                </Menu>
              ) : (
                <Button
                  size="sm"
                  radius="xl"
                  className={styles.loginButton}
                  onClick={() => openLogin()}
                >
                  <IconUser size={16} stroke={2} style={{ marginRight: 6 }} />
                  {t.header.login}
                </Button>
              )}
            </Group>

            {/* Mobile: las pestañas se muestran directamente (sin burger) */}
          </Group>

          {/* Nivel inferior: navegación */}
          <Group align="center" wrap="nowrap" className={styles.bottomNavRow}>
            <Group gap={0} className={styles.tabsList}>
              {NAVIGATION_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.value;
                return (
                  <UnstyledButton
                    key={tab.value}
                    className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
                    data-active={isActive ? 'true' : 'false'}
                    aria-label={tab.label}
                    onClick={() => {
                      router.push(tab.path);
                    }}
                  >
                    <Group gap={6} style={{ alignItems: 'center' }}>
                      <Icon size={18} stroke={1.8} />
                      <Text
                        fw={500}
                        size="sm"
                        className={
                          isActive
                            ? undefined
                            : styles['button-text']
                        }
                      >
                        {tab.label}
                      </Text>
                    </Group>
                  </UnstyledButton>
                );
              })}
            </Group>

            <ActionIcon
              variant="subtle"
              size="lg"
              radius="xl"
              className={`${styles.searchToggleBtn} ${searchActive ? styles.searchToggleBtnActive : ''}`}
              onClick={() => {
                const closing = searchActive;
                setSearchActive((prev) => !prev);
                if (closing) {
                  setHeaderSearch('');
                  const basePath = getLocalizedPath('/biblioteca', lang);
                  if (pathname?.startsWith(basePath) || pathname?.includes('/biblioteca') || pathname?.includes('/library')) {
                    router.push(basePath);
                  }
                }
              }}
              aria-label={lang === 'en' ? 'Toggle search bar' : 'Mostrar u ocultar buscador'}
              title={lang === 'en' ? 'Toggle search bar' : 'Mostrar u ocultar buscador'}
              aria-pressed={searchActive}
            >
              <IconSearch size={18} stroke={1.8} />
            </ActionIcon>
          </Group>

          {searchActive && (
            <form className={styles.headerSearchForm} onSubmit={handleHeaderSearchSubmit}>
              <div className={styles.headerSearchOuter}>
                <TextInput
                  value={headerSearch}
                  onChange={(event) => setHeaderSearch(event.currentTarget.value)}
                  placeholder={lang === 'en' ? 'Search title or synopsis in library...' : 'Buscar titulo o sinopsis en biblioteca...'}
                  leftSection={null}
                  leftSectionWidth={0}
                  rightSection={<span className={styles.headerSearchHint}>ENTER</span>}
                  rightSectionWidth={60}
                  radius="md"
                  size="md"
                  classNames={{
                    input: styles.headerSearchInput,
                    section: styles.headerSearchSection,
                  }}
                  aria-label={lang === 'en' ? 'Search in library' : 'Buscar en biblioteca'}
                  autoFocus
                />
              </div>
            </form>
          )}
        </Container>
      </Box>

      {/* Navegación visible en móvil — no se usa Drawer */}
    </>
  );
}

export default React.memo(Header);