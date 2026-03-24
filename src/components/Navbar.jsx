import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const isActive = (path) => location.pathname === path ? 'active' : '';

  return (
    <>
      <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
        <div className="navbar-inner">
          <Link to="/" className="navbar-brand">
            <img src="/logo.png" alt="AgroAI Logo" />
            <span>AgroAI</span>
          </Link>

          <div className={`navbar-links ${menuOpen ? 'open' : ''}`}>
            <Link to="/" className={`navbar-link ${isActive('/')}`}>{t('nav_home')}</Link>
            <Link to="/about" className={`navbar-link ${isActive('/about')}`}>{t('nav_about')}</Link>
            <Link to="/features" className={`navbar-link ${isActive('/features')}`}>{t('nav_features')}</Link>
            <Link to="/how-it-works" className={`navbar-link ${isActive('/how-it-works')}`}>{t('nav_how')}</Link>
            <Link to="/contact" className={`navbar-link ${isActive('/contact')}`}>{t('nav_contact')}</Link>
            
            {user && (
              <Link to="/dashboard" className={`navbar-link ${isActive('/dashboard')}`}>{t('nav_dashboard')}</Link>
            )}

            {/* Mobile auth links */}
            <div className="mobile-auth" style={{ display: 'none' }}>
              {!user ? (
                <>
                  <Link to="/login" className="btn btn-secondary btn-sm" style={{ width: '100%', marginTop: '1rem' }}>{t('nav_login')}</Link>
                  <Link to="/signup" className="btn btn-primary btn-sm" style={{ width: '100%', marginTop: '0.5rem' }}>{t('nav_signup')}</Link>
                </>
              ) : (
                <button onClick={handleSignOut} className="btn btn-secondary btn-sm" style={{ width: '100%', marginTop: '1rem' }}>{t('nav_logout')}</button>
              )}
            </div>
          </div>

          <div className="navbar-actions">
            <div className="lang-toggle" style={{ display: 'flex', alignItems: 'center' }}>
              <select 
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                style={{
                  background: 'rgba(0,0,0,0.5)',
                  color: 'var(--green-400)',
                  border: '1px solid var(--green-600)',
                  borderRadius: 'var(--radius-full)',
                  padding: '5px 10px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  outline: 'none',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  paddingRight: '20px',
                  backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2310b981%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 8px top 50%',
                  backgroundSize: '8px auto'
                }}
              >
                <option value="en">English</option>
                <option value="ta">தமிழ்</option>
                <option value="hi">हिंदी</option>
                <option value="te">తెలుగు</option>
                <option value="kn">ಕನ್ನಡ</option>
                <option value="ml">മലയാളം</option>
              </select>
            </div>

            {!user ? (
              <>
                <Link to="/login" className="btn btn-secondary btn-sm desktop-only">{t('nav_login')}</Link>
                <Link to="/signup" className="btn btn-primary btn-sm desktop-only">{t('nav_signup')}</Link>
              </>
            ) : (
              <button onClick={handleSignOut} className="btn btn-secondary btn-sm desktop-only">{t('nav_logout')}</button>
            )}

            <button 
              className={`hamburger ${menuOpen ? 'open' : ''}`}
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
          </div>
        </div>
      </nav>

      {menuOpen && <div className="mobile-overlay" onClick={() => setMenuOpen(false)} />}
      
      <style>{`
        .desktop-only {
          display: inline-flex;
        }
        @media (max-width: 768px) {
          .desktop-only { display: none !important; }
          .mobile-auth { display: block !important; }
        }
      `}</style>
    </>
  );
}
