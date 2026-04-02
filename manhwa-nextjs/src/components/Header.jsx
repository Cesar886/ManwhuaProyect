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
  IconX,
  IconLogout,
  IconSettings,
  IconUser,
  IconHeart,
  IconFlame,
} from '@tabler/icons-react';
import {
  Avatar,
  Group,
  Menu,
  Text,
  UnstyledButton,
  ActionIcon,
  Badge,
  Stack,
  Button,
  Input,
  Container,
  ThemeIcon,
  useMantineColorScheme,
  Box,
} from '@mantine/core';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext'
import { getStreak } from '../api/progress';
import styles from './Header.module.css';

// Tabs de navegación (fuera del componente para evitar recreación)
const NAVIGATION_TABS = [
  { label: 'Inicio', icon: IconHome, value: 'home', path: '/home' },
  { label: 'Biblioteca', icon: IconBooks, value: 'Biblioteca', path: '/biblioteca' },
  { label: 'Manga', icon: IconBook, value: 'Manga', path: '/mangas' },
  { label: 'Populares', icon: IconTrendingUp, value: 'Populares', path: '/populares' },
  // { label: '18+', icon: IconFlame, value: '18+', path: '/nsfw' },
];

// Items del menú del usuario (fuera del componente)
const USER_MENU_ITEMS = [
  { icon: IconUser, label: 'Mi Perfil', color: 'blue', action: 'perfil' },
  // { icon: IconHeart, label: 'Mis Favoritos', color: 'yellow', action: 'favoritos' },
  // { icon: IconSettings, label: 'Configuración', color: 'gray', action: 'configuracion', divider: true },
  { icon: IconLogout, label: 'Cerrar Sesión', color: 'red', action: 'cerrar_sesion' },
];

function Header({ colorScheme, toggleColorScheme }) {
  const [userMenuOpened, setUserMenuOpened] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [streakDays, setStreakDays] = useState(null);
  const searchDebounce = useRef(null);
  const [searchOpened, setSearchOpened] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const headerRef = useRef(null);
  const router = useRouter();

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

  // La búsqueda en el header fue removida; la lógica se maneja en la página de biblioteca.

  const pathname = usePathname();

  const mantineColor = useMantineColorScheme();
  const activeColorScheme = colorScheme ?? mantineColor.colorScheme;
  const activeToggle = toggleColorScheme ?? mantineColor.toggleColorScheme;
  const isDark = activeColorScheme === 'dark';

  // Derivar pestaña activa
  const normalizedPath = (pathname || '').toLowerCase().replace(/\/+$/, '') || '/';
  const pathSegments = normalizedPath.split('/').filter(Boolean);
  const hasSegment = (segment) => pathSegments.includes(segment);

  const activeTab = hasSegment('biblioteca') ? 'Biblioteca'
    : hasSegment('mangas') ? 'Manga'
      : hasSegment('perfil') ? 'Perfil'
        : 'home';

  // Usuario provisto por el contexto (no duplicamos el estado local)
  const { user: authUser, openLogin, doLogout } = useAuth()
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
    if (diffDays < 1) return 'Miembro desde hoy'
    if (diffDays === 1) return 'Miembro desde ayer'
    if (diffDays < 30) return `Miembro desde hace ${diffDays} días`
    const diffMonths = Math.floor(diffDays / 30)
    if (diffMonths < 12) return `Miembro desde hace ${diffMonths} ${diffMonths === 1 ? 'mes' : 'meses'}`
    const diffYears = Math.floor(diffMonths / 12)
    const remainMonths = diffMonths % 12
    if (remainMonths === 0) return `Miembro desde hace ${diffYears} ${diffYears === 1 ? 'año' : 'años'}`
    return `Miembro desde hace ${diffYears} ${diffYears === 1 ? 'año' : 'años'} y ${remainMonths} ${remainMonths === 1 ? 'mes' : 'meses'}`
  }, [uiUser?.createdAt]);

  // Stable handler for user menu actions
  const handleUserAction = useMemo(() => ({
    perfil: () => router.push('/perfil'),
    // favoritos: () => router.push('/colecciones?tab=favoritos'),
    // configuracion: () => router.push('/configuracion'),
    cerrar_sesion: async () => {
      try { await doLogout(); } catch (e) { console.warn('Logout failed', e); }
      router.push('/');
    },
  }), [router, doLogout]);

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
                try { router.push('/home'); } catch { void 0; }
              }}
              className={styles.logoGroup}
              style={{ minWidth: 0, flex: '0 1 auto' }}
              aria-label="Ir a inicio"
            >
              <Group gap="sm" className={styles.logoGroup} style={{ minWidth: 0, flex: '0 1 auto' }}>
                <Image
                  src="/logo.png"
                  alt="Logo de Manhwa Imperial - Plataforma para leer manhwa en español online gratis"
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
                aria-label={mounted && activeColorScheme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
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

                      {/* Menu Items */}
                      {USER_MENU_ITEMS.map((item) => {
                        const ItemIcon = item.icon;
                        return (
                          <div key={item.label}>
                            <Menu.Item
                              leftSection={
                                <ThemeIcon
                                  size="md"
                                  variant="light"
                                  color={item.color}
                                  radius="md"
                                  className={styles.menuItemIcon}
                                >
                                  <ItemIcon size={16} />
                                </ThemeIcon>
                              }
                              onClick={handleUserAction[item.action] || (() => router.push('/'))}
                              className={`${styles.menuItem} ${item.color === 'red' ? styles.menuItemDanger : ''}`}
                            >
                              {item.label}
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
                  Entrar
                </Button>
              )}
            </Group>

            {/* Mobile: las pestañas se muestran directamente (sin burger) */}
          </Group>

          {/* Nivel inferior: navegación, búsqueda y menú móvil */}
          <Group justify="center" align="center" style={{ position: 'relative' }}>
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

          </Group>
        </Container>
      </Box>

      {/* Navegación visible en móvil — no se usa Drawer */}
    </>
  );
}

export default React.memo(Header);