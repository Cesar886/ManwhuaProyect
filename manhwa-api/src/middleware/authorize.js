/**
 * Middleware de Autorización
 */

const { hasPermission, hasRole, canModifyUser } = require('../config/roles');

/**
 * Requerir un permiso específico
 */
const requirePermission = (permission) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Autenticación requerida'
            });
        }
        
        if (!hasPermission(req.user.role, permission)) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para realizar esta acción',
                required: permission
            });
        }
        
        next();
    };
};

/**
 * Requerir uno de varios permisos
 */
const requireAnyPermission = (...permissions) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Autenticación requerida'
            });
        }
        
        const hasAny = permissions.some(perm => hasPermission(req.user.role, perm));
        
        if (!hasAny) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para realizar esta acción',
                required: permissions
            });
        }
        
        next();
    };
};

/**
 * Requerir un rol mínimo
 */
const requireRole = (role) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Autenticación requerida'
            });
        }
        
        if (!hasRole(req.user.role, role)) {
            return res.status(403).json({
                success: false,
                message: `Se requiere rol de ${role} o superior`
            });
        }
        
        next();
    };
};

/**
 * Requerir roles específicos
 */
const requireRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Autenticación requerida'
            });
        }
        
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'No tienes el rol necesario para esta acción'
            });
        }
        
        next();
    };
};

/**
 * Verificar que es el propietario del recurso o tiene permisos
 */
const requireOwnerOrPermission = (getOwnerId, permission) => {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Autenticación requerida'
            });
        }
        
        try {
            const ownerId = await getOwnerId(req);
            
            // Es el propietario
            if (ownerId === req.user.id) {
                return next();
            }
            
            // Tiene el permiso para modificar cualquiera
            if (hasPermission(req.user.role, permission)) {
                return next();
            }
            
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para modificar este recurso'
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Error verificando permisos'
            });
        }
    };
};

/**
 * Verificar email verificado
 */
const requireVerifiedEmail = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Autenticación requerida'
        });
    }
    
    if (!req.user.isVerified) {
        return res.status(403).json({
            success: false,
            message: 'Debes verificar tu email para realizar esta acción',
            code: 'EMAIL_NOT_VERIFIED'
        });
    }
    
    next();
};

/**
 * Verificar cuenta premium
 */
const requirePremium = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Autenticación requerida'
        });
    }
    
    // Los roles altos también tienen acceso premium
    if (hasRole(req.user.role, 'translator')) {
        return next();
    }
    
    if (!req.user.isPremium) {
        return res.status(403).json({
            success: false,
            message: 'Esta función requiere una cuenta premium',
            code: 'PREMIUM_REQUIRED'
        });
    }
    
    next();
};

/**
 * Verificar que puede modificar a otro usuario
 */
const requireCanModifyUser = (getUserRole) => {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Autenticación requerida'
            });
        }
        
        try {
            const targetRole = await getUserRole(req);
            
            if (!canModifyUser(req.user.role, targetRole)) {
                return res.status(403).json({
                    success: false,
                    message: 'No puedes modificar a un usuario de igual o mayor rango'
                });
            }
            
            next();
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Error verificando permisos'
            });
        }
    };
};

module.exports = {
    requirePermission,
    requireAnyPermission,
    requireRole,
    requireRoles,
    requireOwnerOrPermission,
    requireVerifiedEmail,
    requirePremium,
    requireCanModifyUser
};
