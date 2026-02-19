"use client";

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Container,
  Card,
  Image,
  Text,
  Badge,
  Group,
  Stack,
  Button,
  Box,
  Input,
  ActionIcon,
  Modal,
  SimpleGrid,
  Textarea,
  Avatar,
  Tabs,
  Tooltip,
  Chip,
  Drawer,
  Divider,
  Switch,
  Popover,
  ScrollArea,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { normalizeImageUrl } from '../../utils/imageUtils';
import {
  IconSearch,
  IconX,
  IconPlus,
  IconBook,
  IconFolderPlus,
  IconFilter,
  IconArrowRight,
  IconHeart,
  IconHeartFilled,
  IconUserPlus,
  IconUserCheck,
  IconUsers,
  IconSparkles,
  IconTrash,
  IconEdit,
  IconDots,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
} from '@tabler/icons-react';
import classes from './Colecciones.module.css';

// Mock data de colecciones personales
const mockUserCollections = [
  {
    id: 101,
    name: 'Por Leer',
    description: 'Manhwas pendientes de leer',
    category: 'Personal',
    cover: 'https://picsum.photos/seed/mycol1/400/250',
    isPublic: false,
    manhwas: 24,
    createdAt: '2024-10-15',
    updatedAt: '2024-12-17',
  },
  {
    id: 102,
    name: 'Favoritas 2024',
    description: 'Mis series favoritas del año',
    category: 'Personal',
    cover: 'https://picsum.photos/seed/mycol2/400/250',
    isPublic: true,
    manhwas: 12,
    createdAt: '2024-09-01',
    updatedAt: '2024-12-10',
  },
  {
    id: 103,
    name: 'Leyendo Ahora',
    description: 'Series que estoy leyendo actualmente',
    category: 'Personal',
    cover: 'https://picsum.photos/seed/mycol3/400/250',
    isPublic: false,
    manhwas: 8,
    createdAt: '2024-11-20',
    updatedAt: '2024-12-18',
  },
];

// Mock data de colecciones comunitarias
const mockCommunityCollections = [
  {
    id: 1,
    name: 'Top Acción 2024',
    description: 'Las mejores series de acción del año',
    creator: 'CreadorX',
    creatorAvatar: 'https://avatars.dicebear.com/api/avataaars/CreadorX.svg',
    creatorBadge: 'Premium',
    isVerified: true,
    category: 'Acción',
    tags: ['Acción', 'Top', 'Recomendado'],
    cover: 'https://picsum.photos/seed/collection1/400/250',
    manhwas: 12,
    followers: 2340,
    likes: 5120,
    userLiked: false,
    userFollowing: false,
  },
  {
    id: 2,
    name: 'Drama Emocional',
    description: 'Series que van a hacerte llorar',
    creator: 'EmotionLover',
    creatorAvatar: 'https://avatars.dicebear.com/api/avataaars/EmotionLover.svg',
    creatorBadge: null,
    isVerified: false,
    category: 'Drama',
    tags: ['Drama', 'Emoción'],
    cover: 'https://picsum.photos/seed/collection2/400/250',
    manhwas: 15,
    followers: 1560,
    likes: 3420,
    userLiked: true,
    userFollowing: true,
  },
  {
    id: 3,
    name: 'Inicio Perfecto para Novatos',
    description: 'Series ideales para empezar',
    creator: 'GuideeMaster',
    creatorAvatar: 'https://avatars.dicebear.com/api/avataaars/GuideeMaster.svg',
    creatorBadge: 'Expert',
    isVerified: true,
    category: 'Recomendación',
    tags: ['Principiantes', 'Tutorial'],
    cover: 'https://picsum.photos/seed/collection3/400/250',
    manhwas: 9,
    followers: 3450,
    likes: 7620,
    userLiked: false,
    userFollowing: false,
  },
];

