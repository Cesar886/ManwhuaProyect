'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  IconSearch,
  IconX,
  IconPlus,
  IconThumbUp,
  IconMessageCircle,
  IconHeart,
  IconArrowRight,
  IconFlame,
  IconCheck,
  IconFilter,
  IconClock,
  IconAlertTriangle,
  IconChartBar,
  IconUser,
  IconRefresh,
  IconSend,
  IconUserPlus,
  IconUserCheck,
  IconChevronUp,
  IconChevronDown,
  IconChevronRight,
  IconEdit,
  IconTrash,
  IconPhoto,
  IconPhotoPlus,
  IconSparkles,
  IconLink,
  IconExternalLink,
  IconCategory,
  IconFileDescription,
  IconMessage
} from '@tabler/icons-react';
import {
  Button,
  Badge,
  Group,
  Stack,
  Pagination,
  FileButton,
  Modal,
  Text,
  Grid,
  Paper,
  Box,
  Image,
  Container,
  Select,
  Textarea,
  Loader,
  Progress,
  Input,
  Tabs,
  SimpleGrid,
  Card,
  Avatar,
  Menu,
  Popover,
  ActionIcon,
  NumberInput,
  Title,
  useMantineColorScheme,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api/client';
import Comentarios from '../../components/Comentarios';
import useRequests from '../../hooks/useRequests';
import { useCreateRequest, useVoteRequest } from '../../hooks/useRequestMutations';
import { getRequest as apiGetRequest, updateRequest as apiUpdateRequest, deleteRequest as apiDeleteRequest } from '../../lib/api/requests';
import styles from './Pedidos.module.css';

const defaultGenreOption = { value: '', label: 'Todos' };

// Opciones de ordenamiento usadas por el Select
const sortOptions = [
  { value: 'votes', label: 'Más seguidos' },
  { value: 'recent', label: 'Más recientes' },
  { value: 'progress', label: 'Más en progreso' },
  { value: 'completed', label: 'Completados' },
];

// Normaliza diferentes formas de etiquetas de estado a etiquetas en español
const normalizeStatusLabel = (s) => {
  if (!s) return ''
  const str = String(s).toLowerCase()
  if (str.includes('progress') || str.includes('in_progress') || str.includes('progreso') || str.includes('en progreso')) return 'En progreso'
  if (str.includes('complete') || str.includes('completado') || str.includes('completed')) return 'Completado'
  if (str.includes('pend') || str.includes('pending')) return 'Pendiente'
  return String(s)
}

// Traduce/normaliza la prioridad a etiquetas legibles en español
const translatePriority = (p) => {
  if (!p) return 'Baja'
  const s = String(p).toLowerCase()
  if (s.includes('high') || s.includes('alta')) return 'Alta'
  if (s.includes('med') || s.includes('media')) return 'Media'
  return 'Baja'
}

export default function Pedidos() {
  const { user, openLogin } = useAuth();
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [sortBy, setSortBy] = useState('votes');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRequest, setNewRequest] = useState({
    title: '',
    description: '',
    genre: '',
    priority: 'media'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isMobile = useMediaQuery('(max-width: 768px)');
  const { colorScheme } = useMantineColorScheme();

  // Hook para obtener requests
  const { data: requests, isLoading, refetch } = useRequests({
    tab: activeTab,
    search: searchQuery,
    genre: selectedGenre,
    sort: sortBy
  });

  // Hook para crear request
  const { mutate: createRequest } = useCreateRequest();

  // Hook para votar request
  const { mutate: voteRequest } = useVoteRequest();

  // Filtrar y ordenar requests
  const filteredRequests = useMemo(() => {
    if (!requests) return [];
    
    let filtered = requests.filter(request => {
      if (searchQuery && !request.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (selectedGenre && request.genre !== selectedGenre) {
        return false;
      }
      return true;
    });

    // Ordenar
    switch (sortBy) {
      case 'votes':
        filtered.sort((a, b) => (b.votes || 0) - (a.votes || 0));
        break;
      case 'recent':
        filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        break;
      case 'progress':
        filtered.sort((a, b) => {
          const aProgress = a.status === 'En progreso' ? 1 : 0;
          const bProgress = b.status === 'En progreso' ? 1 : 0;
          return bProgress - aProgress;
        });
        break;
      case 'completed':
        filtered.sort((a, b) => {
          const aCompleted = a.status === 'Completado' ? 1 : 0;
          const bCompleted = b.status === 'Completado' ? 1 : 0;
          return bCompleted - aCompleted;
        });
        break;
      default:
        break;
    }

    return filtered;
  }, [requests, searchQuery, selectedGenre, sortBy]);

  const handleCreateRequest = async () => {
    if (!user) {
      openLogin();
      return;
    }

    if (!newRequest.title.trim()) {
      notifications.show({
        title: 'Error',
        message: 'El título es requerido',
        color: 'red'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await createRequest(newRequest);
      setShowCreateModal(false);
      setNewRequest({ title: '', description: '', genre: '', priority: 'media' });
      notifications.show({
        title: 'Éxito',
        message: 'Pedido creado exitosamente',
        color: 'green'
      });
      refetch();
    } catch (error) {
      console.error('Error creating request:', error);
      notifications.show({
        title: 'Error',
        message: 'No se pudo crear el pedido',
        color: 'red'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVote = async (requestId) => {
    if (!user) {
      openLogin();
      return;
    }

    try {
      await voteRequest({ requestId });
      notifications.show({
        title: 'Voto registrado',
        message: 'Tu voto ha sido registrado',
        color: 'green'
      });
      refetch();
    } catch (error) {
      console.error('Error voting request:', error);
      notifications.show({
        title: 'Error',
        message: 'No se pudo registrar el voto',
        color: 'red'
      });
    }
  };

  if (isLoading) {
    return (
      <Container size="xl" py="xl">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <Loader size="lg" />
        </div>
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl">
      {/* Header */}
      <Group justify="space-between" mb="xl">
        <div>
          <Title order={1} mb="xs">Pedidos de la Comunidad</Title>
          <Text c="dimmed">Solicita manhwas que te gustaría leer o apoya pedidos existentes</Text>
        </div>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => setShowCreateModal(true)}
          variant="gradient"
          gradient={{ from: 'cyan', to: 'blue' }}
        >
          Nuevo Pedido
        </Button>
      </Group>

      {/* Filters */}
      <Paper p="md" mb="xl" radius="md">
        <Grid>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Input
              placeholder="Buscar pedidos..."
              leftSection={<IconSearch size={16} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              rightSection={
                searchQuery ? (
                  <ActionIcon
                    size="sm"
                    variant="transparent"
                    onClick={() => setSearchQuery('')}
                  >
                    <IconX size={16} />
                  </ActionIcon>
                ) : null
              }
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Select
              placeholder="Género"
              data={[defaultGenreOption]}
              value={selectedGenre}
              onChange={setSelectedGenre}
              leftSection={<IconCategory size={16} />}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Select
              placeholder="Ordenar por"
              data={sortOptions}
              value={sortBy}
              onChange={setSortBy}
              leftSection={<IconFilter size={16} />}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Button
              variant="light"
              onClick={refetch}
              leftSection={<IconRefresh size={16} />}
              fullWidth
            >
              Actualizar
            </Button>
          </Grid.Col>
        </Grid>
      </Paper>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={setActiveTab} mb="xl">
        <Tabs.List>
          <Tabs.Tab value="all">Todos ({requests?.length || 0})</Tabs.Tab>
          <Tabs.Tab value="pending">Pendientes</Tabs.Tab>
          <Tabs.Tab value="in_progress">En Progreso</Tabs.Tab>
          <Tabs.Tab value="completed">Completados</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {/* Requests List */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
        {filteredRequests.map((request) => (
          <Card key={request.id} shadow="sm" padding="lg" radius="md" withBorder>
            <Card.Section p="md">
              <Group justify="space-between" align="flex-start">
                <div style={{ flex: 1 }}>
                  <Text fw={600} size="lg" mb="xs">{request.title}</Text>
                  <Text size="sm" c="dimmed" lineClamp={2} mb="md">
                    {request.description}
                  </Text>
                </div>
                <Menu shadow="md" width={200}>
                  <Menu.Target>
                    <ActionIcon variant="light" size="sm">
                      <IconChevronDown size={14} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item leftSection={<IconEdit size={14} />}>
                      Editar
                    </Menu.Item>
                    <Menu.Item leftSection={<IconTrash size={14} />} color="red">
                      Eliminar
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Group>

              <Group justify="space-between" align="center">
                <Group gap="xs">
                  <Badge
                    color={
                      request.status === 'Completado' ? 'green' :
                      request.status === 'En progreso' ? 'yellow' : 'gray'
                    }
                    size="sm"
                  >
                    {normalizeStatusLabel(request.status)}
                  </Badge>
                  <Badge color="blue" size="sm">
                    {translatePriority(request.priority)}
                  </Badge>
                </Group>

                <Group gap="sm">
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<IconThumbUp size={14} />}
                    onClick={() => handleVote(request.id)}
                  >
                    {request.votes || 0}
                  </Button>
                  <ActionIcon size="sm" variant="light">
                    <IconMessageCircle size={16} />
                  </ActionIcon>
                </Group>
              </Group>

              {request.genre && (
                <Text size="xs" c="dimmed" mt="xs">
                  Género: {request.genre}
                </Text>
              )}

              <Group justify="space-between" align="center" mt="sm">
                <Group gap="xs">
                  <Avatar size="xs" radius="xl" />
                  <Text size="xs" c="dimmed">
                    por {request.user?.username || 'Usuario'}
                  </Text>
                </Group>
                <Text size="xs" c="dimmed">
                  {new Date(request.createdAt).toLocaleDateString()}
                </Text>
              </Group>
            </Card.Section>
          </Card>
        ))}
      </SimpleGrid>

      {filteredRequests.length === 0 && (
        <Paper p="xl" radius="md" style={{ textAlign: 'center' }}>
          <IconAlertTriangle size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
          <Title order={3} mb="sm">No hay pedidos</Title>
          <Text c="dimmed">No se encontraron pedidos con los filtros actuales</Text>
        </Paper>
      )}

      {/* Create Request Modal */}
      <Modal
        opened={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Crear Nuevo Pedido"
        size="md"
      >
        <Stack gap="md">
          <Input.Wrapper label="Título *" required>
            <Input
              placeholder="Nombre del manhwa que solicitas"
              value={newRequest.title}
              onChange={(e) => setNewRequest({ ...newRequest, title: e.currentTarget.value })}
              leftSection={<IconFileDescription size={16} />}
            />
          </Input.Wrapper>

          <Textarea
            label="Descripción"
            placeholder="Describe por qué quieres este manhwa, género, etc."
            value={newRequest.description}
            onChange={(e) => setNewRequest({ ...newRequest, description: e.currentTarget.value })}
            minRows={3}
          />

          <Select
            label="Género"
            placeholder="Selecciona un género"
            data={[{ value: 'accion', label: 'Acción' }, { value: 'romance', label: 'Romance' }]}
            value={newRequest.genre}
            onChange={(value) => setNewRequest({ ...newRequest, genre: value })}
          />

          <Select
            label="Prioridad"
            data={[
              { value: 'baja', label: 'Baja' },
              { value: 'media', label: 'Media' },
              { value: 'alta', label: 'Alta' }
            ]}
            value={newRequest.priority}
            onChange={(value) => setNewRequest({ ...newRequest, priority: value })}
          />

          <Group justify="flex-end" gap="sm">
            <Button
              variant="light"
              onClick={() => setShowCreateModal(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateRequest}
              loading={isSubmitting}
              leftSection={<IconSend size={16} />}
            >
              Crear Pedido
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}