/**
 * Rutas de Autenticación
 */

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');

// Validaciones
const registerValidation = [
    body('username')
        .trim()
        .isLength({ min: 3, max: 50 })
        .withMessage('El username debe tener entre 3 y 50 caracteres')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('El username solo puede contener letras, números y guiones bajos'),
    body('email')
        .isEmail()
        .withMessage('Email inválido')
        .normalizeEmail(),
    body('password')
        .isLength({ min: 8 })
        .withMessage('La contraseña debe tener al menos 8 caracteres')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('La contraseña debe contener mayúsculas, minúsculas y números'),
    body('displayName')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('El nombre no puede exceder 100 caracteres')
];

const loginValidation = [
    body('login')
        .trim()
        .notEmpty()
        .withMessage('Username o email requerido'),
    body('password')
        .notEmpty()
        .withMessage('Contraseña requerida')
];

const forgotPasswordValidation = [
    body('email')
        .isEmail()
        .withMessage('Email inválido')
        .normalizeEmail()
];

const resetPasswordValidation = [
    body('token')
        .notEmpty()
        .withMessage('Token requerido'),
    body('password')
        .isLength({ min: 8 })
        .withMessage('La contraseña debe tener al menos 8 caracteres')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('La contraseña debe contener mayúsculas, minúsculas y números')
];

const changePasswordValidation = [
    body('currentPassword')
        .notEmpty()
        .withMessage('Contraseña actual requerida'),
    body('newPassword')
        .isLength({ min: 8 })
        .withMessage('La nueva contraseña debe tener al menos 8 caracteres')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('La contraseña debe contener mayúsculas, minúsculas y números')
];

// Validación para Google OAuth (acepta credential O access_token)
const googleAuthValidation = [
    body()
        .custom((body) => {
            if (!body.credential && !body.access_token) {
                throw new Error('Se requiere credential o access_token de Google');
            }
            return true;
        })
];

// Rutas públicas
router.post('/register', validate(registerValidation), authController.register);
router.post('/login', validate(loginValidation), authController.login);
router.post('/google', validate(googleAuthValidation), authController.googleAuth);
router.post('/refresh', authController.refreshToken);
router.post('/forgot-password', validate(forgotPasswordValidation), authController.forgotPassword);
router.post('/reset-password', validate(resetPasswordValidation), authController.resetPassword);
router.get('/verify-email/:token', authController.verifyEmail);

// Rutas protegidas
router.use(authenticate);
router.post('/logout', authController.logout);
router.post('/change-password', validate(changePasswordValidation), authController.changePassword);
router.get('/me', authController.getCurrentUser);
router.post('/resend-verification', authController.resendVerification);

module.exports = router;
