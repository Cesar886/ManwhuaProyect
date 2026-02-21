'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';
import {
  IconChevronDown,
  IconHome,
  IconBooks,
  IconTrendingUp,
  IconSearch,
  IconMoon,
  IconSun,
  IconX,
  IconLogout,
  IconSettings,
  IconUser,
  IconHeart,
} from '@tabler/icons-react';
import {
  Avatar,
  Group,
  Menu,
  Text,
  UnstyledButton,
  Input,
  ActionIcon,
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
import styles from './Header.module.css';

// Tabs de navegación (fuera del componente para evitar recreación)
const NAVIGATION_TABS = [
  { label: 'Inicio', icon: IconHome, value: 'home', path: '/home' },
  { label: 'Biblioteca', icon: IconBooks, value: 'Biblioteca', path: '/biblioteca' },
  { label: 'Populares', icon: IconTrendingUp, value: 'Populares', path: '/populares' },
];

// Items del menú del usuario (fuera del componente)
const USER_MENU_ITEMS = [
  { icon: IconUser, label: 'Mi Perfil', color: 'blue', action: 'perfil' },
  { icon: IconHeart, label: 'Mis Favoritos', color: 'yellow', action: 'favoritos' },
  { icon: IconSettings, label: 'Configuración', color: 'gray', action: 'configuracion', divider: true },
  { icon: IconLogout, label: 'Cerrar Sesión', color: 'red', action: 'cerrar_sesion' },
];

function Header({ colorScheme, toggleColorScheme }) {
  const [userMenuOpened, setUserMenuOpened] = useState(false);
  const [searchOpened, setSearchOpened] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mounted, setMounted] = useState(false);
  const searchDebounce = useRef(null);
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
  }, [searchOpened]); // Recalcular cuando se abre/cierra búsqueda

  // Búsqueda con debounce - redirige a biblioteca con resultados
  useEffect(() => {
    if (!searchOpened) return;
    const q = searchQuery.trim();
    if (q.length === 0) return;
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      router.push(`/biblioteca?search=${encodeURIComponent(q)}`);
      // Cerrar el buscador y limpiar después de redirigir
      setSearchOpened(false);
      setSearchQuery('');
    }, 350);
    return () => searchDebounce.current && clearTimeout(searchDebounce.current);
  }, [searchQuery, router, searchOpened]);

  const pathname = usePathname();

  const mantineColor = useMantineColorScheme();
  const activeColorScheme = colorScheme ?? mantineColor.colorScheme;
  const activeToggle = toggleColorScheme ?? mantineColor.toggleColorScheme;
  const isDark = activeColorScheme === 'dark';

  // Derivar pestaña activa
  const path = pathname.toLowerCase();
  const activeTab = path.startsWith('/biblioteca') ? 'Biblioteca'
    : path.startsWith('/populares') ? 'Populares'
      : path.startsWith('/perfil') ? 'Perfil'
        : 'home';

  // Usuario provisto por el contexto (no duplicamos el estado local)
  const { user: authUser, openLogin, doLogout } = useAuth()
  const user = authUser || null;

  // Normalize user shape for UI
  const uiUser = useMemo(() => user ? {
    id: user.id || user.userId || user._id || null,
    displayName: user.displayName || user.display_name || user.username || user.name || (user.id ? String(user.id) : ''),
    email: user.email || user.mail || '',
    level: user.level || 0,
  } : null, [user]);

  // Stable handler for user menu actions
  const handleUserAction = useMemo(() => ({
    perfil: () => router.push('/perfil'),
    favoritos: () => router.push('/colecciones?tab=favoritos'),
    configuracion: () => router.push('/configuracion'),
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
          <Group justify="space-between" align="center" wrap="nowrap">
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
                    Tu biblioteca premium
                  </Text>
                </div>
              </Group>
            </UnstyledButton>

            {/* Right: Solo Notificaciones, Tema y Usuario */}
            <Group gap="xs" wrap="nowrap" style={{ flex: '0 0 auto' }}>
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
                        <Text size="xs" c="dimmed">
                          Miembro desde hace 6 meses
                        </Text>
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
                <Button variant="outline" size="sm" onClick={() => openLogin()}>
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

            <Group gap="sm" style={{ position: 'absolute', right: '1rem' }}>
              {/* Search Icon (ahora en el nivel inferior) */}
              <ActionIcon
                variant="subtle"
                color="gray"
                size="lg"
                onClick={() => setSearchOpened(!searchOpened)}
                className={styles.actionIcon}
                aria-label="Buscar"
              >
                <IconSearch size={20} stroke={1.5} />
              </ActionIcon>

              {/* Burger removed (no dropdown on mobile) */}
            </Group>
          </Group>
        </Container>

        {/* Search Bar - Expandable */}
        {searchOpened && (
          <Container size="lg" pb="md">
            <Input
              placeholder="Buscar Biblioteca, autores, géneros..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const q = searchQuery.trim();
                  if (q.length > 0) {
                    try {
                      router.push(`/biblioteca?search=${encodeURIComponent(q)}`);
                      setSearchOpened(false);
                      setSearchQuery('');
                    } catch { void 0; }
                  }
                } else if (e.key === 'Escape') {
                  setSearchOpened(false);
                  setSearchQuery('');
                }
              }}
              icon={<IconSearch size={18} />}
              rightSectionPointerEvents="all"
              rightSection={
                <ActionIcon
                  size="sm"
                  color="gray"
                  radius="xl"
                  variant="subtle"
                  onClick={() => {
                    setSearchOpened(false);
                    setSearchQuery('');
                  }}
                >
                  <IconX size={16} />
                </ActionIcon>
              }
              classNames={{ input: styles.searchInput }}
              autoFocus
            />
          </Container>
        )}

      </Box>

      {/* Navegación visible en móvil — no se usa Drawer */}
    </>
  );
}

export default React.memo(Header);