import { Box, Card, Skeleton, Group, Stack, Text } from '@mantine/core';
import classes from './ManhwaCardSkeleton.module.css';

/**
 * Skeleton Card con shimmer effect para carga progresiva
 * CAPA 1: Se muestra instantáneamente (0ms)
 */
export default function ManhwaCardSkeleton() {
  return (
    <Card
      className={classes.skeletonCard}
      p={0}
      radius="lg"
    >
      {/* Cover Skeleton con shimmer */}
      <Box className={classes.coverSkeleton}>
        <div className={classes.shimmer} />
        
        {/* Label de estado */}
        <div className={classes.stateLabel}>
          <Text size="xs" c="cyan" fw={600}>Cargando</Text>
        </div>
        
        {/* Badge skeleton */}
        <Skeleton 
          className={classes.badgeSkeleton}
          height={18}
          width={50}
          radius="xs"
        />
        
        {/* Rating skeleton */}
        <Skeleton 
          className={classes.ratingSkeleton}
          height={24}
          width={45}
          radius="sm"
        />
      </Box>
      
      {/* Info Skeleton */}
      <Stack gap={6} p="xs">
        <Skeleton height={14} width="90%" radius="sm" />
        <Skeleton height={12} width="60%" radius="sm" />
        
        <Group gap={4} mt={4}>
          <Skeleton height={10} width={30} radius="sm" />
          <Skeleton height={10} width={40} radius="sm" />
        </Group>
      </Stack>
    </Card>
  );
}

/**
 * Grid de skeletons para mostrar mientras carga
 * @param {number} count - Número de skeletons a mostrar
 */
export function ManhwaSkeletonGrid({ count = 12 }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <ManhwaCardSkeleton key={`skeleton-${i}`} />
      ))}
    </>
  );
}
