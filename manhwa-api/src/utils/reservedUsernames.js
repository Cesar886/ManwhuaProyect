/**
 * Lista de usernames prohibidos
 * Incluye: admin, sistema, staff, ofensivos, confusos
 *
 * Ahora cada categoría se enriquece mediante `generateExpanded`.
 */

// Generador reutilizable de variantes (números, separadores, sufijos, leet y compuestos)
function generateExpanded(bases, opts = {}) {
    const seps = opts.seps || ['', '.', '_', '-'];
    const suffixes = opts.suffixes || ['', 'x', 'xx', 'official', 'real', 'the', 'online', 'site'];
    const maxNum = opts.maxNum || 25;
    const targetSize = opts.targetSize || 1500;

    const set = new Set();

    // numeric and separator permutations
    bases.forEach(base => {
        seps.forEach(sep => {
            for (let n = 1; n <= maxNum; n++) {
                set.add(`${base}${sep}${n}`);
                set.add(`${base}${sep}0${n}`);
                set.add(`${base}${sep}${n}x`);
                set.add(`${base}${sep}${n}xx`);
            }
            suffixes.forEach(suf => set.add(`${base}${sep}${suf}`));
            set.add(`${base}${sep}admin`);
            set.add(`the${sep}${base}`);
            set.add(`my${sep}${base}`);
            set.add(`real${sep}${base}`);
            set.add(`official${sep}${base}`);
        });
    });

    // Leetspeak variants (deterministic)
    const leetMap = { a: '4', o: '0', i: '1', e: '3', s: '5', t: '7' };
    function leetVariants(str) {
        const variants = new Set([str]);
        for (const [k, v] of Object.entries(leetMap)) {
            Array.from(variants).forEach(curr => {
                if (new RegExp(k, 'i').test(curr)) {
                    variants.add(curr.replace(new RegExp(k, 'gi'), v));
                }
            });
        }
        return Array.from(variants);
    }

    bases.forEach(base => {
        leetVariants(base).forEach(v => {
            set.add(v);
            set.add(`${v}123`);
            set.add(`${v}007`);
            set.add(`the_${v}`);
            set.add(`${v}_admin`);
            set.add(`${v}-admin`);
        });
    });

    // Compound combos of two bases (within the provided bases)
    for (let i = 0; i < bases.length; i++) {
        for (let j = 0; j < bases.length; j++) {
            if (i === j) continue;
            const a = bases[i];
            const b = bases[j];
            seps.forEach(sep => {
                set.add(`${a}${sep}${b}`);
                set.add(`${a}${sep}${b}1`);
                set.add(`${b}${sep}${a}`);
            });
        }
    }

    // Pad until target size with numeric suffixes (safety cap)
    const prelist = Array.from(set);
    let idx = 0;
    while (set.size < targetSize) {
        const item = prelist[idx % prelist.length];
        set.add(`${item}${(idx % 999) + 1000}`);
        idx++;
        if (idx > 5000) break;
    }

    return Array.from(set);
}

// Mantener las listas manuales originales (variantes explícitas)
const adminManual = [
    'admin', 'administrator', 'administrador', 'administracion',
    'adm', 'adm1n', 'adm1nistrator', 'admlnistrator', 'adrnin',
    'a-dmin', 'a_dmin', 'a.dmin',
    'admin1', 'admin2', 'admin123', 'adminmaster',
    'superadmin', 'superadministrador', 'super_admin',
    'sysadmin', 'sysadministrator', 'systemadmin',
    'rootadmin', 'masteradmin', 'chiefadmin',
    'administrator1', 'theadmin', 'realadmin', 'officialadmin',
    'admins', 'adminsquad', 'headadmin', 'leadadmin', 'siteadmin',
    'site-admin', 'site_admin', 'siteadministrator', 'webadmin',
    'web_admin', 'web-administrator', 'webmaster', 'cpanel', 'controlpanel',
    'control_panel', 'adminpanel', 'admin_panel', 'paneladmin',
    'adminoffice', 'admin-office', 'adminOffice', 'administratorx',
    'administrator0', 'administator', 'admn', 'adnin', 'admni', 'admiin',
    'admi', 'ad-mon', 'system-adm', 'adminroot', 'super-adm',
    'admin_support', 'adminsupport', 'staffadmin', 'manageradmin',
    'bizadmin', 'portaladmin', 'siteowner', 'site_owner', 'sys-admin'
];