// Mock data de favoritos
const mockFavoriteManhwas = [
  {
    id: 1,
    title: 'Solo Leveling',
    cover: 'https://picsum.photos/seed/series1/300/400',
    rating: 4.9,
    status: 'Terminado',
    year: 2023,
  },
  {
    id: 2,
    title: 'Mercenary Enrollment',
    cover: 'https://picsum.photos/seed/series2/300/400',
    rating: 4.8,
    status: 'Leyendo',
    year: 2021,
  },
  {
    id: 3,
    title: 'Weak Hero',
    cover: 'https://picsum.photos/seed/series3/300/400',
    rating: 4.7,
    status: 'Leyendo',
    year: 2020,
  },
  {
    id: 4,
    title: 'The Gamer',
    cover: 'https://picsum.photos/seed/series4/300/400',
    rating: 4.6,
    status: 'Leyendo',
    year: 2013,
  },
  {
    id: 5,
    title: 'Omniscient Reader',
    cover: 'https://picsum.photos/seed/series5/300/400',
    rating: 4.8,
    status: 'Pendiente',
    year: 2020,
  },
  {
    id: 6,
    title: 'The Beginning After The End',
    cover: 'https://picsum.photos/seed/series6/300/400',
    rating: 4.7,
    status: 'Leyendo',
    year: 2019,
  },
];

