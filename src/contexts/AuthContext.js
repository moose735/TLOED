import React, { createContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('tloed_authenticated');
    if (stored === 'true') {
      setIsAuthenticated(true);
    }
    setMounted(true);
  }, []);

  const logout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('tloed_authenticated');
  };

  if (!mounted) {
    return null;
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return React.useContext(AuthContext);
}
