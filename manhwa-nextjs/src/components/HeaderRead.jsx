'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  IconChevronDown,
  IconHome,
  IconBooks,
  IconTrendingUp,
  IconList,
  IconSearch,
  IconBell,
  IconMoon,
  IconSun,
  IconX,
  IconLogout,
  IconSettings,
  IconUser,
  IconBookmark,
  IconHeart,
} from '@tabler/icons-react';
import {
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
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import styles from './HeaderRead.module.css';

function HeaderRead({ colorScheme, toggleColorScheme }) {
  const [userMenuOpened, setUserMenuOpened] = useState(false);
  const router = useRouter();

  // Mantine color scheme hook
  const mantineColor = useMantineColorScheme();
  const activeColorScheme = colorScheme ?? mantineColor.colorScheme;
  const activeToggle = toggleColorScheme ?? mantineColor.toggleColorScheme;

  // Colores dinámicos según el theme activo
  const isDark = activeColorScheme === 'dark';
  const mainBg = 'var(--nav-bg)';
  const subtleBg = 'var(--subtle-bg)';
  const textPrimary = 'var(--text-color)';
  const dimmedText = 'var(--dimmed-text)';

  // Usuario provisto por el contexto
  const { user: authUser, openLogin, doLogout } = useAuth();
  const user = authUser || null;

  // Normalize user shape for UI
  const normalizedUser = user
    ? {
      id: user.id || user.userId || user._id || null,
      displayName: user.displayName || user.display_name || user.username || user.name || (user.id ? String(user.id) : ''),
      email: user.email || user.mail || '',
      level: user.level || 0,
      raw: user,
    }
    : null;

  const uiUser = normalizedUser;

  return (
    <>
      <Box
        className={styles.header}
        style={{
          backgroundColor: mainBg,
          backdropFilter: 'blur(24px)',
          borderBottom: isDark ? '1px solid var(--accent-cyan-0-1)' : '1px solid var(--accent-cyan-0-06)',
        }}
      >
        <Container size="lg" py="xs">
          <Group justify="space-between" align="center" wrap="nowrap">
            {/* Logo */}
            <UnstyledButton
              onClick={() => router.push('/home')}
              className={styles.logoGroup}
              style={{ minWidth: 0, flex: '0 1 auto' }}
              aria-label="Ir a inicio"
            >
              <Group gap="sm" style={{ minWidth: 0, flex: '0 1 auto' }}>
                <Image
                  src="/logo.png"
                  alt="Manhwa Imperial Logo"
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
          </Group>
        </Container>
      </Box>

      {/* Spacer para compensar el header fijo */}
      <div className={styles.headerSpacer} aria-hidden="true" />
    </>
  );
}

export default React.memo(HeaderRead);