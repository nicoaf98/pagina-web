import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (trimmedEmail.length === 0 || password.length === 0) {
      setError('Email y contraseña son obligatorios.');
      return;
    }

    setSubmitting(true);
    try {
      await login(trimmedEmail, password);
    } catch (err: unknown) {
      let message = 'Error al iniciar sesión.';
      if (err instanceof ApiError) {
        message = err.message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login">
      <div className="login__card">
        <h1 className="login__title">Iniciar sesión</h1>

        <form className="login__form" onSubmit={handleSubmit} noValidate>
          <label className="login__field">
            <span className="login__label">Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              required
            />
          </label>

          <label className="login__field">
            <span className="login__label">Contraseña</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              required
            />
          </label>

          {error && (
            <div className="login__error" role="alert">
              {error}
            </div>
          )}

          <button type="submit" className="login__submit" disabled={submitting}>
            {submitting ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>

        <div className="login__hint">
          <strong>Usuario de prueba</strong>
          <br />
          admin@test.com / Admin123!
        </div>
      </div>
    </div>
  );
}
