const NETWORKS = {
    x: {
        hosts: new Set(['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com']),
        usernamePattern: /^[A-Za-z0-9_]{1,15}$/
    },
    instagram: {
        hosts: new Set(['instagram.com', 'www.instagram.com']),
        usernamePattern: /^[A-Za-z0-9._]{1,30}$/
    }
};

const normalizeProfileLink = (network, value) => {
    const config = NETWORKS[network];
    let username = value.trim();

    if (/^https?:\/\//i.test(username)) {
        let url;
        try {
            url = new URL(username);
        } catch {
            throw new Error(`El enlace de ${network} no es válido`);
        }

        if (!config.hosts.has(url.hostname.toLowerCase()) || url.username || url.password) {
            throw new Error(`El enlace de ${network} debe apuntar a un perfil válido`);
        }

        const segments = url.pathname.split('/').filter(Boolean);
        if (segments.length !== 1) {
            throw new Error(`El enlace de ${network} debe apuntar a un perfil válido`);
        }
        username = segments[0];
    } else {
        username = username.replace(/^@/, '');
    }

    if (!config.usernamePattern.test(username)) {
        throw new Error(`El usuario de ${network} no es válido`);
    }

    const host = network === 'x' ? 'x.com' : 'instagram.com';
    return `https://${host}/${username}`;
};

const normalizeSocialLinks = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Las redes sociales deben enviarse como un objeto');
    }

    const unsupported = Object.keys(value).find(key => !['x', 'instagram', 'discord'].includes(key));
    if (unsupported) {
        throw new Error(`La red social "${unsupported}" no está permitida`);
    }

    const normalized = { x: null, instagram: null, discord: null };
    for (const network of Object.keys(normalized)) {
        const input = value[network];
        if (input === undefined || input === null || input === '') continue;
        if (typeof input !== 'string' || input.length > 256) {
            throw new Error(`El valor de ${network} no es válido`);
        }

        const trimmed = input.trim();
        if (!trimmed) continue;

        if (network === 'discord') {
            const username = trimmed.replace(/^@/, '');
            if (!/^[A-Za-z0-9_.]{2,32}$/.test(username)) {
                throw new Error('El usuario de Discord no es válido');
            }
            normalized.discord = `@${username}`;
        } else {
            normalized[network] = normalizeProfileLink(network, trimmed);
        }
    }

    return normalized;
};

module.exports = { normalizeSocialLinks };
