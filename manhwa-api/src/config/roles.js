/**
 * Sistema de Roles y Permisos
 */

// Jerarquía de roles (mayor número = más permisos)
const ROLE_HIERARCHY = {
    reader: 1,
    vip: 2,
    translator: 3,
    moderator: 4,
    admin: 5,
    superadmin: 6
};

// Permisos disponibles
const PERMISSIONS = {
    // Usuarios
    'users:read': ['reader', 'vip', 'translator', 'moderator', 'admin', 'superadmin'],
    'users:read_own': ['reader', 'vip', 'translator', 'moderator', 'admin', 'superadmin'],
    'users:update_own': ['reader', 'vip', 'translator', 'moderator', 'admin', 'superadmin'],
    'users:update_any': ['admin', 'superadmin'],
    'users:delete_own': ['reader', 'vip', 'translator', 'moderator', 'admin', 'superadmin'],
    'users:delete_any': ['superadmin'],
    'users:manage_roles': ['admin', 'superadmin'],
    'users:ban': ['moderator', 'admin', 'superadmin'],
    
    // Series
    'series:read': ['reader', 'vip', 'translator', 'moderator', 'admin', 'superadmin'],
    'series:create': ['translator', 'moderator', 'admin', 'superadmin'],
    'series:update': ['translator', 'moderator', 'admin', 'superadmin'],
    'series:delete': ['admin', 'superadmin'],
    'series:feature': ['moderator', 'admin', 'superadmin'],
    
    // Capítulos
    'chapters:read': ['reader', 'vip', 'translator', 'moderator', 'admin', 'superadmin'],
    'chapters:read_premium': ['vip', 'translator', 'moderator', 'admin', 'superadmin'],
    'chapters:create': ['translator', 'moderator', 'admin', 'superadmin'],
    'chapters:update': ['translator', 'moderator', 'admin', 'superadmin'],
    'chapters:delete': ['admin', 'superadmin'],
    
    // Comentarios
    'comments:read': ['reader', 'vip', 'translator', 'moderator', 'admin', 'superadmin'],
    'comments:create': ['reader', 'vip', 'translator', 'moderator', 'admin', 'superadmin'],
    'comments:update_own': ['reader', 'vip', 'translator', 'moderator', 'admin', 'superadmin'],
    'comments:delete_own': ['reader', 'vip', 'translator', 'moderator', 'admin', 'superadmin'],
    'comments:delete_any': ['moderator', 'admin', 'superadmin'],
    'comments:pin': ['moderator', 'admin', 'superadmin'],
    'comments:hide': ['moderator', 'admin', 'superadmin'],
    
    // Colecciones
    'collections:read': ['reader', 'vip', 'translator', 'moderator', 'admin', 'superadmin'],
    'collections:create': ['reader', 'vip', 'translator', 'moderator', 'admin', 'superadmin'],
    'collections:update_own': ['reader', 'vip', 'translator', 'moderator', 'admin', 'superadmin'],
    'collections:delete_own': ['reader', 'vip', 'translator', 'moderator', 'admin', 'superadmin'],
    'collections:delete_any': ['admin', 'superadmin'],
    'collections:verify': ['moderator', 'admin', 'superadmin'],
    
    // Pedidos/Requests
    'requests:read': ['reader', 'vip', 'translator', 'moderator', 'admin', 'superadmin'],
    'requests:create': ['reader', 'vip', 'translator', 'moderator', 'admin', 'superadmin'],
    'requests:vote': ['reader', 'vip', 'translator', 'moderator', 'admin', 'superadmin'],
    'requests:manage': ['moderator', 'admin', 'superadmin'],
    'requests:delete': ['admin', 'superadmin'],
    
    // Reportes
    'reports:create': ['reader', 'vip', 'translator', 'moderator', 'admin', 'superadmin'],
    'reports:read': ['moderator', 'admin', 'superadmin'],
    'reports:manage': ['moderator', 'admin', 'superadmin'],
    
    // Admin
    'admin:dashboard': ['moderator', 'admin', 'superadmin'],
    'admin:settings': ['admin', 'superadmin'],
    'admin:users': ['admin', 'superadmin'],
    'admin:audit_logs': ['admin', 'superadmin'],
    'admin:announcements': ['moderator', 'admin', 'superadmin'],
    
    // Uploads
    'upload:images': ['translator', 'moderator', 'admin', 'superadmin'],
    'upload:chapters': ['translator', 'moderator', 'admin', 'superadmin'],
};

/**
 * Verificar si un rol tiene un permiso específico
 */
const hasPermission = (userRole, permission) => {
    if (!PERMISSIONS[permission]) {
        return false;
    }
    return PERMISSIONS[permission].includes(userRole);
};

/**
 * Verificar si un rol es igual o superior a otro
 */
const hasRole = (userRole, requiredRole) => {
    const userLevel = ROLE_HIERARCHY[userRole] || 0;
    const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
    return userLevel >= requiredLevel;
};

/**
 * Obtener todos los permisos de un rol
 */
const getRolePermissions = (role) => {
    const permissions = [];
    for (const [permission, roles] of Object.entries(PERMISSIONS)) {
        if (roles.includes(role)) {
            permissions.push(permission);
        }
    }
    return permissions;
};

/**
 * Verificar si puede modificar a otro usuario
 */
const canModifyUser = (actorRole, targetRole) => {
    const actorLevel = ROLE_HIERARCHY[actorRole] || 0;
    const targetLevel = ROLE_HIERARCHY[targetRole] || 0;
    
    // Solo puede modificar usuarios de nivel inferior
    return actorLevel > targetLevel;
};

/**
 * Roles que puede asignar cada rol
 */
const getAssignableRoles = (role) => {
    switch (role) {
        case 'superadmin':
            return ['reader', 'vip', 'translator', 'moderator', 'admin'];
        case 'admin':
            return ['reader', 'vip', 'translator', 'moderator'];
        default:
            return [];
    }
};

module.exports = {
    ROLE_HIERARCHY,
    PERMISSIONS,
    hasPermission,
    hasRole,
    getRolePermissions,
    canModifyUser,
    getAssignableRoles
};