const staffManual = [
    'mod', 'moderator', 'moderador', 'moderacion',
    'm0d', 'm0derator', 'mod3rator',
    'staff', 'staffmember', 'equipo', 'team',
    'support', 'soporte', 'supp0rt', 'ayuda', 'help',
    'helpdesk', 'customerservice', 'atencion',
    'community', 'communitymanager', 'cm',
    'editor', 'translator', 'traductor'
];

const systemManual = [
    'system', 'sistema', 'sys', 'syst3m',
    'root', 'r00t', 'sudo', 'superuser',
    'server', 'servidor', 'serv3r',
    'bot', 'robot', 'autobot', 'chatbot',
    'api', 'webhook', 'service', 'daemon',
    'cron', 'scheduler', 'worker', 'queue',
    'database', 'db', 'mysql', 'postgres',
    'null', 'undefined', 'none', 'void', 'nil',
    'test', 'testing', 'debug', 'dev', 'developer',
    'localhost', '127001', 'localhost'
];

const brandManual = [
    'official', 'oficial', '0fficial', 'offic1al',
    'verified', 'verificado', 'ver1fied',
    'real', 'original', 'authentic', 'autentico',
    'founder', 'fundador', 'ceo', 'owner', 'dueño',
    'creator', 'creador', 'author', 'autor',
    'manhwa', 'manhwas', 'manhwaes', 'manhwalatino',
    'webtoon', 'webtoons', 'webcomic',
    'anthropic', 'claude', 'openai', 'chatgpt'
];

const securityManual = [
    'security', 'seguridad', 'secur1ty',
    'password', 'contraseña', 'passw0rd',
    'login', 'signin', 'signup', 'registro',
    'account', 'cuenta', 'acc0unt',
    'verify', 'verificar', 'confirm', 'confirmar',
    'reset', 'recovery', 'recuperar',
    'billing', 'payment', 'pago', 'facturacion',
    'invoice', 'factura', 'premium', 'vip', 'pro',
    'free', 'gratis', 'gift', 'regalo', 'winner', 'ganador'
];

const offensiveManual = [
    'puta', 'puto', 'perra', 'perro', 'zorra',
    'mierda', 'caca', 'culo', 'verga', 'pene', 'polla',
    'coño', 'cono', 'chingar', 'joder', 'follar',
    'marica', 'maricon', 'joto', 'gay', 'homosexual',
    'negro', 'nigger', 'nigga', 'n1gger', 'n1gga',
    'retard', 'retarded', 'retrasado',
    'fuck', 'fucker', 'fucking', 'fck', 'f*ck',
    'shit', 'sh1t', 'crap', 'ass', 'asshole',
    'bitch', 'b1tch', 'btch', 'dick', 'd1ck',
    'cock', 'c0ck', 'pussy', 'pvssy',
    'whore', 'slut', 'hoe', 'thot',
    'bastard', 'bastardo', 'idiota', 'estupido',
    'pendejo', 'cabron', 'gilipollas', 'imbecil',
    'nazi', 'hitler', 'h1tler', 'holocaust',
    'kkk', 'racist', 'racista', 'supremacist',
    'terrorist', 'terrorista', 'isis', 'alqaeda',
    'rape', 'rapist', 'violador', 'pedofilo', 'pedo'
];

const confusingManual = [
    'everyone', 'todos', 'all', 'here', 'channel',
    'anonymous', 'anonimo', 'anon', 'an0n',
    'unknown', 'desconocido', 'guest', 'invitado',
    'user', 'usuario', 'member', 'miembro',
    'newuser', 'nuevousuario', 'default',
    'deleted', 'eliminado', 'removed', 'banned', 'baneado',
    'suspended', 'suspendido', 'blocked', 'bloqueado',
    'private', 'privado', 'hidden', 'oculto',
    'me', 'yo', 'you', 'tu', 'i', 'myself',
    'someone', 'alguien', 'nobody', 'nadie',
    'everybody', 'anyone', 'somebody'
];

