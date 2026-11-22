const PROFILE_NETWORKS = {
  x: {
    hosts: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'],
    pattern: /^[A-Za-z0-9_]{1,15}$/,
  },
  instagram: {
    hosts: ['instagram.com', 'www.instagram.com'],
    pattern: /^[A-Za-z0-9._]{1,30}$/,
  },
};

export const getSocialLinkInput = (network, value) => {
  if (!value) return '';
  if (network === 'discord') return String(value).replace(/^@/, '');

  const config = PROFILE_NETWORKS[network];
  if (!config) return '';

  try {
    const url = new URL(value);
    if (!config.hosts.includes(url.hostname.toLowerCase())) return String(value);
    return url.pathname.split('/').filter(Boolean)[0] || '';
  } catch {
    return String(value).replace(/^@/, '');
  }
};

export const getSocialLinkErrors = (socialLinks) => {
  const errors = {};
  const links = socialLinks && typeof socialLinks === 'object' ? socialLinks : {};

  for (const network of Object.keys(PROFILE_NETWORKS)) {
    const input = typeof links[network] === 'string' ? links[network].trim() : '';
    if (!input) continue;

    const config = PROFILE_NETWORKS[network];
    let username = input;
    if (/^https?:\/\//i.test(input)) {
      try {
        const url = new URL(input);
        const segments = url.pathname.split('/').filter(Boolean);
        if (
          !config.hosts.includes(url.hostname.toLowerCase()) ||
          url.username ||
          url.password ||
          segments.length !== 1
        ) {
          errors[network] = 'Ingresa un usuario o el enlace a un perfil válido';
          continue;
        }
        username = segments[0];
      } catch {
        errors[network] = 'Ingresa un usuario o el enlace a un perfil válido';
        continue;
      }
    } else {
      username = username.replace(/^@/, '');
    }

    if (!config.pattern.test(username)) errors[network] = 'El nombre de usuario no es válido';
  }

  const discord = typeof links.discord === 'string' ? links.discord.trim().replace(/^@/, '') : '';
  if (discord && !/^[A-Za-z0-9_.]{2,32}$/.test(discord)) {
    errors.discord = 'El usuario de Discord debe tener entre 2 y 32 caracteres';
  }

  return errors;
};

export const getSafeSocialProfileUrl = (network, value) => {
  const config = PROFILE_NETWORKS[network];
  if (!config || !value) return null;

  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      !config.hosts.includes(url.hostname.toLowerCase()) ||
      url.username ||
      url.password ||
      url.pathname.split('/').filter(Boolean).length !== 1
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
};
