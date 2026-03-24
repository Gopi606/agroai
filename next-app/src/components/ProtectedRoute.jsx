"use client";
import { redirect as Navigate } from 'next/navigation';
;
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="spinner-overlay" style={{ minHeight: '100vh' }}>
        <div className="spinner"></div>
        <p className="spinner-text">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