const routesManual = [
    'home', 'inicio', 'index', 'main',
    'login', 'logout', 'register', 'signup', 'signin',
    'profile', 'perfil', 'settings', 'config', 'configuracion',
    'dashboard', 'panel', 'admin', 'moderator',
    'search', 'buscar', 'explore', 'explorar',
    'trending', 'popular', 'new', 'nuevo', 'latest',
    'categories', 'categorias', 'genres', 'generos',
    'series', 'manhwa', 'chapter', 'capitulo',
    'comments', 'comentarios', 'reviews', 'reseñas',
    'bookmarks', 'favoritos', 'favorites', 'history', 'historial',
    'notifications', 'notificaciones', 'messages', 'mensajes',
    'followers', 'seguidores', 'following', 'siguiendo',
    'collections', 'colecciones', 'lists', 'listas',
    'badges', 'logros', 'achievements', 'stats', 'estadisticas',
    'premium', 'vip', 'pro', 'subscribe', 'suscribir',
    'terms', 'privacy', 'about', 'contact', 'contacto',
    'help', 'faq', 'support', 'api', 'developers',
    'blog', 'news', 'noticias', 'announcements', 'anuncios',
    'upload', 'download', 'descargar', 'share', 'compartir',
    'report', 'reportar', 'flag', 'abuse', 'dmca',
    'www', 'http', 'https', 'ftp', 'mailto', 'email'
];

// Bases (núcleo) por categoría — usadas por el generador
const BASES = {
    admin: ['admin', 'administrator', 'adm', 'superadmin', 'root', 'sysadmin', 'system', 'site', 'webmaster'],
    staff: ['mod', 'moderator', 'staff', 'support', 'help', 'team', 'editor', 'translator', 'community', 'cm'],
    system: ['system', 'root', 'sys', 'server', 'bot', 'api', 'service', 'daemon', 'worker', 'queue'],
    brand: ['official', 'verified', 'real', 'founder', 'creator', 'manhwa', 'webtoon', 'openai', 'anthropic'],
    security: ['security', 'password', 'login', 'account', 'verify', 'reset', 'billing', 'invoice', 'premium', 'free'],
    offensive: ['puta', 'mierda', 'fuck', 'shit', 'bitch', 'dick', 'cock', 'pussy', 'idiota', 'pendejo', 'nigger'],
    confusing: ['everyone', 'anonymous', 'guest', 'user', 'member', 'default', 'deleted', 'private', 'me', 'you'],
    routes: ['home', 'index', 'login', 'logout', 'register', 'profile', 'settings', 'dashboard', 'search', 'upload']
};

// Construir el objeto final mergeando listas manuales con las generadas
const RESERVED_USERNAMES = {
    admin: Array.from(new Set([...adminManual, ...generateExpanded(BASES.admin)])),
    staff: Array.from(new Set([...staffManual, ...generateExpanded(BASES.staff)])),
    system: Array.from(new Set([...systemManual, ...generateExpanded(BASES.system)])),
    brand: Array.from(new Set([...brandManual, ...generateExpanded(BASES.brand)])),
    security: Array.from(new Set([...securityManual, ...generateExpanded(BASES.security)])),
    offensive: Array.from(new Set([...offensiveManual, ...generateExpanded(BASES.offensive)])),
    confusing: Array.from(new Set([...confusingManual, ...generateExpanded(BASES.confusing)])),
    routes: Array.from(new Set([...routesManual, ...generateExpanded(BASES.routes)])),
    symbols: []
};

// Combinar todas las listas
const ALL_RESERVED = [
    ...RESERVED_USERNAMES.admin,
    ...RESERVED_USERNAMES.staff,
    ...RESERVED_USERNAMES.system,
    ...RESERVED_USERNAMES.brand,
    ...RESERVED_USERNAMES.security,
    ...RESERVED_USERNAMES.offensive,
    ...RESERVED_USERNAMES.confusing,
    ...RESERVED_USERNAMES.routes
];

module.exports = {
    RESERVED_USERNAMES,
    ALL_RESERVED
};