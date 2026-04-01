/**
 * Controlador de Autenticación
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { query, transaction } = require('../config/database');
const { validateUsername } = require('../utils/usernameValidator');
const { generateTokens, verifyRefreshToken } = require('../middleware/auth');
const { getRolePermissions } = require('../config/roles');

// Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Helper: Establece cookies de autenticación (token y refreshToken)
 * ✅ DRY: Código reutilizable para register/login
 * @param {Response} res - Objeto response de Express
 * @param {Object} tokens - { accessToken, refreshToken }
 * @returns {boolean} - true si cookies se establecieron, false si hubo error
 */
const setCookieTokens = (res, tokens) => {
    try {
        const accessMaxAge = parseInt(process.env.COOKIE_MAX_AGE_MS) || 7 * 24 * 60 * 60 * 1000;
        const refreshMaxAge = parseInt(process.env.COOKIE_REFRESH_MAX_AGE_MS) || 30 * 24 * 60 * 60 * 1000;
        const isProduction = process.env.NODE_ENV === 'production';

        const cookieOpts = {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'lax',
            maxAge: accessMaxAge,
            signed: false
        };

        // Establecer cookies vía res.cookie()
        res.cookie('token', tokens.accessToken, cookieOpts);
        res.cookie('refreshToken', tokens.refreshToken, { ...cookieOpts, maxAge: refreshMaxAge });

        // Fallback: Establecer vía res.setHeader() para robustez
        try {
            const secureFlag = isProduction ? '; Secure' : '';
            const accessMax = Math.floor(accessMaxAge / 1000);
            const refreshMax = Math.floor(refreshMaxAge / 1000);
            const cookie1 = `token=${tokens.accessToken}; HttpOnly; Path=/; Max-Age=${accessMax}; SameSite=Lax${secureFlag}`;
            const cookie2 = `refreshToken=${tokens.refreshToken}; HttpOnly; Path=/; Max-Age=${refreshMax}; SameSite=Lax${secureFlag}`;
            res.setHeader('Set-Cookie', [cookie1, cookie2]);
        } catch (e) {
            // Fallback silencioso: res.cookie() ya estableció las cookies
        }

        return true;
    } catch (error) {
        console.warn('⚠️ No se pudieron establecer cookies de sesión:', error.message);
        return false;
    }
};

/**
 * Registrar nuevo usuario
 * POST /api/auth/register
 */
