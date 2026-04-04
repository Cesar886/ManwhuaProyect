import { Container, Skeleton, Stack, Box, Group } from '@mantine/core';
import { PremiumSkeletonGrid } from '@/components/PremiumSkeleton';
import styles from './loading.module.css';

export default function Loading() {
  return (
    <div className={styles.pageWrapper}>
      <Container size="lg" py="xl">
        {/* Section 1: Colección */}
        <Box mb="3rem">
          {/* Section Header */}
          <Group justify="space-between" mb="lg">
            <Group gap="sm">
              <Skeleton height={24} width={24} radius="sm" />
              <Skeleton height={32} width={150} radius="md" />
            </Group>
            <Skeleton height={20} width={80} radius="sm" />
          </Group>

          {/* Cards Grid */}
          <div className={styles.cardsGrid}>
            <PremiumSkeletonGrid count={12} />
          </div>
        </Box>

        {/* Section 2: Actualizaciones */}
        <Box mb="3rem">
          {/* Section Header */}
          <Group justify="space-between" mb="lg">
            <Group gap="sm">
              <Skeleton height={24} width={24} radius="sm" />
              <Skeleton height={32} width={200} radius="md" />
            </Group>
            <Skeleton height={20} width={60} radius="sm" />
          </Group>

          {/* Release Cards */}
          <div className={styles.releaseGrid}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Box key={i} className={styles.releaseCard}>
                <Skeleton height={180} width="100%" radius="md" />
                <Stack gap="xs" mt="sm">
                  <Skeleton height={18} width="90%" radius="sm" />
                  <Skeleton height={14} width="70%" radius="sm" />
                  <Skeleton height={14} width="80%" radius="sm" />
                </Stack>
              </Box>
            ))}
          </div>
        </Box>

        {/* Section 3: Top Series */}
        <Box>
          {/* Section Header */}
          <Group justify="space-between" mb="lg">
            <Group gap="sm">
              <Skeleton height={24} width={24} radius="sm" />
              <Skeleton height={32} width={120} radius="md" />
            </Group>
          </Group>

          {/* Top Series Grid */}
          <div className={styles.topSeriesGrid}>
            {/* Top 3 Featured */}
            <div className={styles.featuredCards}>
              {Array.from({ length: 3 }).map((_, i) => (
                <Box key={i} className={styles.featuredCard}>
                  <Skeleton height={280} width="100%" radius="md" />
                  <Stack gap="xs" mt="sm">
                    <Skeleton height={20} width="90%" radius="sm" />
                    <Skeleton height={16} width="60%" radius="sm" />
                    <Skeleton height={36} width="100%" radius="md" />
                  </Stack>
                </Box>
              ))}
            </div>

            {/* Side List */}
            <Stack gap="xs" className={styles.sideList}>
              <Skeleton height={28} width={180} radius="md" mb="sm" />
              {Array.from({ length: 7 }).map((_, i) => (
                <Group key={i} gap="md" className={styles.listItem}>
                  <Skeleton height={20} width={30} radius="sm" />
                  <Skeleton height={48} width={48} radius="sm" />
                  <Stack gap={4} style={{ flex: 1 }}>
                    <Skeleton height={16} width="80%" radius="sm" />
                    <Skeleton height={14} width="50%" radius="sm" />
                  </Stack>
                </Group>
              ))}
            </Stack>
          </div>
        </Box>
      </Container>
    </div>
  );
}
