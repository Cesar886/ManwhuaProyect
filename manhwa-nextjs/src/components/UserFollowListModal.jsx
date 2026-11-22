'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Avatar, Button, Center, Group, Loader, Modal, Stack, Text,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconUserPlus, IconUserCheck } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import { followUser, getUserFollowers, getUserFollowing, unfollowUser } from '@/api/client';

export default function UserFollowListModal({ opened, onClose, username, type, onFollowChange }) {
  const { user: viewer, openLogin } = useAuth();
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyUsers, setBusyUsers] = useState({});
  const label = type === 'followers' ? 'Seguidores' : 'Siguiendo';

  useEffect(() => {
    if (!opened || !username || !type) return undefined;
    let active = true;
    setUsers([]);
    setPage(1);
    setPages(1);
    setLoading(true);

    const loadPage = async () => {
      try {
        const response = type === 'followers'
          ? await getUserFollowers(username, 1)
          : await getUserFollowing(username, 1);
        const data = response?.data || {};
        if (!active) return;
        setUsers(data[type] || []);
        setPages(data.pagination?.pages || 1);
      } catch (error) {
        if (active) {
          notifications.show({ title: `No se pudieron cargar ${label.toLowerCase()}`, message: error?.message || 'Inténtalo de nuevo.', color: 'red' });
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadPage();
    return () => { active = false; };
  }, [opened, username, type, label]);

  const loadMore = async () => {
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const response = type === 'followers'
        ? await getUserFollowers(username, nextPage)
        : await getUserFollowing(username, nextPage);
      const data = response?.data || {};
      setUsers(current => [...current, ...(data[type] || [])]);
      setPage(nextPage);
      setPages(data.pagination?.pages || pages);
    } catch (error) {
      notifications.show({ title: 'No se pudo cargar la lista', message: error?.message || 'Inténtalo de nuevo.', color: 'red' });
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleFollow = async (person) => {
    if (!viewer) {
      openLogin();
      return;
    }

    const viewerId = viewer.id || viewer._id;
    if (String(viewerId) === String(person.id)) return;
    const wasFollowing = Boolean(person.isFollowing);
    setBusyUsers(current => ({ ...current, [person.id]: true }));
    setUsers(current => current.map(item => item.id === person.id ? { ...item, isFollowing: !wasFollowing } : item));

    try {
      if (wasFollowing) await unfollowUser(person.username);
      else await followUser(person.username);
      onFollowChange?.({ user: person, isFollowing: !wasFollowing });
    } catch (error) {
      setUsers(current => current.map(item => item.id === person.id ? { ...item, isFollowing: wasFollowing } : item));
      notifications.show({ title: 'No se pudo actualizar el seguimiento', message: error?.message || 'Inténtalo de nuevo.', color: 'red' });
    } finally {
      setBusyUsers(current => ({ ...current, [person.id]: false }));
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title={label} centered radius="lg" size="md">
      {loading ? (
        <Center py="xl"><Loader color="yellow" /></Center>
      ) : users.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">Aún no hay usuarios en esta lista.</Text>
      ) : (
        <Stack gap="sm">
          {users.map(person => {
            const isSelf = String(viewer?.id || viewer?._id) === String(person.id);
            return (
              <Group key={person.id} justify="space-between" wrap="nowrap">
                <Group
                  component={Link}
                  href={`/users/${encodeURIComponent(person.username)}`}
                  onClick={onClose}
                  wrap="nowrap"
                  style={{ minWidth: 0, color: 'inherit', textDecoration: 'none' }}
                >
                  <Avatar src={person.avatarUrl} name={person.displayName || person.username} radius="xl" />
                  <Stack gap={0} style={{ minWidth: 0 }}>
                    <Text fw={600} lineClamp={1}>{person.displayName || person.username}</Text>
                    <Text size="sm" c="dimmed" lineClamp={1}>@{person.username}</Text>
                  </Stack>
                </Group>
                {!isSelf && (
                  <Button
                    variant={person.isFollowing ? 'light' : 'filled'}
                    color={person.isFollowing ? 'gray' : 'yellow'}
                    size="xs"
                    radius="xl"
                    leftSection={person.isFollowing ? <IconUserCheck size={15} /> : <IconUserPlus size={15} />}
                    loading={busyUsers[person.id]}
                    onClick={() => toggleFollow(person)}
                    aria-label={`${person.isFollowing ? 'Dejar de seguir' : 'Seguir'} a ${person.username}`}
                  >
                    {person.isFollowing ? 'Siguiendo' : 'Seguir'}
                  </Button>
                )}
              </Group>
            );
          })}
          {page < pages && (
            <Button variant="subtle" color="gray" loading={loadingMore} onClick={loadMore}>
              Cargar más
            </Button>
          )}
        </Stack>
      )}
    </Modal>
  );
}
