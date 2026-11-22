'use client';

import { ActionIcon, Group, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconBrandDiscord, IconBrandInstagram, IconBrandX, IconCheck } from '@tabler/icons-react';
import { getSafeSocialProfileUrl } from '@/utils/socialLinks';

const socialItems = [
  { key: 'x', label: 'X', icon: IconBrandX },
  { key: 'instagram', label: 'Instagram', icon: IconBrandInstagram },
];

export default function SocialProfileLinks({ links }) {
  const socialLinks = links || {};
  const hasSocialLinks = socialItems.some(({ key }) => getSafeSocialProfileUrl(key, socialLinks[key]))
    || Boolean(socialLinks.discord);

  if (!hasSocialLinks) return null;

  const copyDiscord = async () => {
    const username = String(socialLinks.discord || '').replace(/^@/, '');
    if (!username) return;

    try {
      await navigator.clipboard.writeText(`@${username}`);
      notifications.show({ title: 'Usuario copiado', message: `@${username} se copió al portapapeles`, color: 'green', icon: <IconCheck size={16} /> });
    } catch {
      notifications.show({ title: 'No se pudo copiar', message: 'Tu navegador no permitió acceder al portapapeles.', color: 'red' });
    }
  };

  return (
    <Group gap="xs" justify="center" aria-label="Redes sociales">
      {socialItems.map(({ key, label, icon: Icon }) => {
        const href = getSafeSocialProfileUrl(key, socialLinks[key]);
        if (!href) return null;
        return (
          <Tooltip key={key} label={label}>
            <ActionIcon
              component="a"
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              variant="light"
              color="gray"
              size="lg"
              radius="xl"
              aria-label={`Abrir perfil de ${label}`}
            >
              <Icon size={19} />
            </ActionIcon>
          </Tooltip>
        );
      })}
      {socialLinks.discord && (
        <Tooltip label={`Copiar Discord: ${socialLinks.discord}`}>
          <ActionIcon
            onClick={copyDiscord}
            variant="light"
            color="indigo"
            size="lg"
            radius="xl"
            aria-label="Copiar usuario de Discord"
          >
            <IconBrandDiscord size={19} />
          </ActionIcon>
        </Tooltip>
      )}
    </Group>
  );
}
