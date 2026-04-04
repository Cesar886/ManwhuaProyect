'use client';

import React, { useState, useRef, useEffect } from 'react';
import { TextInput, PasswordInput, Button } from '@mantine/core';
import { IconAt, IconLock, IconUser, IconX, IconCheck, IconAlertCircle, IconLoader2 } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { api, register } from '@/lib/api/client';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import styles from './register.module.css';

// Validación ligera del username (paralela a backend)
const validateUsername = (username) => {
  const errors = [];
  if (!username || typeof username !== 'string') {
    return { valid: false, errors: ['El nombre de usuario es requerido'] };
  }

  const trimmed = username.trim();
  if (trimmed.length < 3) errors.push('Mínimo 3 caracteres');
  if (trimmed.length > 15) errors.push('Máximo 15 caracteres');
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) errors.push('Solo letras, números y guion bajo (_); sin espacios');
  if (!/^[a-zA-Z]/.test(trimmed)) errors.push('Debe comenzar con una letra');
  if (trimmed.endsWith('_')) errors.push('No puede terminar con guion bajo');
  if (/__/.test(trimmed)) errors.push('No puede tener múltiples guiones bajos seguidos');
  if (/^\d+$/.test(trimmed)) errors.push('No puede ser solo números');

  return { valid: errors.length === 0, errors, original: trimmed };
};

const requirements = [
  { re: /[a-z]/, label: 'Una letra minúscula' },
  { re: /[A-Z]/, label: 'Una letra mayúscula' },
  { re: /[0-9]/, label: 'Un número' },
];

function getStrength(password) {
  let multiplier = password.length >= 8 ? 0 : 1;
  requirements.forEach((requirement) => {
    if (!requirement.re.test(password)) {
      multiplier += 1;
    }
  });
  return Math.max(100 - (100 / (requirements.length + 1)) * multiplier, 10);
}

