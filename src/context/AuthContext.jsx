import { createContext, useContext, useEffect, useState } from 'react';
import { auth, googleProvider, signInWithRedirect, firebaseSignOut } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({ id: firebaseUser.uid, email: firebaseUser.email });
        setUserProfile({ 
          name: firebaseUser.displayName, 
          photoURL: firebaseUser.photoURL 
        });
        localStorage.setItem('agroai_mock_user', JSON.stringify({
          id: firebaseUser.uid,
          email: firebaseUser.email,
          name: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL
        }));
      } else {
        // Fallback to local storage mock user if not logged into Firebase
        const storedUser = localStorage.getItem('agroai_mock_user');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          setUser({ id: parsed.id, email: parsed.email });
          setUserProfile({ name: parsed.name, photoURL: parsed.photoURL });
        } else {
          setUser(null);
          setUserProfile(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      // Using Redirect instead of Popup to bypass mobile browser popup blockers
      await signInWithRedirect(auth, googleProvider);
      // The browser will redirect away. The logic in Login.jsx and onAuthStateChanged will handle the return trip.
      return { data: { user: null } };
    } catch (error) {
      console.error("Google sign in error:", error);
      // Fallback behavior if Firebase is not properly configured
      const mockUser = { 
        id: `mock-${Date.now()}`, 
        email: 'user@example.com', 
        name: 'Demo User',
        photoURL: 'https://ui-avatars.com/api/?name=Demo+User&background=random'
      };
      localStorage.setItem('agroai_mock_user', JSON.stringify(mockUser));
      setUser({ id: mockUser.id, email: mockUser.email });
      setUserProfile({ name: mockUser.name, photoURL: mockUser.photoURL });
      return { data: { user: mockUser } };
    }
  };

  const signUp = async (email, password, name) => {
    const mockUser = { id: `mock-${Date.now()}`, email, name };
    localStorage.setItem('agroai_mock_user', JSON.stringify(mockUser));
    setUser(mockUser);
    setUserProfile({ name });
    return { data: { user: mockUser } };
  };

  const signIn = async (email, password) => {
    const name = email.split('@')[0];
    const mockUser = { id: `mock-${Date.now()}`, email, name };
    localStorage.setItem('agroai_mock_user', JSON.stringify(mockUser));
    setUser(mockUser);
    setUserProfile({ name });
    return { data: { user: mockUser } };
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (e) {
      console.error("Firebase signout error:", e);
    }
    localStorage.removeItem('agroai_mock_user');
    setUser(null);
    setUserProfile(null);
  };

  const value = {
    user,
    userProfile,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