const register = async (req, res, next) => {
    try {
        const { username, email, password, displayName } = req.body;
        const usernameTrim = username && typeof username === 'string' ? username.trim() : username;

        // Validar username antes de tocar la base de datos
        const usernameValidation = validateUsername(usernameTrim);
        if (!usernameValidation.valid) {
            return res.status(400).json({
                success: false,
                message: 'Nombre de usuario inválido',
                errors: usernameValidation.errors
            });
        }

        // Verificar si ya existe
        const existingUser = await query(
            'SELECT id FROM users WHERE username = $1 OR email = $2',
            [usernameTrim.toLowerCase(), email.toLowerCase()]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'El username o email ya están registrados'
            });
        }

        // Hash de la contraseña
        const passwordHash = await bcrypt.hash(password, 12);

        // Token de verificación
        const verificationToken = crypto.randomBytes(32).toString('hex');

        // Crear usuario
        const result = await query(
            `INSERT INTO users (username, email, password_hash, display_name, verification_token)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, username, email, display_name, role, status, created_at`,
            [usernameTrim.toLowerCase(), email.toLowerCase(), passwordHash, displayName || usernameTrim, verificationToken]
        );

        const user = result.rows[0];

        // Generar tokens
        const tokens = generateTokens(user.id);

        // ✅ Establecer cookies de autenticación (refactorizado)
        setCookieTokens(res, tokens);

        // Registrar actividad
        await query(
            `INSERT INTO activities (user_id, action, metadata)
             VALUES ($1, 'register', $2)`,
            [user.id, JSON.stringify({ ip: req.ip })]
        );

        // TODO: Enviar email de verificación
        // await sendVerificationEmail(user.email, verificationToken);

        res.status(201).json({
            success: true,
            message: 'Usuario registrado exitosamente. Revisa tu email para verificar tu cuenta.',
            data: {
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    displayName: user.display_name,
                    role: user.role,
                    status: user.status
                },
                tokens
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Iniciar sesión
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
    try {
        const { login, password } = req.body;

        // Buscar usuario por username o email
        const result = await query(
            `SELECT id, username, email, password_hash, display_name, avatar_url,
                    role, status, is_premium, email_verified_at
             FROM users 
             WHERE (username = $1 OR email = $1) AND deleted_at IS NULL`,
            [login.toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Credenciales inválidas'
            });
        }

        const user = result.rows[0];

        // Verificar contraseña
        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Credenciales inválidas'
            });
        }

        // Verificar estado
        if (user.status === 'banned') {
            return res.status(403).json({
                success: false,
                message: 'Tu cuenta ha sido suspendida permanentemente'
            });
        }

        if (user.status === 'suspended') {
            return res.status(403).json({
                success: false,
                message: 'Tu cuenta está temporalmente suspendida'
            });
        }

        // Actualizar último login
        await query(
            `UPDATE users 
             SET last_login_at = NOW(), 
                 last_login_ip = $1, 
                 login_count = login_count + 1
             WHERE id = $2`,
            [req.ip, user.id]
        );

        // Generar tokens
        const tokens = generateTokens(user.id);

        // Registrar actividad
        await query(
            `INSERT INTO activities (user_id, action, metadata)
             VALUES ($1, 'login', $2)`,
            [user.id, JSON.stringify({ ip: req.ip, userAgent: req.get('User-Agent') })]
        );

        // Obtener permisos del rol
        const permissions = getRolePermissions(user.role);

        // ✅ Establecer cookies de autenticación (refactorizado)
        setCookieTokens(res, tokens);

        res.json({
            success: true,
            message: 'Inicio de sesión exitoso',
            data: {
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    displayName: user.display_name,
                    avatarUrl: user.avatar_url,
                    role: user.role,
                    status: user.status,
                    isPremium: user.is_premium,
                    isVerified: !!user.email_verified_at,
                    permissions
                },
                tokens
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Refrescar token
 * POST /api/auth/refresh
 */
const refreshToken = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                message: 'Refresh token requerido'
            });
        }

        const decoded = verifyRefreshToken(refreshToken);

        if (!decoded) {
            return res.status(401).json({
                success: false,
                message: 'Refresh token inválido o expirado'
            });
        }

        // Verificar que el usuario existe y está activo
        const result = await query(
            `SELECT id, username, role, status FROM users 
             WHERE id = $1 AND deleted_at IS NULL AND status = 'active'`,
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Usuario no encontrado o inactivo'
            });
        }

        // Generar nuevos tokens
        const tokens = generateTokens(decoded.userId);

        res.json({
            success: true,
            data: { tokens }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Cerrar sesión
 * POST /api/auth/logout
 */
const logout = async (req, res, next) => {
    try {
        // Registrar actividad
        await query(
            `INSERT INTO activities (user_id, action, metadata)
             VALUES ($1, 'logout', $2)`,
            [req.user.id, JSON.stringify({ ip: req.ip })]
        );

        // Limpiar cookie si existe
        res.clearCookie('token');
        res.clearCookie('refreshToken');

        res.json({
            success: true,
            message: 'Sesión cerrada exitosamente'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener usuario actual
 * GET /api/auth/me
 */
const getCurrentUser = async (req, res, next) => {
    try {
        const result = await query(
            `SELECT u.id, u.username, u.email, u.display_name, u.avatar_url, u.banner_url,
                    u.bio, u.location, u.website, u.role, u.status, u.is_premium,
                    u.premium_until, u.level, u.experience, u.email_verified_at,
                    u.followers_count, u.following_count, u.collections_count,
                    u.theme_primary_color, u.theme_accent_color, u.theme_mode,
                    u.preferences, u.created_at,
                    (SELECT COUNT(*) FROM bookmarks WHERE user_id = u.id) as bookmarks_count,
                    (SELECT COUNT(*) FROM reading_history WHERE user_id = u.id) as reading_count
             FROM users u
             WHERE u.id = $1`,
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        const user = result.rows[0];
        const permissions = getRolePermissions(user.role);

        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    displayName: user.display_name,
                    avatarUrl: user.avatar_url,
                    bannerUrl: user.banner_url,
                    bio: user.bio,
                    location: user.location,
                    website: user.website,
                    role: user.role,
                    status: user.status,
                    isPremium: user.is_premium,
                    premiumUntil: user.premium_until,
                    level: user.level,
                    experience: parseInt(user.experience) || 0,
                    isVerified: !!user.email_verified_at,
                    theme_mode: user.theme_mode,
                    theme: {
                        primaryColor: user.theme_primary_color,
                        accentColor: user.theme_accent_color,
                        colorScheme: user.theme_mode
                    },
                    stats: {
                        followers: user.followers_count,
                        following: user.following_count,
                        collections: user.collections_count,
                        bookmarks: parseInt(user.bookmarks_count),
                        reading: parseInt(user.reading_count)
                    },
                    preferences: user.preferences,
                    permissions,
                    createdAt: user.created_at
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Verificar email
 * GET /api/auth/verify-email/:token
 */
const verifyEmail = async (req, res, next) => {
    try {
        const { token } = req.params;

        const result = await query(
            `UPDATE users 
             SET email_verified_at = NOW(), 
                 verification_token = NULL,
                 status = 'active'
             WHERE verification_token = $1 AND email_verified_at IS NULL
             RETURNING id, username, email`,
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Token de verificación inválido o ya utilizado'
            });
        }

        res.json({
            success: true,
            message: 'Email verificado exitosamente'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Reenviar email de verificación
 * POST /api/auth/resend-verification
 */
const resendVerification = async (req, res, next) => {
    try {
        if (req.user.isVerified) {
            return res.status(400).json({
                success: false,
                message: 'Tu email ya está verificado'
            });
        }

        const verificationToken = crypto.randomBytes(32).toString('hex');

        await query(
            'UPDATE users SET verification_token = $1 WHERE id = $2',
            [verificationToken, req.user.id]
        );

        // TODO: Enviar email
        // await sendVerificationEmail(req.user.email, verificationToken);

        res.json({
            success: true,
            message: 'Email de verificación reenviado'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Solicitar recuperación de contraseña
 * POST /api/auth/forgot-password
 */
const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;

        const result = await query(
            'SELECT id, username, email FROM users WHERE email = $1 AND deleted_at IS NULL',
            [email.toLowerCase()]
        );

        // Siempre responder con éxito para no revelar si el email existe
        if (result.rows.length === 0) {
            return res.json({
                success: true,
                message: 'Si el email existe, recibirás instrucciones para restablecer tu contraseña'
            });
        }

        const user = result.rows[0];
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

        await query(
            `UPDATE users 
             SET reset_token = $1, reset_token_expires_at = NOW() + INTERVAL '1 hour'
             WHERE id = $2`,
            [resetTokenHash, user.id]
        );

        // TODO: Enviar email con link de recuperación
        // await sendPasswordResetEmail(user.email, resetToken);

        res.json({
            success: true,
            message: 'Si el email existe, recibirás instrucciones para restablecer tu contraseña'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Restablecer contraseña
 * POST /api/auth/reset-password
 */
const resetPassword = async (req, res, next) => {
    try {
        const { token, password } = req.body;

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const result = await query(
            `SELECT id FROM users 
             WHERE reset_token = $1 
             AND reset_token_expires_at > NOW()
             AND deleted_at IS NULL`,
            [tokenHash]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Token inválido o expirado'
            });
        }

        const user = result.rows[0];
        const passwordHash = await bcrypt.hash(password, 12);

        await query(
            `UPDATE users 
             SET password_hash = $1, reset_token = NULL, reset_token_expires_at = NULL
             WHERE id = $2`,
            [passwordHash, user.id]
        );

        res.json({
            success: true,
            message: 'Contraseña restablecida exitosamente'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Cambiar contraseña
 * POST /api/auth/change-password
 */
const changePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;

        // Obtener contraseña actual
        const result = await query(
            'SELECT password_hash FROM users WHERE id = $1',
            [req.user.id]
        );

        const user = result.rows[0];

        // Verificar contraseña actual
        const isValid = await bcrypt.compare(currentPassword, user.password_hash);

        if (!isValid) {
            return res.status(400).json({
                success: false,
                message: 'La contraseña actual es incorrecta'
            });
        }

        // Hash de la nueva contraseña
        const passwordHash = await bcrypt.hash(newPassword, 12);

        await query(
            'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
            [passwordHash, req.user.id]
        );

        // Registrar actividad
        await query(
            `INSERT INTO activities (user_id, action, metadata)
             VALUES ($1, 'password_changed', $2)`,
            [req.user.id, JSON.stringify({ ip: req.ip })]
        );

        res.json({
            success: true,
            message: 'Contraseña cambiada exitosamente'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Login con Google OAuth
 * POST /api/auth/google
 * Recibe el credential (ID token) o access_token del frontend y verifica con Google
 */
const googleAuth = async (req, res, next) => {
    try {
        const { credential, access_token } = req.body;
        const token = credential || access_token;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Token de Google requerido'
            });
        }

        // Verificar el token con Google
        let payload;
        try {
            if (credential) {
                // Si es un ID token, usar verifyIdToken
                const ticket = await googleClient.verifyIdToken({
                    idToken: credential,
                    audience: process.env.GOOGLE_CLIENT_ID
                });
                payload = ticket.getPayload();
            } else if (access_token) {
                // Si es un access token, obtener la información del usuario desde la API de Google
                const response = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${access_token}`);
                if (!response.ok) {
                    throw new Error(`Failed to fetch user info: ${response.statusText}`);
                }
                const userInfo = await response.json();
                
                // Mapear la respuesta de la API de Google al formato esperado
                payload = {
                    sub: userInfo.id,
                    email: userInfo.email,
                    name: userInfo.name,
                    picture: userInfo.picture,
                    email_verified: userInfo.verified_email
                };
            }
        } catch (verifyError) {
            console.error('Error verificando token de Google:', verifyError.message);
            return res.status(401).json({
                success: false,
                message: 'Token de Google inválido'
            });
        }

        const { sub: googleId, email, name, picture, email_verified } = payload;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'No se pudo obtener el email de Google'
            });
        }

        // Buscar usuario existente por OAuth ID o email
        let result = await query(
            `SELECT id, username, email, display_name, avatar_url, role, status,
                    is_premium, email_verified_at, oauth_provider, oauth_id
             FROM users
             WHERE (oauth_provider = 'google' AND oauth_id = $1)
                OR email = $2
             AND deleted_at IS NULL
             LIMIT 1`,
            [googleId, email.toLowerCase()]
        );

        let user;
        let isNewUser = false;

        if (result.rows.length === 0) {
            // Crear nuevo usuario
            isNewUser = true;

            // Generar username único basado en el nombre o email
            let baseUsername = (name || email.split('@')[0])
                .toLowerCase()
                .replace(/[^a-z0-9_]/g, '')
                .substring(0, 20);

            if (baseUsername.length < 3) {
                baseUsername = 'user' + Date.now().toString(36);
            }

            let username = baseUsername;
            let suffix = 1;

            // Verificar que el username sea único
            while (true) {
                const existingUsername = await query(
                    'SELECT id FROM users WHERE username = $1',
                    [username]
                );
                if (existingUsername.rows.length === 0) break;
                username = `${baseUsername}${suffix}`;
                suffix++;
            }

            // Insertar nuevo usuario (sin password, con OAuth)
            const insertResult = await query(
                `INSERT INTO users (
                    username, email, display_name, avatar_url,
                    oauth_provider, oauth_id, email_verified_at, status
                ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), 'active')
                RETURNING id, username, email, display_name, avatar_url, role, status, is_premium, email_verified_at`,
                [username, email.toLowerCase(), name || username, picture, 'google', googleId]
            );

            user = insertResult.rows[0];

            // Registrar actividad de registro
            await query(
                `INSERT INTO activities (user_id, action, metadata)
                 VALUES ($1, 'register_google', $2)`,
                [user.id, JSON.stringify({ ip: req.ip, provider: 'google' })]
            );

        } else {
            user = result.rows[0];

            // Verificar estado del usuario
            if (user.status === 'banned') {
                return res.status(403).json({
                    success: false,
                    message: 'Tu cuenta ha sido suspendida permanentemente'
                });
            }

            if (user.status === 'suspended') {
                return res.status(403).json({
                    success: false,
                    message: 'Tu cuenta está temporalmente suspendida'
                });
            }

            // Si el usuario existe pero no tiene OAuth vinculado, actualizarlo
            if (!user.oauth_provider) {
                await query(
                    `UPDATE users SET oauth_provider = 'google', oauth_id = $1 WHERE id = $2`,
                    [googleId, user.id]
                );
            }

            // Actualizar avatar si no tiene uno
            if (!user.avatar_url && picture) {
                await query(
                    `UPDATE users SET avatar_url = $1 WHERE id = $2`,
                    [picture, user.id]
                );
                user.avatar_url = picture;
            }
        }

        // Actualizar último login
        await query(
            `UPDATE users
             SET last_login_at = NOW(),
                 last_login_ip = $1,
                 login_count = login_count + 1
             WHERE id = $2`,
            [req.ip, user.id]
        );

        // Generar tokens JWT
        const tokens = generateTokens(user.id);

        // Registrar actividad de login
        await query(
            `INSERT INTO activities (user_id, action, metadata)
             VALUES ($1, 'login_google', $2)`,
            [user.id, JSON.stringify({ ip: req.ip, userAgent: req.get('User-Agent'), provider: 'google' })]
        );

        // Obtener permisos del rol
        const permissions = getRolePermissions(user.role);

        // Establecer cookies de autenticación
        setCookieTokens(res, tokens);

        res.json({
            success: true,
            message: isNewUser ? 'Cuenta creada exitosamente con Google' : 'Inicio de sesión exitoso con Google',
            data: {
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    displayName: user.display_name,
                    avatarUrl: user.avatar_url,
                    role: user.role,
                    status: user.status,
                    isPremium: user.is_premium,
                    isVerified: !!user.email_verified_at,
                    permissions
                },
                tokens,
                isNewUser
            }
        });
    } catch (error) {
        console.error('Error en googleAuth:', error);
        next(error);
    }
};

module.exports = {
    register,
    login,
    googleAuth,
    refreshToken,
    logout,
    getCurrentUser,
    verifyEmail,
    resendVerification,
    forgotPassword,
    resetPassword,
    changePassword
};
