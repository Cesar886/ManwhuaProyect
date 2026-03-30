'use client';

import { Stack, Paper, Text, Group, Code } from '@mantine/core';
import UserBadges, { selectTopBadges } from './UserBadges';

/**
 * Componente de demostración para visualizar los badges
 * Útil para testing y desarrollo
 */
export default function BadgesDemo() {
  // Escenarios de prueba
  const scenarios = [
    {
      name: 'Usuario Principiante',
      stats: {
        streak: 3,
        totalChapters: 15,
        comments: 2,
        nightReads: 0,
        maxChaptersPerHour: 1,
      }
    },
    {
      name: 'Usuario Activo',
      stats: {
        streak: 15,
        totalChapters: 245,
        comments: 12,
        nightReads: 3,
        maxChaptersPerHour: 4,
      }
    },
    {
      name: 'Usuario Veterano',
      stats: {
        streak: 42,
        totalChapters: 650,
        comments: 28,
        nightReads: 8,
        maxChaptersPerHour: 7,
      }
    },
    {
      name: 'Usuario Legendario',
      stats: {
        streak: 125,
        totalChapters: 1250,
        comments: 156,
        nightReads: 45,
        maxChaptersPerHour: 12,
      }
    },
    {
      name: 'Sin Logros',
      stats: {
        streak: 0,
        totalChapters: 0,
        comments: 0,
        nightReads: 0,
        maxChaptersPerHour: 0,
      }
    },
  ];

  return (
    <Stack gap="xl" p="xl">
      <div>
        <Text size="xl" fw={700} mb="xs">🏅 Demo de Badges en Comentarios</Text>
        <Text size="sm" c="dimmed">
          Visualización de cómo se ven los badges según las estadísticas del usuario
        </Text>
      </div>

      {scenarios.map((scenario) => {
        const badges = selectTopBadges(scenario.stats, 3);
        
        return (
          <Paper key={scenario.name} p="lg" radius="lg" withBorder>
            <Stack gap="md">
              <Group justify="space-between">
                <Text fw={600}>{scenario.name}</Text>
                <Text size="xs" c="dimmed">
                  {badges.length} badge{badges.length !== 1 ? 's' : ''} desbloqueado{badges.length !== 1 ? 's' : ''}
                </Text>
              </Group>

              {/* Simulación del comentario con badges */}
              <div style={{ 
                position: 'relative',
                background: 'linear-gradient(135deg, var(--subtle-bg) 0%, rgba(var(--accent-cyan), 0.01) 100%)',
                border: '1px solid var(--border-color-subtle)',
                borderRadius: '12px',
                padding: '24px 16px 16px 16px',
                minHeight: '80px',
              }}>
                <UserBadges 
                  userStats={scenario.stats}
                  maxBadges={3}
                  size="compact"
                  showTooltip={true}
                />
                
                <Text size="sm" c="dimmed" ta="center">
                  {badges.length > 0 
                    ? 'Pasa el cursor sobre los badges para ver detalles'
                    : 'Sin badges para mostrar'
                  }
                </Text>
              </div>

              {/* Estadísticas */}
              <Group gap="xs" wrap="wrap">
                <Code>🔥 {scenario.stats.streak} días</Code>
                <Code>📖 {scenario.stats.totalChapters} caps</Code>
                <Code>💬 {scenario.stats.comments} comentarios</Code>
                <Code>🌙 {scenario.stats.nightReads} nocturnas</Code>
                <Code>⚡ {scenario.stats.maxChaptersPerHour} caps/h</Code>
              </Group>

              {/* Badges seleccionados */}
              {badges.length > 0 && (
                <div>
                  <Text size="xs" c="dimmed" mb={4}>Badges mostrados (por prioridad):</Text>
                  <Group gap="xs">
                    {badges.map((badge) => (
                      <Code key={badge.id} size="xs">
                        {badge.label} (prioridad: {badge.priority})
                      </Code>
                    ))}
                  </Group>
                </div>
              )}
            </Stack>
          </Paper>
        );
      })}

      {/* Explicación del sistema */}
      <Paper p="lg" radius="lg" withBorder bg="var(--mantine-color-cyan-0)">
        <Stack gap="sm">
          <Text fw={600} size="sm">💡 Sistema de Priorización</Text>
          <Text size="xs" c="dimmed">
            Los badges se priorizan automáticamente. Si un usuario tiene más de 3 logros desbloqueados,
            solo se muestran los 3 más importantes según esta tabla:
          </Text>
          <Code block size="xs">
{`Racha        → 100 (siempre se muestra si está activa)
Diamante     → 90  (1000 capítulos)
Guardián     → 80  (500 capítulos)
Devorador    → 70  (100 capítulos)
Veloz        → 60  (5 caps en 1h)
Crítico      → 50  (10 comentarios)
Lector Noct. → 40  (lecturas nocturnas)`}
          </Code>
        </Stack>
      </Paper>
    </Stack>
  );
}
