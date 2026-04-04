'use client'

import { IconAlertTriangle, IconRefresh, IconHome } from '@tabler/icons-react'
import { Button, Text, Title, Stack, Group, Paper } from '@mantine/core'
import { useLang } from '../hooks/useLang'
import { getLocalizedPath } from '../utils/i18nRoutes'

/**
 * Componente reutilizable para error.jsx de cada ruta.
 * Muestra un mensaje amigable con botón de reintentar y link al inicio.
 */
export default function RouteError({ error, reset, title = 'Algo salió mal' }) {
  const { lang } = useLang()

  return (
    <div style={{
      minHeight: '60vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
    }}>
      <Paper
        p="xl"
        radius="lg"
        withBorder
        style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}
      >
        <Stack align="center" gap="md">
          <IconAlertTriangle size={56} color="var(--mantine-color-yellow-6)" stroke={1.5} />

          <Title order={3}>{title}</Title>

          <Text c="dimmed" size="sm" maw={360}>
            {lang === 'en'
              ? 'An error occurred while loading this page. You can try again or go back home.'
              : 'Ocurrió un error cargando esta página. Puedes intentar de nuevo o volver al inicio.'}
          </Text>

          {process.env.NODE_ENV === 'development' && error?.message && (
            <Paper p="sm" radius="sm" bg="var(--mantine-color-red-light)" w="100%">
              <Text size="xs" c="red" style={{ wordBreak: 'break-word', textAlign: 'left' }}>
                {error.message}
              </Text>
            </Paper>
          )}

          <Group>
            <Button
              leftSection={<IconRefresh size={16} />}
              size="md"
              px="xl"
              py="md"
              onClick={() => reset()}
              variant="gradient"
              gradient={{ from: 'blue', to: 'cyan' }}
            >
              {lang === 'en' ? 'Retry' : 'Reintentar'}
            </Button>
            <Button
              leftSection={<IconHome size={16} />}
              component="a"
              href={getLocalizedPath('/home', lang)}
              variant="outline"
              color="cyan"
            >
              {lang === 'en' ? 'Home' : 'Inicio'}
            </Button>
          </Group>
        </Stack>
      </Paper>
    </div>
  )
}
