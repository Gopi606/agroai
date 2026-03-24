"use client";
import { useState, useEffect } from 'react';
import { useRouter as useNavigate, usePathname as useLocation } from 'next/navigation';
import Link from 'next/link';
import { redirect as Navigate } from 'next/navigation';
;
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
          <Link href="/" className="navbar-brand">
            <img src="/logo.png" alt="AgroAI Logo" />
            <span>AgroAI</span>
          </Link>

          <div className={`navbar-links ${menuOpen ? 'open' : ''}`}>
            <Link href="/" className={`navbar-link ${isActive('/')}`}>{t('nav_home')}</Link>
            <Link href="/about" className={`navbar-link ${isActive('/about')}`}>{t('nav_about')}</Link>
            <Link href="/features" className={`navbar-link ${isActive('/features')}`}>{t('nav_features')}</Link>
            <Link href="/how-it-works" className={`navbar-link ${isActive('/how-it-works')}`}>{t('nav_how')}</Link>
            <Link href="/contact" className={`navbar-link ${isActive('/contact')}`}>{t('nav_contact')}</Link>
            
            {user && (
              <Link href="/dashboard" className={`navbar-link ${isActive('/dashboard')}`}>{t('nav_dashboard')}</Link>
            )}

            {/* Mobile auth links */}
            <div className="mobile-auth" style={{ display: 'none' }}>
              {!user ? (
                <>
                  <Link href="/login" className="btn btn-secondary btn-sm" style={{ width: '100%', marginTop: '1rem' }}>{t('nav_login')}</Link>
                  <Link href="/signup" className="btn btn-primary btn-sm" style={{ width: '100%', marginTop: '0.5rem' }}>{t('nav_signup')}</Link>
                </>
              ) : (
                <button onClick={handleSignOut} className="btn btn-secondary btn-sm" style={{ width: '100%', marginTop: '1rem' }}>{t('nav_logout')}</button>
              )}
            </div>
          </div>

          <div className="navbar-actions">
            <div className="lang-toggle">
              <button 
                className={`lang-btn ${language === 'en' ? 'active' : ''}`}
                onClick={() => setLanguage('en')}
              >
                EN
              </button>
              <button 
                className={`lang-btn ${language === 'ta' ? 'active' : ''}`}
                onClick={() => setLanguage('ta')}
              >
                தமிழ்
              </button>
            </div>

            {!user ? (
              <>
                <Link href="/login" className="btn btn-secondary btn-sm desktop-only">{t('nav_login')}</Link>
                <Link href="/signup" className="btn btn-primary btn-sm desktop-only">{t('nav_signup')}</Link>
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
