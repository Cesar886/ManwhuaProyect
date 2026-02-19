/**
 * Rutas de Administración
 */

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const adminController = require('../controllers/admin.controller');
const { authenticate } = require('../middleware/auth');
const { requirePermission, requireRole } = require('../middleware/authorize');
const { idParam, paginationValidation } = require('../middleware/validators');

// Todas las rutas requieren autenticación
router.use(authenticate);

// Dashboard
router.get('/dashboard', requirePermission('admin:dashboard'), adminController.getDashboard);
router.get('/stats', requirePermission('admin:dashboard'), adminController.getStats);

// Usuarios
router.get('/users', requirePermission('admin:users'), validate(paginationValidation), adminController.getUsers);
router.get('/users/:id', requirePermission('admin:users'), validate(idParam()), adminController.getUserDetail);

// Reportes
router.get('/reports', requirePermission('reports:read'), validate(paginationValidation), adminController.getReports);
router.put('/reports/:id', requirePermission('reports:manage'), validate(idParam()), adminController.updateReport);

// Audit logs
router.get('/audit-logs', requirePermission('admin:audit_logs'), validate(paginationValidation), adminController.getAuditLogs);

// Anuncios
router.get('/announcements', requirePermission('admin:announcements'), validate(paginationValidation), adminController.getAnnouncements);
router.post('/announcements', requirePermission('admin:announcements'), validate([
    body('title').trim().notEmpty().withMessage('Título requerido').isLength({ max: 300 }),
    body('content').trim().notEmpty().withMessage('Contenido requerido').isLength({ max: 5000 }),
]), adminController.createAnnouncement);
router.put('/announcements/:id', requirePermission('admin:announcements'), validate([
    ...idParam(),
    body('title').optional().trim().isLength({ max: 300 }),
    body('content').optional().trim().isLength({ max: 5000 }),
]), adminController.updateAnnouncement);
router.delete('/announcements/:id', requirePermission('admin:announcements'), validate(idParam()), adminController.deleteAnnouncement);

// Configuración del sitio
router.get('/settings', requirePermission('admin:settings'), adminController.getSettings);
router.put('/settings', requirePermission('admin:settings'), adminController.updateSettings);

// Tareas de mantenimiento
router.post('/maintenance/clear-cache', requireRole('superadmin'), adminController.clearCache);
router.post('/maintenance/reset-views', requireRole('superadmin'), adminController.resetDailyViews);
router.post('/maintenance/recalculate-stats', requireRole('superadmin'), adminController.recalculateStats);

module.exports = router;
