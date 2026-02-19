import { Container, Skeleton, Group, Stack, Box } from '@mantine/core';
import styles from './loading.module.css';

export default function Loading() {
  return (
    <div className={styles.pageWrapper}>
      <Container size="lg" py="xl">
        {/* Header Section Skeleton */}
        <div className={styles.heroSection}>
          <Group align="flex-start" gap="xl" wrap="nowrap">
            {/* Cover Skeleton */}
            <Box className={styles.coverContainer}>
              <Skeleton height={320} width={220} radius="md" />
            </Box>

            {/* Info Skeleton */}
            <Stack gap="md" style={{ flex: 1 }}>
              {/* Title */}
              <Skeleton height={40} width="70%" radius="md" />

              {/* Metadata */}
              <Group gap="xs">
                <Skeleton height={24} width={80} radius="sm" />
                <Skeleton height={24} width={60} radius="sm" />
                <Skeleton height={24} width={70} radius="sm" />
              </Group>

              {/* Synopsis */}
              <Stack gap="xs">
                <Skeleton height={16} width="100%" radius="sm" />
                <Skeleton height={16} width="95%" radius="sm" />
                <Skeleton height={16} width="90%" radius="sm" />
                <Skeleton height={16} width="85%" radius="sm" />
              </Stack>

              {/* Genres */}
              <Group gap="xs">
                <Skeleton height={28} width={70} radius="md" />
                <Skeleton height={28} width={80} radius="md" />
                <Skeleton height={28} width={65} radius="md" />
                <Skeleton height={28} width={75} radius="md" />
              </Group>

              {/* Action Buttons */}
              <Group gap="md" mt="md">
                <Skeleton height={42} width={140} radius="md" />
                <Skeleton height={42} width={140} radius="md" />
              </Group>
            </Stack>
          </Group>
        </div>

        {/* Chapters Section Skeleton */}
        <Box mt="xl">
          {/* Section Title */}
          <Skeleton height={32} width={200} radius="md" mb="md" />

          {/* Chapters List */}
          <Stack gap="xs">
            {Array.from({ length: 8 }).map((_, i) => (
              <Box key={i} className={styles.chapterSkeleton}>
                <Group justify="space-between" align="center" wrap="nowrap">
                  <Group gap="md" style={{ flex: 1 }}>
                    <Skeleton height={50} width={50} radius="sm" />
                    <Stack gap={4} style={{ flex: 1 }}>
                      <Skeleton height={16} width="60%" radius="sm" />
                      <Skeleton height={14} width="40%" radius="sm" />
                    </Stack>
                  </Group>
                  <Skeleton height={32} width={80} radius="md" />
                </Group>
              </Box>
            ))}
          </Stack>
        </Box>
      </Container>
    </div>
  );
}
