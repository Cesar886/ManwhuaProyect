'use client';

import { useState, useMemo } from 'react';
import {
  Container,
  Grid,
  Card,
  Image,
  Text,
  Badge,
  Group,
  Stack,
  Box,
  Button,
  Tabs,
  Progress,
  Menu,
  SegmentedControl,
  Select,
  ActionIcon,
  Avatar,
  SimpleGrid,
  Input,
  Paper,
} from '@mantine/core';
import { filterAvailableSeries } from '@/utils/adultContent';
import {
  IconArrowLeft,
  IconHeart,
  IconHeartFilled,
  IconUsers,
  IconUserPlus,
  IconUserCheck,
  IconFlag,
  IconDots,
  IconMessageCircle,
  IconBook,
  IconStarFilled,
  IconChartBar,
  IconLink,
  IconQrcode,
  IconSearch,
  IconBookmark,
  IconBookmarkFilled,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';

// Mock data para la colección
const mockCollectionDetail = {
  id: 1,
  name: 'Top Acción 2024',
  description: 'Las mejores series de acción del año. Una curación cuidadosa de las historias más emocionantes y adrenalínicas que ha traído el 2024. Cada serie fue seleccionada por su narrativa épica, personajes memorables y batallas espectaculares.',
  creator: 'CreadorX',
  creatorAvatar: 'https://avatars.dicebear.com/api/avataaars/CreadorX.svg',
  creatorBadge: 'Premium',
  creatorBio: 'Amante de manhwas desde 2015. Crítico especializado en acción y fantasía.',
  creatorFollowers: 5420,
  creatorFollowing: false,
  isPublic: true,
  isVerified: true,
  category: 'Acción',
  tags: ['Acción', 'Top', 'Recomendado', 'Epic', 'Battles'],

  cover: 'https://picsum.photos/seed/collection1/1200/400',
  coverGradient: 'linear-gradient(135deg, rgba(6, 182, 212, 0.3) 0%, rgba(139, 92, 246, 0.3) 100%)',

  createdAt: '2024-10-15',
  updatedAt: '2024-12-17',

  followers: 2340,
  likes: 5120,
  commentsCount: 234,
  views: 15600,
  saves: 1240,
  shares: 450,

  userLiked: false,
  userFollowing: false,
  userSaved: false,

  trend: 'up',
  trendValue: 12.5,

  manhwas: [
    {
      id: 1,
      title: 'Solo Leveling',
      cover: 'https://picsum.photos/seed/manhwa1/300/400',
      slug: 'solo-leveling',
      author: 'Chugong',
      status: 'Completado',
      chapters: 179,
      rating: 4.9,
      genres: ['Acción', 'Fantasy'],
      year: 2024,
      addedAt: '2024-12-01',
      note: 'Una obra maestra del género. Excelente desarrollo del protagonista.',
    },
    {
      id: 2,
      title: 'Tower of God',
      cover: 'https://picsum.photos/seed/manhwa2/300/400',
      slug: 'tower-of-god',
      author: 'SIU',
      status: 'En emisión',
      chapters: 600,
      rating: 4.8,
      genres: ['Acción', 'Aventura'],
      year: 2024,
      addedAt: '2024-11-28',
      note: 'Worldbuilding increíble y personajes complejos.',
    },
    {
      id: 3,
      title: 'God of High School',
      cover: 'https://picsum.photos/seed/manhwa3/300/400',
      slug: 'god-of-high-school',
      author: 'Yongje Park',
      status: 'Completado',
      chapters: 569,
      rating: 4.7,
      genres: ['Acción', 'Artes marciales'],
      year: 2024,
      addedAt: '2024-11-25',
      note: 'Peleas épicas y arte espectacular.',
    },
  ]
};

export default function ColeccionesDetail() {
  const router = useRouter();

  const [collection] = useState(mockCollectionDetail);
  const [activeTab, setActiveTab] = useState('manhwas');
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('added');
  const [searchQuery, setSearchQuery] = useState('');
  const [liked, setLiked] = useState(collection.userLiked);
  const [following, setFollowing] = useState(collection.userFollowing);
  const [saved, setSaved] = useState(collection.userSaved);

  // Filtrar manhwas según búsqueda
  const filteredManhwas = useMemo(() => {
    const safeManhwas = filterAvailableSeries(collection.manhwas);
    if (!searchQuery) return safeManhwas;
    return safeManhwas.filter(manhwa =>
      manhwa.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      manhwa.author.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [collection.manhwas, searchQuery]);

  // Ordenar manhwas
  const sortedManhwas = useMemo(() => {
    const sorted = [...filteredManhwas];
    switch (sortBy) {
      case 'added':
        return sorted.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
      case 'rating':
        return sorted.sort((a, b) => b.rating - a.rating);
      case 'title':
        return sorted.sort((a, b) => a.title.localeCompare(b.title));
      case 'chapters':
        return sorted.sort((a, b) => b.chapters - a.chapters);
      default:
        return sorted;
    }
  }, [filteredManhwas, sortBy]);

  const handleLike = () => setLiked(!liked);
  const handleFollow = () => setFollowing(!following);
  const handleSave = () => setSaved(!saved);

  return (
    <Container size="xl" py="md">
      {/* Header con información de la colección */}
      <Paper
        radius="xl"
        style={{
          background: collection.coverGradient,
          backgroundImage: `url(${collection.cover})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
        mb="xl"
      >
        {/* Overlay */}
        <Box
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.4) 100%)',
          }}
        />

        <Box p="xl" style={{ position: 'relative', zIndex: 1 }}>
          <Group justify="space-between" align="flex-start" mb="xl">
            <Button
              variant="subtle"
              leftSection={<IconArrowLeft size={16} />}
              color="white"
              onClick={() => router.back()}
            >
              Volver
            </Button>

            <Group gap="xs">
              <ActionIcon
                size="lg"
                variant="subtle"
                color="white"
                onClick={handleSave}
              >
                {saved ? <IconBookmarkFilled size={20} /> : <IconBookmark size={20} />}
              </ActionIcon>
              <Menu shadow="md">
                <Menu.Target>
                  <ActionIcon size="lg" variant="subtle" color="white">
                    <IconDots size={20} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item leftSection={<IconLink size={14} />}>Copiar enlace</Menu.Item>
                  <Menu.Item leftSection={<IconQrcode size={14} />}>Generar QR</Menu.Item>
                  <Menu.Item leftSection={<IconFlag size={14} />} color="red">Reportar</Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          </Group>

          <Grid>
            <Grid.Col span={{ base: 12, md: 8 }}>
              <Stack gap="lg">
                <div>
                  <Group gap="sm" mb="sm">
                    <Badge color="cyan" size="sm">{collection.category}</Badge>
                    {collection.isVerified && (
                      <Badge color="yellow" size="sm" leftSection={<IconStarFilled size={10} />}>
                        Verificado
                      </Badge>
                    )}
                    <Group gap={4}>
                      {collection.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="outline" size="xs" color="white">
                          {tag}
                        </Badge>
                      ))}
                    </Group>
                  </Group>

                  <Text fw={700} size="xl" mb="sm" c="white">
                    {collection.name}
                  </Text>
                  <Text size="sm" c="gray.2" lineClamp={3}>
                    {collection.description}
                  </Text>
                </div>

                {/* Stats */}
                <Group gap="xl">
                  <div>
                    <Text fw={700} size="lg" c="white">{collection.manhwas.length}</Text>
                    <Text size="xs" c="gray.3">Manhwas</Text>
                  </div>
                  <div>
                    <Text fw={700} size="lg" c="white">{collection.followers.toLocaleString()}</Text>
                    <Text size="xs" c="gray.3">Seguidores</Text>
                  </div>
                  <div>
                    <Text fw={700} size="lg" c="white">{collection.likes.toLocaleString()}</Text>
                    <Text size="xs" c="gray.3">Me gusta</Text>
                  </div>
                  <div>
                    <Text fw={700} size="lg" c="white">{collection.views.toLocaleString()}</Text>
                    <Text size="xs" c="gray.3">Visualizaciones</Text>
                  </div>
                </Group>

                {/* Actions */}
                <Group gap="sm">
                  <Button
                    variant={liked ? 'filled' : 'outline'}
                    color={liked ? 'red' : 'white'}
                    leftSection={liked ? <IconHeartFilled size={16} /> : <IconHeart size={16} />}
                    onClick={handleLike}
                    radius="xl"
                  >
                    {liked ? 'Te gusta' : 'Me gusta'}
                  </Button>
                  <Button
                    variant={following ? 'filled' : 'outline'}
                    color={following ? 'cyan' : 'white'}
                    leftSection={following ? <IconUserCheck size={16} /> : <IconUserPlus size={16} />}
                    onClick={handleFollow}
                    radius="xl"
                  >
                    {following ? 'Siguiendo' : 'Seguir'}
                  </Button>
                </Group>
              </Stack>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 4 }}>
              {/* Creator info */}
              <Paper p="lg" radius="xl" bg="rgba(255, 255, 255, 0.1)" style={{ backdropFilter: 'blur(10px)' }}>
                <Group mb="md">
                  <Avatar src={collection.creatorAvatar} size="md" radius="xl" />
                  <div style={{ flex: 1 }}>
                    <Group gap="xs">
                      <Text fw={600} size="sm" c="white">{collection.creator}</Text>
                      {collection.creatorBadge && (
                        <Badge size="xs" color="yellow">{collection.creatorBadge}</Badge>
                      )}
                    </Group>
                    <Text size="xs" c="gray.3">{collection.creatorFollowers.toLocaleString()} seguidores</Text>
                  </div>
                </Group>
                <Text size="xs" c="gray.2" mb="md" lineClamp={2}>
                  {collection.creatorBio}
                </Text>
                <Button
                  size="xs"
                  variant="light"
                  color="white"
                  fullWidth
                  radius="xl"
                >
                  Ver perfil
                </Button>
              </Paper>
            </Grid.Col>
          </Grid>
        </Box>
      </Paper>

      {/* Tabs de contenido */}
      <Tabs value={activeTab} onChange={setActiveTab} mb="xl">
        <Tabs.List>
          <Tabs.Tab value="manhwas" leftSection={<IconBook size={16} />}>
            Manhwas ({collection.manhwas.length})
          </Tabs.Tab>
          <Tabs.Tab value="comments" leftSection={<IconMessageCircle size={16} />}>
            Comentarios ({collection.commentsCount})
          </Tabs.Tab>
          <Tabs.Tab value="stats" leftSection={<IconChartBar size={16} />}>
            Estadísticas
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="manhwas">
          {/* Controles */}
          <Group justify="space-between" mb="md">
            <Group>
              <Input
                placeholder="Buscar en la colección..."
                leftSection={<IconSearch size={16} />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.currentTarget.value)}
                style={{ minWidth: 250 }}
              />
              <Select
                placeholder="Ordenar por"
                data={[
                  { value: 'added', label: 'Recién agregados' },
                  { value: 'rating', label: 'Mejor calificados' },
                  { value: 'title', label: 'Nombre A-Z' },
                  { value: 'chapters', label: 'Más capítulos' },
                ]}
                value={sortBy}
                onChange={setSortBy}
              />
            </Group>
            <SegmentedControl
              value={viewMode}
              onChange={setViewMode}
              data={[
                { label: 'Grid', value: 'grid' },
                { label: 'Lista', value: 'list' },
              ]}
            />
          </Group>

          {/* Lista de manhwas */}
          {viewMode === 'grid' ? (
            <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 6 }} spacing="md">
              {sortedManhwas.map((manhwa) => (
                <Card
                  key={manhwa.id}
                  p="0"
                  radius="lg"
                  style={{ cursor: 'pointer' }}
                  onClick={() => router.push(`/manhwa/${manhwa.slug}`)}
                >
                  <Card.Section>
                    <Image
                      src={manhwa.cover}
                      alt={`Portada del manhwa ${manhwa.title} - ${manhwa.status || 'disponible'} con ${manhwa.chapters} capítulos en español`}
                      height={240}
                      fit="cover"
                    />
                  </Card.Section>
                  <Box p="sm">
                    <Text fw={600} size="sm" lineClamp={1} mb="xs">
                      {manhwa.title}
                    </Text>
                    <Text size="xs" c="dimmed" mb="xs">
                      {manhwa.author}
                    </Text>
                    <Group justify="space-between" align="center">
                      <Group gap={4}>
                        <IconStarFilled size={12} style={{ color: 'gold' }} />
                        <Text size="xs">{manhwa.rating}</Text>
                      </Group>
                      <Badge size="xs" variant="light">
                        {manhwa.chapters}ch
                      </Badge>
                    </Group>
                  </Box>
                </Card>
              ))}
            </SimpleGrid>
          ) : (
            <Stack gap="md">
              {sortedManhwas.map((manhwa) => (
                <Paper key={manhwa.id} p="md" radius="lg" withBorder>
                  <Group>
                    <Image
                      src={manhwa.cover}
                      alt={`Portada del manhwa ${manhwa.title} de ${manhwa.author || 'autor desconocido'}, ${manhwa.chapters} capítulos - Leer en Manhwa Imperial`}
                      width={60}
                      height={80}
                      fit="cover"
                      radius="sm"
                    />
                    <div style={{ flex: 1 }}>
                      <Group justify="space-between" align="flex-start">
                        <div>
                          <Text fw={600} mb="xs">{manhwa.title}</Text>
                          <Text size="sm" c="dimmed" mb="xs">{manhwa.author}</Text>
                          <Group gap="xs">
                            <Badge size="xs" color="blue">{manhwa.status}</Badge>
                            <Badge size="xs" variant="outline">{manhwa.chapters} capítulos</Badge>
                            <Group gap={4}>
                              <IconStarFilled size={12} style={{ color: 'gold' }} />
                              <Text size="xs">{manhwa.rating}</Text>
                            </Group>
                          </Group>
                        </div>
                        <Button size="xs" variant="light" onClick={() => router.push(`/manhwa/${manhwa.slug}`)}>
                          Ver
                        </Button>
                      </Group>
                      {manhwa.note && (
                        <Text size="xs" c="dimmed" mt="sm" italic>
                          &ldquo;{manhwa.note}&rdquo;
                        </Text>
                      )}
                    </div>
                  </Group>
                </Paper>
              ))}
            </Stack>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="comments">
          <Paper p="xl" radius="lg" style={{ textAlign: 'center' }}>
            <IconMessageCircle size={48} style={{ opacity: 0.5, margin: '0 auto 16px' }} />
            <Text fw={600} size="lg" mb="sm">Sin comentarios aún</Text>
            <Text c="dimmed" mb="md">Sé el primero en comentar esta colección</Text>
            <Button variant="light">Agregar comentario</Button>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="stats">
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
            <Paper p="lg" radius="lg">
              <Text fw={600} size="lg" mb="md">Estadísticas generales</Text>
              <Stack gap="sm">
                <Group justify="space-between">
                  <Text size="sm">Total de manhwas</Text>
                  <Text fw={600}>{collection.manhwas.length}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm">Promedio de rating</Text>
                  <Text fw={600}>
                    {(collection.manhwas.reduce((acc, m) => acc + m.rating, 0) / collection.manhwas.length).toFixed(1)}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm">Total de capítulos</Text>
                  <Text fw={600}>
                    {collection.manhwas.reduce((acc, m) => acc + m.chapters, 0).toLocaleString()}
                  </Text>
                </Group>
              </Stack>
            </Paper>

            <Paper p="lg" radius="lg">
              <Text fw={600} size="lg" mb="md">Géneros más populares</Text>
              <Stack gap="sm">
                {['Acción', 'Fantasy', 'Aventura', 'Artes marciales'].map((genre, index) => (
                  <Group key={genre} justify="space-between">
                    <Text size="sm">{genre}</Text>
                    <Progress value={100 - (index * 20)} size="sm" style={{ width: 100 }} />
                  </Group>
                ))}
              </Stack>
            </Paper>
          </SimpleGrid>
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}