// Componente de Paginación personalizado para evitar conflictos con Next.js 15
function CustomPagination({ value, onChange, total, color = "cyan" }) {
  const getVisiblePages = () => {
    const pages = [];
    const showPages = 5;
    let start = Math.max(1, value - Math.floor(showPages / 2));
    let end = Math.min(total, start + showPages - 1);
    
    if (end - start + 1 < showPages) {
      start = Math.max(1, end - showPages + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  const buttonStyle = (isActive) => ({
    minWidth: 36,
    height: 36,
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    fontWeight: isActive ? 600 : 400,
    backgroundColor: isActive ? `var(--mantine-color-${color}-6)` : 'transparent',
    color: isActive ? 'white' : 'var(--mantine-color-dimmed)',
    transition: 'all 0.2s ease',
  });

  const navButtonStyle = (disabled) => ({
    minWidth: 36,
    height: 36,
    borderRadius: '50%',
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    backgroundColor: 'transparent',
    color: disabled ? 'var(--mantine-color-gray-6)' : 'var(--mantine-color-dimmed)',
    opacity: disabled ? 0.5 : 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  });

  return (
    <Group gap={4}>
      <button
        style={navButtonStyle(value === 1)}
        onClick={() => value > 1 && onChange(1)}
        disabled={value === 1}
        aria-label="Primera página"
      >
        <IconChevronsLeft size={18} />
      </button>
      <button
        style={navButtonStyle(value === 1)}
        onClick={() => value > 1 && onChange(value - 1)}
        disabled={value === 1}
        aria-label="Página anterior"
      >
        <IconChevronLeft size={18} />
      </button>
      
      {getVisiblePages().map((page) => (
        <button
          key={page}
          style={buttonStyle(page === value)}
          onClick={() => onChange(page)}
          aria-label={`Página ${page}`}
          aria-current={page === value ? 'page' : undefined}
        >
          {page}
        </button>
      ))}
      
      <button
        style={navButtonStyle(value === total)}
        onClick={() => value < total && onChange(value + 1)}
        disabled={value === total}
        aria-label="Página siguiente"
      >
        <IconChevronRight size={18} />
      </button>
      <button
        style={navButtonStyle(value === total)}
        onClick={() => value < total && onChange(total)}
        disabled={value === total}
        aria-label="Última página"
      >
        <IconChevronsRight size={18} />
      </button>
    </Group>
  );
}

// Componente: Card Colección Personal
function UserCollectionCard({ collection, onEdit, onDelete }) {
  const router = useRouter();

  const handleView = () => {
    try {
      router.push(`/colecciones/${collection.name}`);
    } catch {
      try {
        const url = new URL(window.location.href);
        url.pathname = `/colecciones/${collection.name}`;
        window.location.href = url.toString();
      } catch {
        void 0;
      }
    }
  };

  return (
    <Card
      p={0}
      className={`${classes.collectionCard} ${classes.userCollectionCard}`}
      component="button"
      onClick={handleView}
    >
      <div className={classes.cardImageSection}>
        <Image
          src={normalizeImageUrl(collection.cover || collection.coverUrl || collection.cover_url)}
          alt={collection.name}
          h="100%"
          w="100%"
          style={{ objectFit: 'cover' }}
        />
        <div className={classes.statusBadge}>
          {collection.isPublic ? 'PÚBLICA' : 'PRIVADA'}
        </div>
        
        <Box 
          onClick={(e) => e.stopPropagation()}
          className={classes.menuButton}
        >
          <Popover position="bottom-end" shadow="md">
            <Popover.Target>
               <IconDots size={16} />
            </Popover.Target>
            <Popover.Dropdown p={4}>
              <Stack gap={4}>
                <Button
                  size="xs"
                  variant="subtle"
                  color="gray"
                  leftSection={<IconEdit size={14} />}
                  justify="flex-start"
                  onClick={(e) => { e.stopPropagation(); onEdit(collection); }}
                >
                  Editar
                </Button>
                <Button
                  size="xs"
                  variant="subtle"
                  color="red"
                  leftSection={<IconTrash size={14} />}
                  justify="flex-start"
                  onClick={(e) => { e.stopPropagation(); onDelete(collection.id); }}
                >
                  Eliminar
                </Button>
              </Stack>
            </Popover.Dropdown>
          </Popover>
        </Box>
      </div>

      <div className={classes.cardContent}>
        <Text className={classes.textTitle} lineClamp={1} ta="left">
          {collection.name}
        </Text>
        <Text className={classes.textDescription} lineClamp={2} ta="left">
          {collection.description}
        </Text>

        <Group justify="space-between" align="center" mt="md" w="100%">
          <div className={classes.countBadge}>
            <div className={classes.countIcon}>
              <IconBook size={16} />
            </div>
            {collection.manhwas}
          </div>
          <Text className={classes.dateText}>
            {new Date(collection.updatedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
          </Text>
        </Group>
      </div>
    </Card>
  );
}

// Componente: Card CTA para crear una nueva colección (se parece a una colección)
const NewCollectionCard = ({ onCreate }) => (
  <Card
    p={0}
    className={`${classes.collectionCard} ${classes.createCard}`}
    component="button"
    onClick={onCreate}
  >
    <div className={classes.createCardImage}>
        <Stack gap={0} align="center">
            <div className={classes.createCardIconBox}>
                <IconPlus size={32} style={{ strokeWidth: 2.5 }} />
            </div>
            <Text fw={700} c="cyan.4" size="sm" mt="xs">Crear Nueva</Text>
        </Stack>
    </div>

    <div className={classes.cardContent} style={{ justifyContent: 'center', alignItems: 'center' }}>
      <Stack gap="xs" align="center">
         <Text className={classes.textDescription} ta="center">
            Organiza tus manhwas favoritos en colecciones personalizadas...
         </Text>
      </Stack>
    </div>
  </Card>
);

// Componente: Card Colección Comunidad (Más pequeña)
function CommunityCollectionCard({ collection, onLike, onFollow }) {
  const router = useRouter();

  const handleLikeClick = (e) => {
    e.stopPropagation();
    try {
      onLike(collection.id);
    } catch {
      // si onLike no está provisto, ignorar
    }
    try {
      router.push('/colecciones?tab=favoritos');
    } catch { void 0; }
    try {
      window.location.href = '/colecciones?tab=favoritos';
      return;
    } catch { void 0; }
  };

  const handleView = () => {
    try {
      router.push(`/colecciones/${collection.name}`);
    } catch {
      try {
        const url = new URL(window.location.href);
        url.pathname = `/colecciones/${collection.name}`;
        window.location.href = url.toString();
      } catch {
        void 0;
      }
    }
  };

  return (
    <Card
      p="xs"
      radius="md"
      className={classes.communitCard}
      component="button"
      onClick={handleView}
      style={{
        backgroundColor: 'var(--subtle-bg)',
        border: '1px solid var(--accent-cyan-0-2)',
        overflow: 'hidden',
        transition: 'all 0.3s ease',
        cursor: 'pointer',
      }}
    >
      <Card.Section>
        <Box style={{ position: 'relative', height: 100 }}>
          <Image
            src={normalizeImageUrl(collection.cover || collection.coverUrl || collection.cover_url)}
            alt={collection.name}
            height={100}
            style={{ objectFit: 'cover' }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(135deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.2) 100%)',
            }}
          />
          <Group
            gap="xs"
            style={{ position: 'absolute', bottom: '0.5rem', left: '0.5rem' }}
          >
            {collection.isVerified && (
              <Badge size="xs" color="cyan" leftSection={<IconSparkles size={10} />}>
                Verificado
              </Badge>
            )}
          </Group>
        </Box>
      </Card.Section>

      <Stack gap="xs" p="xs">
        <div>
          <Text fw={600} size="xs" lineClamp={1}>
            {collection.name}
          </Text>
          <Group gap="xs">
            <Avatar src={collection.creatorAvatar} size={20} radius="xl" />
            <div style={{ flex: 1 }}>
              <Text size="7" fw={600} lineClamp={1}>
                {collection.creator}
              </Text>
            </div>
          </Group>
        </div>

        <Group gap="2" justify="space-between" grow>
          <Tooltip label={`${collection.followers} seguidores`}>
            <Card p="4" radius="sm" style={{
              backgroundColor: 'var(--accent-cyan-0-1)',
              border: '1px solid var(--accent-cyan-0-2)',
              textAlign: 'center',
            }}>
              <Text size="7" fw={600}>{(collection.followers / 1000).toFixed(1)}k</Text>
            </Card>
          </Tooltip>
          <Tooltip label={`${collection.likes} me gusta`}>
            <Card p="4" radius="sm" style={{
              backgroundColor: 'rgba(var(--accent-red), 0.1)',
              border: '1px solid var(--accent-red-0-2)',
              textAlign: 'center',
            }}>
              <Text size="7" fw={600}>{(collection.likes / 1000).toFixed(1)}k</Text>
            </Card>
          </Tooltip>
        </Group>

        <Group gap="xs" grow>
          <ActionIcon
            variant="light"
            color={collection.userLiked ? 'red' : 'gray'}
            size="sm"
            onClick={handleLikeClick}
          >
            {collection.userLiked ? <IconHeartFilled size={14} /> : <IconHeart size={14} />}
          </ActionIcon>
          <ActionIcon
            variant="light"
            color={collection.userFollowing ? 'cyan' : 'gray'}
            size="sm"
            onClick={(e) => { e.stopPropagation(); onFollow(collection.id); }}
          >
            {collection.userFollowing ? <IconUserCheck size={14} /> : <IconUserPlus size={14} />}
          </ActionIcon>
        </Group>
      </Stack>
    </Card>
  );
}

// Componente: Card Manhwa Favorito
const FavoriteManhwaCard = ({ manhwa, onRemove }) => (
  <Card
    p={0}
    radius="md"
    style={{
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid rgba(6, 182, 212, 0.2)',
      overflow: 'hidden',
      position: 'relative',
    }}
  >
    <Box style={{ position: 'relative', height: 180 }}>
      <Image
        src={normalizeImageUrl(manhwa.cover || manhwa.coverUrl || manhwa.cover_url)}
        alt={manhwa.title}
        height={180}
        style={{ objectFit: 'cover' }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to bottom, transparent, rgba(10,10,15,0.9))',
        }}
      />
      <ActionIcon
        variant="light"
        color="red"
        size="sm"
        style={{ position: 'absolute', top: '0.5rem', right: '0.5rem' }}
        onClick={() => onRemove(manhwa.id)}
      >
        <IconX size={14} />
      </ActionIcon>
      <Group
        gap="4"
        style={{ position: 'absolute', bottom: '0.5rem', left: '0.5rem', right: '0.5rem' }}
      >
        <Badge size="xs" color="cyan">{manhwa.status}</Badge>
        <Badge size="xs" variant="outline" color="yellow">{manhwa.year}</Badge>
      </Group>
    </Box>
    <Stack p="xs" gap="xs">
      <Text size="xs" fw={600} lineClamp={2}>
        {manhwa.title}
      </Text>
      <Group gap="xs">
        <Text size="7" fw={600}>★ {manhwa.rating}</Text>
      </Group>
    </Stack>
  </Card>
);

// Componente Principal
export default function Colecciones() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isSmallMobile = useMediaQuery('(max-width: 480px)');
  
  const initialTab = searchParams.get('tab') || 'mis-colecciones';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [userCollections, setUserCollections] = useState(mockUserCollections);
  const [communityCollections, setCommunityCollections] = useState(mockCommunityCollections);
  const [favoriteManhwas, setFavoriteManhwas] = useState(mockFavoriteManhwas);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [showFiltersDrawer, setShowFiltersDrawer] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCollection, setSelectedCollection] = useState(null);

  const itemsPerPage = 12;

  // Estados para el formulario de crear/editar colección
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newIsPublic, setNewIsPublic] = useState(false);

  // Sincronizar campos del modal cuando se abre para editar
  useEffect(() => {
    if (selectedCollection) {
      setNewName(selectedCollection.name || '');
      setNewDescription(selectedCollection.description || '');
      setNewIsPublic(!!selectedCollection.isPublic);
    } else {
      setNewName('');
      setNewDescription('');
      setNewIsPublic(false);
    }
  }, [selectedCollection, showNewModal]);

  // Manejadores
  const handleLike = (id) => {
    setCommunityCollections(communityCollections.map(c =>
      c.id === id
        ? { ...c, userLiked: !c.userLiked, likes: c.userLiked ? c.likes - 1 : c.likes + 1 }
        : c
    ));
  };

  // Sincronizar el estado de la pestaña con los parámetros de búsqueda
  useEffect(() => {
    const tab = searchParams.get('tab') || 'mis-colecciones';
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  const handleFollow = (id) => {
    setCommunityCollections(communityCollections.map(c =>
      c.id === id
        ? { ...c, userFollowing: !c.userFollowing, followers: c.userFollowing ? c.followers - 1 : c.followers + 1 }
        : c
    ));
  };

  const handleDeleteUserCollection = (id) => {
    setUserCollections(userCollections.filter(c => c.id !== id));
  };

  const handleRemoveFavorite = (id) => {
    setFavoriteManhwas(favoriteManhwas.filter(m => m.id !== id));
  };

  const handleEditCollection = (collection) => {
    setSelectedCollection(collection);
    setShowNewModal(true);
  };

  const handleSaveCollection = () => {
    if (!newName || !newName.trim()) return;

    if (selectedCollection) {
      // Editar colección existente
      setUserCollections(prev => prev.map(c => (
        c.id === selectedCollection.id
          ? { ...c, name: newName, description: newDescription, isPublic: newIsPublic, updatedAt: new Date().toISOString() }
          : c
      )));
    } else {
      // Crear nueva colección
      const id = Date.now();
      const newCol = {
        id,
        name: newName,
        description: newDescription,
        category: 'Personal',
        cover: `https://picsum.photos/seed/newcol${id}/400/250`,
        isPublic: newIsPublic,
        manhwas: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setUserCollections(prev => [newCol, ...prev]);
    }

    // Cerrar modal y limpiar selección
    setShowNewModal(false);
    setSelectedCollection(null);
  };

  // Filtrar colecciones comunitarias
  const filteredCommunity = useMemo(() => {
    return communityCollections.filter(c =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, communityCollections]);

  const paginatedCommunity = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredCommunity.slice(start, start + itemsPerPage);
  }, [filteredCommunity, currentPage]);

  const totalPages = Math.ceil(filteredCommunity.length / itemsPerPage);

  const handleTabChange = (val) => {
    if (!val) return;
    setActiveTab(val);
    try {
      router.push(`/colecciones?tab=${val}`);
    } catch {
      try {
        const url = new URL(window.location.href);
        url.pathname = '/colecciones';
        url.searchParams.set('tab', val);
        window.location.href = url.toString();
      } catch {
        void 0;
      }
    }
  };

  return (
    <Box
      className={classes.pageRoot}
      style={{ backgroundColor: 'var(--page-bg)', minHeight: '100vh' }}
    >
      <Container size="xl" py={isMobile ? 'md' : 'xl'} px={isSmallMobile ? 'xs' : isMobile ? 'sm' : 'md'} className="siteContainer">
        {/* Header */}
        <Group justify="space-between" align="flex-start" mb={isMobile ? 'md' : 'xl'}>
          <div>
            {!isSmallMobile && (
              <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb="xs">
                Biblioteca Personal
              </Text>
            )}
            <Text size={isMobile ? 'lg' : 'xl'} fw={700}>
              Mis Colecciones {isSmallMobile ? '' : 'y Favoritos'}
            </Text>
          </div>
          <div />
        </Group>

        {/* Tabs Principales */}
        <Tabs value={activeTab} onChange={handleTabChange} variant="pills" mb={isMobile ? 'md' : 'xl'}>
          {isMobile ? (
            <ScrollArea type="never" mb="md">
              <Tabs.List style={{ flexWrap: 'nowrap', minWidth: 'max-content' }}>
                <Tabs.Tab value="mis-colecciones" leftSection={<IconFolderPlus size={isSmallMobile ? 12 : 14} />}>
                  {isSmallMobile ? `Mías (${userCollections.length})` : `Mis Colecciones (${userCollections.length})`}
                </Tabs.Tab>
                <Tabs.Tab value="favoritos" leftSection={<IconHeartFilled size={isSmallMobile ? 12 : 14} />}>
                  {isSmallMobile ? `Fav (${favoriteManhwas.length})` : `Favoritos (${favoriteManhwas.length})`}
                </Tabs.Tab>
                <Tabs.Tab value="comunidad" leftSection={<IconUsers size={isSmallMobile ? 12 : 14} />}>
                  {isSmallMobile ? `Com (${communityCollections.length})` : `Comunidad (${communityCollections.length})`}
                </Tabs.Tab>
              </Tabs.List>
            </ScrollArea>
          ) : (
            <Tabs.List>
              <Tabs.Tab value="mis-colecciones" leftSection={<IconFolderPlus size={14} />}>
                Mis Colecciones ({userCollections.length})
              </Tabs.Tab>
              <Tabs.Tab value="favoritos" leftSection={<IconHeartFilled size={14} />}>
                Favoritos ({favoriteManhwas.length})
              </Tabs.Tab>
              <Tabs.Tab value="comunidad" leftSection={<IconUsers size={14} />}>
                Comunidad ({communityCollections.length})
              </Tabs.Tab>
            </Tabs.List>
          )}

          {/* Tab: Mis Colecciones */}
          <Tabs.Panel value="mis-colecciones" pt="xl">
            <Stack gap="md">
              <Input
                placeholder={isSmallMobile ? "Buscar..." : "Buscar mis colecciones..."}
                leftSection={<IconSearch size={18} />}
                size={isSmallMobile ? 'sm' : 'md'}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.currentTarget.value);
                  setCurrentPage(1);
                }}
                rightSection={
                  searchQuery && (
                    <ActionIcon size="xs" color="gray" radius="xl" variant="transparent" onClick={() => setSearchQuery('')}>
                      <IconX size={16} />
                    </ActionIcon>
                  )
                }
              />

              <SimpleGrid 
                cols={{ base: 2, sm: 2, md: 3, lg: 4 }} 
                spacing={isSmallMobile ? 'xs' : isMobile ? 'sm' : 'lg'}
              >
                <NewCollectionCard
                  key="new-collection"
                  onCreate={() => {
                    setSelectedCollection(null);
                    setShowNewModal(true);
                  }}
                />
                {userCollections.map((collection) => (
                  <UserCollectionCard
                    key={collection.id}
                    collection={collection}
                    onEdit={handleEditCollection}
                    onDelete={handleDeleteUserCollection}
                  />
                ))}
              </SimpleGrid>
            </Stack>
          </Tabs.Panel>

          {/* Tab: Favoritos */}
          <Tabs.Panel value="favoritos" pt="xl">
            <Stack gap="md">
              {favoriteManhwas.length > 0 ? (
                <SimpleGrid 
                  cols={{ base: isSmallMobile ? 2 : 3, sm: 3, md: 4, lg: 5 }} 
                  spacing={isSmallMobile ? 'xs' : isMobile ? 'sm' : 'md'}
                >
                  {favoriteManhwas.map((manhwa) => (
                    <FavoriteManhwaCard
                      key={manhwa.id}
                      manhwa={manhwa}
                      onRemove={handleRemoveFavorite}
                    />
                  ))}
                </SimpleGrid>
              ) : (
                <Card p="xl" style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(6, 182, 212, 0.2)',
                  textAlign: 'center',
                }}>
                  <Stack gap="md" align="center">
                    <IconHeartFilled size={48} style={{ color: 'rgb(156, 163, 175)' }} />
                    <Text fw={600}>No tienes favoritos</Text>
                    <Text size="sm" c="dimmed">Las series que marques como favoritas aparecerán aquí</Text>
                  </Stack>
                </Card>
              )}
            </Stack>
          </Tabs.Panel>

          {/* Tab: Comunidad */}
          <Tabs.Panel value="comunidad" pt="xl">
            <Stack gap="md" mb="xl">
              {isMobile ? (
                <Stack gap="sm">
                  <Input
                    placeholder={isSmallMobile ? "Buscar..." : "Buscar colecciones..."}
                    leftSection={<IconSearch size={18} />}
                    size={isSmallMobile ? 'sm' : 'md'}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.currentTarget.value);
                      setCurrentPage(1);
                    }}
                    rightSection={
                      searchQuery && (
                        <ActionIcon size="xs" color="gray" radius="xl" variant="transparent" onClick={() => setSearchQuery('')}>
                          <IconX size={16} />
                        </ActionIcon>
                      )
                    }
                  />
                  <Button
                    variant="light"
                    color="cyan"
                    fullWidth
                    size={isSmallMobile ? 'sm' : 'md'}
                    leftSection={<IconFilter size={18} />}
                    onClick={() => setShowFiltersDrawer(true)}
                  >
                    Filtros
                  </Button>
                </Stack>
              ) : (
                <Group grow gap="md">
                  <Input
                    placeholder="Buscar colecciones comunitarias..."
                    leftSection={<IconSearch size={18} />}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.currentTarget.value);
                      setCurrentPage(1);
                    }}
                    rightSection={
                      searchQuery && (
                        <ActionIcon size="xs" color="gray" radius="xl" variant="transparent" onClick={() => setSearchQuery('')}>
                          <IconX size={16} />
                        </ActionIcon>
                      )
                    }
                  />
                  <ActionIcon
                    variant="light"
                    color="cyan"
                    size="lg"
                    onClick={() => setShowFiltersDrawer(true)}
                  >
                    <IconFilter size={18} />
                  </ActionIcon>
                </Group>
              )}

              {paginatedCommunity.length > 0 ? (
                <>
                  <SimpleGrid 
                    cols={{ base: isSmallMobile ? 2 : 3, sm: 3, md: 4, lg: 6 }} 
                    spacing={isSmallMobile ? 'xs' : isMobile ? 'sm' : 'md'}
                  >
                    {paginatedCommunity.map((collection) => (
                      <CommunityCollectionCard
                        key={collection.id}
                        collection={collection}
                        onLike={handleLike}
                        onFollow={handleFollow}
                      />
                    ))}
                  </SimpleGrid>

                  {totalPages > 1 && (
                    <Group justify="center">
                      <CustomPagination
                        value={currentPage}
                        onChange={setCurrentPage}
                        total={totalPages}
                        color="cyan"
                      />
                    </Group>
                  )}
                </>
              ) : (
                <Card p="xl" style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(6, 182, 212, 0.2)',
                  textAlign: 'center',
                }}>
                  <Stack gap="md" align="center">
                    <IconSearch size={48} style={{ color: 'rgb(156, 163, 175)' }} />
                    <Text fw={600}>No hay colecciones</Text>
                    <Text size="sm" c="dimmed">Intenta con otros términos de búsqueda</Text>
                  </Stack>
                </Card>
              )}
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Container>

      {/* Modal: Crear/Editar Colección */}
      <Modal
        opened={showNewModal}
        onClose={() => {
          setShowNewModal(false);
          setSelectedCollection(null);
        }}
        title={selectedCollection ? 'Editar Colección' : 'Crear Nueva Colección'}
        size="lg"
        centered
      >
        <Stack gap="md">
          <Input
            label="Nombre de la Colección"
            placeholder="Ej: Por Leer, Favoritas, etc..."
            value={newName}
            onChange={(e) => setNewName(e.currentTarget.value)}
          />

          <Textarea
            label="Descripción"
            placeholder="Describe el propósito de esta colección..."
            minRows={3}
            value={newDescription}
            onChange={(e) => setNewDescription(e.currentTarget.value)}
          />

          <Group>
            <Switch label="Hacer privada" checked={newIsPublic} onChange={(e) => setNewIsPublic(e.currentTarget.checked)} />
            <Text size="xs" c="dimmed">
              Las colecciones privadas solo las podras ver tu
            </Text>
          </Group>

          <Group justify="flex-end" gap="md">
            <Button
              variant="default"
              onClick={() => {
                setShowNewModal(false);
                setSelectedCollection(null);
                setNewName('');
                setNewDescription('');
                setNewIsPublic(false);
              }}
            >
              Cancelar
            </Button>
            <Button color="cyan" onClick={handleSaveCollection} disabled={!newName || !newName.trim()}>
              {selectedCollection ? 'Guardar Cambios' : 'Crear Colección'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Drawer: Filtros */}
      <Drawer
        opened={showFiltersDrawer}
        onClose={() => setShowFiltersDrawer(false)}
        title="Filtros"
        position="right"
      >
        <Stack gap="md">
          <div>
            <Text fw={600} mb="xs">
              Ordenar por
            </Text>
            <Stack gap="xs">
              {['Tendencia', 'Popular', 'Reciente', 'Más Seguidores'].map((filter) => (
                <Chip key={filter} color="cyan" defaultChecked={filter === 'Tendencia'}>
                  {filter}
                </Chip>
              ))}
            </Stack>
          </div>

          <Divider />

          <div>
            <Text fw={600} mb="xs">
              Categoría
            </Text>
            <Stack gap="xs">
              {['Acción', 'Drama', 'Romance', 'Fantasía', 'Comedia'].map((cat) => (
                <Chip key={cat} color="cyan">
                  {cat}
                </Chip>
              ))}
            </Stack>
          </div>
        </Stack>
      </Drawer>
    </Box>
  );
}