// Estilos de input reutilizables
const inputStyles = {
  root: {
    '--input-bd-focus': 'var(--imperial-gold)',
  },
  input: {
    backgroundColor: 'var(--input-bg)',
    borderColor: 'var(--border-medium)',
    color: 'var(--text-primary)',
    borderRadius: '10px',
    height: '46px',
    fontSize: '0.95rem',
    '&::placeholder': {
      color: 'var(--text-muted)',
    },
  },
  label: {
    color: 'var(--text-secondary)',
    fontWeight: 500,
    fontSize: '0.85rem',
    marginBottom: '6px',
  },
  section: {
    color: 'var(--text-muted)',
  },
};

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [usernameError, setUsernameError] = useState(null);
  const [usernameTouched, setUsernameTouched] = useState(false);
  const typingTimer = useRef(null);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { openLogin } = useAuth();
  const [showStrength, setShowStrength] = useState(false);
  const router = useRouter();

  const requirementsMet = password.length >= 8 && requirements.every((r) => r.re.test(password));
  const strength = getStrength(password);

  useEffect(() => {
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const usernameValidation = validateUsername(name || '');
    if (!usernameValidation.valid) {
      setUsernameError(usernameValidation.errors.join(' · '));
      return;
    }

    if (usernameAvailable !== true) {
      setError('El nombre de usuario no está disponible o no fue verificado');
      return;
    }

    setUsernameError(null);

    if (password !== confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);
    try {
      const payload = { username: (name || '').trim(), email, password, displayName: name };
      await register(payload);
      openLogin();
    } catch (err) {
      let serverMsg = null;
      try {
        const body = err && err.body;
        if (body) {
          if (Array.isArray(body.errors)) {
            serverMsg = body.errors.map(e => `${e.field || 'error'}: ${e.message || JSON.stringify(e)}`).join(' · ')
          } else if (body.errors && typeof body.errors === 'object') {
            serverMsg = Object.entries(body.errors)
              .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
              .join(' · ');
          } else if (body.message || body.error) {
            serverMsg = body.message || body.error;
          } else {
            serverMsg = JSON.stringify(body);
          }
        }
      } catch {
        // noop
      }
      setError(serverMsg || err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleUsernameChange = (e) => {
    const v = e.currentTarget.value;
    setName(v);
    setUsernameTouched(false);
    setUsernameError(null);
    setUsernameAvailable(null);

    if (typingTimer.current) clearTimeout(typingTimer.current);

    typingTimer.current = setTimeout(() => {
      (async (val) => {
        if (!val) return;
        setUsernameChecking(true);
        try {
          const valRes = await api.get('users', `validate-username?username=${encodeURIComponent(val)}`);
          const validation = valRes && valRes.data ? valRes.data : null;
          if (!validation) {
            setUsernameError('Error de validación');
            setUsernameAvailable(false);
            return;
          }
          if (!validation.valid) {
            setUsernameError(validation.errors.join(' · '));
            setUsernameAvailable(false);
            return;
          }
          setUsernameError(null);
          const chkRes = await api.get('users', `check-username?username=${encodeURIComponent(val)}`);
          const available = chkRes && chkRes.data ? !!chkRes.data.available : false;
          setUsernameAvailable(available);
        } catch (err) {
          setUsernameError('No se pudo validar el nombre de usuario');
          setUsernameAvailable(false);
        } finally {
          setUsernameChecking(false);
          setUsernameTouched(true);
        }
      })(v);
    }, 600);
  };

  const handleUsernameBlur = () => {
    setUsernameTouched(true);
    if (typingTimer.current) {
      clearTimeout(typingTimer.current);
      typingTimer.current = null;
    }

    (async () => {
      const v = (name || '').trim();
      if (!v) return;
      setUsernameChecking(true);
      setUsernameError(null);
      setUsernameAvailable(null);
      try {
        const valRes = await api.get('users', `validate-username?username=${encodeURIComponent(v)}`);
        const validation = valRes && valRes.data ? valRes.data : null;
        if (!validation) {
          setUsernameError('Error de validación');
          setUsernameAvailable(false);
          return;
        }
        if (!validation.valid) {
          setUsernameError(validation.errors.join(' · '));
          setUsernameAvailable(false);
          return;
        }
        const chkRes = await api.get('users', `check-username?username=${encodeURIComponent(v)}`);
        const available = chkRes && chkRes.data ? !!chkRes.data.available : false;
        setUsernameAvailable(available);
      } catch (err) {
        setUsernameError('No se pudo validar el nombre de usuario');
        setUsernameAvailable(false);
      } finally {
        setUsernameChecking(false);
      }
    })();
  };

  return (
    <div className={styles.pageWrapper}>
      <Header />

      <div className={styles.contentWrapper}>
        <div className={styles.card}>
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.avatarWrapper}>
              <div className={styles.avatar}>M</div>
            </div>
            <h1 className={styles.title}>Crear cuenta</h1>
            <p className={styles.subtitle}>Únete a la comunidad de Manhwa Imperial</p>
          </div>

          <div className={styles.divider} />

          {/* Formulario */}
          <form onSubmit={handleSubmit} className={styles.form}>
            {/* Username */}
            <div className={styles.inputWrapper}>
              <TextInput
                label="Nombre de usuario"
                leftSection={<IconUser size={18} />}
                placeholder="Tu nombre de usuario"
                value={name}
                onChange={handleUsernameChange}
                onBlur={handleUsernameBlur}
                required
                styles={inputStyles}
              />
              {usernameTouched && (
                usernameChecking ? (
                  <div className={`${styles.validationMessage} ${styles.checking}`}>
                    <IconLoader2 size={14} className="animate-spin" />
                    <span>Verificando disponibilidad...</span>
                  </div>
                ) : usernameError ? (
                  <div className={`${styles.validationMessage} ${styles.error}`}>
                    <IconX size={14} />
                    <span>{usernameError}</span>
                  </div>
                ) : usernameAvailable === false ? (
                  <div className={`${styles.validationMessage} ${styles.error}`}>
                    <IconX size={14} />
                    <span>Nombre de usuario no disponible</span>
                  </div>
                ) : usernameAvailable === true ? (
                  <div className={`${styles.validationMessage} ${styles.success}`}>
                    <IconCheck size={14} />
                    <span>Nombre de usuario disponible</span>
                  </div>
                ) : null
              )}
            </div>

            {/* Email */}
            <TextInput
              label="Correo electrónico"
              leftSection={<IconAt size={18} />}
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              required
              styles={inputStyles}
            />

            {/* Password */}
            <div className={styles.inputWrapper}>
              <PasswordInput
                label="Contraseña"
                leftSection={<IconLock size={18} />}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                onFocus={() => setShowStrength(true)}
                onBlur={() => setShowStrength(false)}
                required
                styles={inputStyles}
              />
              {(showStrength || password.length > 0) && (
                <div className={styles.strengthWrapper}>
                  <div className={styles.strengthBar}>
                    <div
                      className={`${styles.strengthFill} ${strength === 100 ? styles.strong : strength > 50 ? styles.medium : styles.weak}`}
                      style={{ width: `${strength}%` }}
                    />
                  </div>
                  <div className={`${styles.requirement} ${password.length >= 8 ? styles.met : styles.unmet}`}>
                    {password.length >= 8 ? <IconCheck size={12} /> : <IconX size={12} />}
                    <span>Mínimo 8 caracteres</span>
                  </div>
                  {requirements.map((req, idx) => (
                    <div key={idx} className={`${styles.requirement} ${req.re.test(password) ? styles.met : styles.unmet}`}>
                      {req.re.test(password) ? <IconCheck size={12} /> : <IconX size={12} />}
                      <span>{req.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <PasswordInput
              label="Confirmar contraseña"
              leftSection={<IconLock size={18} />}
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.currentTarget.value)}
              required
              styles={inputStyles}
              error={confirm && password !== confirm ? 'Las contraseñas no coinciden' : null}
            />

            {/* Error general */}
            {error && (
              <div className={styles.errorBox}>
                <IconAlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              loading={loading}
              disabled={loading || !!usernameError || !requirementsMet || usernameAvailable !== true}
              fullWidth
              className={styles.submitBtn}
            >
              Crear cuenta
            </Button>

            {/* Footer */}
            <div className={styles.footer}>
              <span className={styles.footerText}>¿Ya tienes cuenta?</span>
              <Button
                variant="subtle"
                size="sm"
                className={styles.linkBtn}
                onClick={() => openLogin()}
              >
                Iniciar sesión
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
