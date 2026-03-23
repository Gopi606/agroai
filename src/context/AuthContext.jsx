import { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check local storage for persistent mock session instead of Supabase
    const storedUser = localStorage.getItem('agroai_mock_user');
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      setUser(parsed);
      setUserProfile({ name: parsed.name });
    }
    setLoading(false);
  }, []);

  // Bypass sign-up validations
  const signUp = async (email, password, name) => {
    // Generate a mock user
    const mockUser = { id: `mock-${Date.now()}`, email, name };
    localStorage.setItem('agroai_mock_user', JSON.stringify(mockUser));
    
    // Set state
    setUser(mockUser);
    setUserProfile({ name });
    
    return { data: { user: mockUser } };
  };

  // Bypass sign-in validations (accepts any email/password)
  const signIn = async (email, password) => {
    // Just extract login name from email for display
    const name = email.split('@')[0];
    const mockUser = { id: `mock-${Date.now()}`, email, name };
    
    localStorage.setItem('agroai_mock_user', JSON.stringify(mockUser));
    
    // Set state
    setUser(mockUser);
    setUserProfile({ name });
    
    return { data: { user: mockUser } };
  };

  // Sign out removes mock session
  const signOut = async () => {
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
    signOut,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
