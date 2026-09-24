'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { api } from '../lib/api';

export interface AuthUser {
  id: string;
  email: string;
  role: 'ADMIN' | 'CUSTOMER';
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => void;
  quickLogin: (role: 'ADMIN' | 'CUSTOMER') => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  login: async () => {},
  logout: () => {},
  quickLogin: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const login = useCallback(async (email: string, pass: string) => {
    const res = await api.login(email, pass);
    setToken(res.access_token);
    setUser(res.user);
    localStorage.setItem('mandai_auth_token', res.access_token);
    localStorage.setItem('mandai_auth_user', JSON.stringify(res.user));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('mandai_auth_token');
    localStorage.removeItem('mandai_auth_user');
  }, []);

  const quickLogin = useCallback(
    async (role: 'ADMIN' | 'CUSTOMER') => {
      if (role === 'ADMIN') {
        await login('admin@example.com', 'AdminPass123!');
      } else {
        await login('customer@example.com', 'CustomerPass123!');
      }
    },
    [login],
  );

  useEffect(() => {
    // Restore session from localStorage on mount
    const savedToken = localStorage.getItem('mandai_auth_token');
    const savedUser = localStorage.getItem('mandai_auth_user');
    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('mandai_auth_token');
        localStorage.removeItem('mandai_auth_user');
      }
    } else {
      // Default to auto-login as admin for effortless back-office testing
      quickLogin('ADMIN').catch(() => {});
    }
    setIsLoading(false);
  }, [quickLogin]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
        quickLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
