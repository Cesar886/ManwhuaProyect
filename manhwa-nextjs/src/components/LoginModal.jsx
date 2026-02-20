"use client";

import React, { useState, useCallback } from 'react';
import {
  Drawer,
  TextInput,
  PasswordInput,
  Button,
  Checkbox,
  Center,
  Text,
} from '@mantine/core';
import { IconX, IconBrandGoogle, IconBrandDiscord, IconAlertCircle } from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext'
import { useRouter } from 'next/navigation'
import styles from './LoginModal.module.css'
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';

// Estilos de input movidos fuera del componente (evita recreación en cada render)
const INPUT_STYLES = {
  root: {
    '--input-bd-focus': 'var(--imperial-gold)',
  },
  input: {
    backgroundColor: 'var(--input-bg)',
    borderColor: 'var(--border-medium)',
    color: 'var(--text-primary)',
    borderRadius: '10px',
    height: '44px',
    fontSize: '0.95rem',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
    '&:focus': {
      borderColor: 'var(--imperial-gold)',
      boxShadow: '0 0 0 3px var(--imperial-primary-alpha)',
    },
    '&::placeholder': {
      color: 'var(--text-muted)',
    },
  },
  label: {
    color: 'var(--text-secondary)',
    fontWeight: 500,
    fontSize: '0.85rem',
    marginBottom: '6px',
  },
};

const CHECKBOX_STYLES = {
  root: { cursor: 'pointer' },
  label: {
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
    cursor: 'pointer',
  },
  input: {
    cursor: 'pointer',
    '&:checked': {
      backgroundColor: 'var(--imperial-gold)',
      borderColor: 'var(--imperial-gold)',
    },
  },
};

function LoginModalInner({ opened, onClose }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [googleLoading, setGoogleLoading] = useState(false)

  const { doLogin, doGoogleLogin } = useAuth()
  const router = useRouter()

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError(null)
    setLoading(true)
    try {
      await doLogin({ login: email, password, remember })
    } catch (err) {
      const msg = err?.body?.message || err?.message || 'Error de autenticación'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [email, password, remember, doLogin]);

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true);
      setError(null);
      try {
        // Flujo implícito devuelve access_token directamente
        const token = tokenResponse.access_token;
        if (!token) {
          throw new Error('No se recibió token de Google');
        }
        await doGoogleLogin(token, 'access_token');
      } catch (err) {
        let msg = 'Error al iniciar sesión con Google';
        if (err?.body?.message) msg = err.body.message;
        else if (err?.message) msg = err.message;
        console.error('Google login error:', err);
        setError(msg);
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: (error) => {
      console.error('Google OAuth Error:', error);
      setError('Error al conectar con Google. Inténtalo de nuevo.');
    },
    flow: 'implicit',
    scope: 'openid email profile',
  });

  const handleDiscordLogin = useCallback(() => {
    const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
    const redirectUri = process.env.NEXT_PUBLIC_DISCORD_REDIRECT_URI;
    const scope = 'identify email';
    const discordAuthUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`;
    window.location.href = discordAuthUrl;
  }, []);

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="bottom"
      size="auto"
      padding={0}
      withCloseButton={false}
      transitionProps={{
        transition: 'slide-up',
        duration: 250,
        timingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)'
      }}
      closeOnClickOutside
      zIndex={205}
      classNames={{
        inner: styles.drawerInner,
        content: styles.drawerContent,
      }}
      styles={{
        body: {
          padding: 0,
        },
        overlay: {
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(4px)',
        },
      }}
    >
      <form onSubmit={handleSubmit}>
        <div className={styles.sheet}>
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.title}>Iniciar Sesión</div>
            <Button
              variant="subtle"
              onClick={onClose}
              size="xs"
              className={styles.closeBtn}
              aria-label="Cerrar"
            >
              <IconX size={18} />
            </Button>
          </div>

          {/* Formulario */}
          <div className={styles.inputsWrapper}>
            <TextInput
              data-autofocus
              label="Correo electrónico"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              required
              styles={INPUT_STYLES}
            />

            <PasswordInput
              label="Contraseña"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              required
              styles={INPUT_STYLES}
            />

            <div className={styles.rememberRow}>
              <Checkbox
                label="Recuérdame"
                checked={remember}
                onChange={(e) => setRemember(e.currentTarget.checked)}
                color="indigo"
                size="sm"
                styles={CHECKBOX_STYLES}
              />
              <Button
                variant="subtle"
                size="xs"
                className={styles.linkBtn}
              >
                ¿Olvidaste tu contraseña?
              </Button>
            </div>

            {/* Mensaje de error */}
            {error && (
              <div className={styles.errorMessage}>
                <IconAlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            {/* Botón de login */}
            <Button
              type="submit"
              fullWidth
              className={styles.primaryBtn}
              loading={loading}
            >
              Iniciar sesión
            </Button>

            {/* Link de registro */}
            <Center className={styles.dividerSpace}>
              <Text size="sm" className={styles.mutedText}>
                ¿Aún no tienes una cuenta?
              </Text>
              <Button
                variant="subtle"
                size="xs"
                className={styles.linkBtn}
                onClick={() => {
                  onClose();
                  router.push('/register')
                }}
              >
                Crear cuenta
              </Button>
            </Center>

            {/* Divider con texto */}
            <div className={styles.dividerWithText}>
              <span>o continua con</span>
            </div>

            <Button
              fullWidth
              leftSection={<IconBrandGoogle size={20} />}
              onClick={() => {
                try {
                  googleLogin();
                } catch (err) {
                  console.error('Error starting Google login:', err);
                  setError('Error al iniciar el proceso de login con Google');
                }
              }}
              className={styles.googleBtn}
              loading={googleLoading}
              disabled={googleLoading}
            >
              {googleLoading ? 'Conectando...' : 'Continuar con Google'}
            </Button>

            <Button
              fullWidth
              leftSection={<IconBrandDiscord size={20} />}
              onClick={handleDiscordLogin}
              className={styles.discordBtn}
            >
              Continuar con Discord
            </Button>
          </div>
        </div>
      </form>
    </Drawer>
  );
}

// GoogleOAuthProvider se monta aquí para que el script de Google (~90 KiB)
// solo se descargue cuando el modal de login está abierto (lazy via dynamic import)
export default function LoginModal({ opened, onClose }) {
  return (
    <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID}>
      <LoginModalInner opened={opened} onClose={onClose} />
    </GoogleOAuthProvider>
  )
}
