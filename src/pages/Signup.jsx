import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export default function Signup() {
  const { t } = useLanguage();
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      await signUp(form.email, form.password, form.name);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 'var(--space-2)' }}>🌱</div>
          <h2>{t('signup_title')}</h2>
          <p className="auth-subtitle">{t('signup_subtitle')}</p>
        </div>

        {error && (
          <div style={{
            padding: 'var(--space-3) var(--space-4)',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid var(--red-400)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--red-400)',
            fontSize: 'var(--fs-sm)',
            marginBottom: 'var(--space-4)'
          }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="signup-name">{t('auth_name')}</label>
            <input
              id="signup-name"
              className="form-input"
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Rajan Kumar"
              required
              autoComplete="name"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="signup-email">{t('auth_email')}</label>
            <input
              id="signup-email"
              className="form-input"
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="farmer@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="signup-password">{t('auth_password')}</label>
            <input
              id="signup-password"
              className="form-input"
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
              autoComplete="new-password"
              minLength={6}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="signup-confirm">{t('auth_confirm')}</label>
            <input
              id="signup-confirm"
              className="form-input"
              type="password"
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              placeholder="••••••••"
              required
              autoComplete="new-password"
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary btn-lg"
            style={{ width: '100%' }}
            disabled={loading}
          >
            {loading ? '⏳ Creating account...' : `🚀 ${t('auth_signup')}`}
          </button>
        </form>

        <p className="auth-footer">
          {t('auth_has_account')}{' '}
          <Link to="/login">{t('auth_login_link')}</Link>
        </p>
      </div>
    </div>
  );
}
