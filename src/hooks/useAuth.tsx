import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  AuthResult,
  ClientAuthUser,
  fetchSession,
  loginWithEmail,
  logoutSession,
  registerWithEmail,
} from '@/src/services/authService';

interface AuthContextValue {
  user: ClientAuthUser | null;
  loading: boolean;
  sessionExpiredNotice: boolean;
  clearExpiredNotice: () => void;
  login: (email: string, password: string, rememberMe: boolean) => Promise<AuthResult<ClientAuthUser>>;
  register: (
    email: string,
    password: string,
    confirmPassword: string,
    rememberMe?: boolean
  ) => Promise<AuthResult<ClientAuthUser>>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<ClientAuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState<boolean>(false);

  const refreshSession = useCallback(async () => {
    const res = await fetchSession();
    setUser(res.authenticated ? res.user : null);
    if (res.expired) {
      setSessionExpiredNotice(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const login = useCallback(async (email: string, password: string, rememberMe: boolean) => {
    const res = await loginWithEmail(email, password, rememberMe);
    if (res.ok) {
      setUser(res.data);
      setSessionExpiredNotice(false);
    }
    return res;
  }, []);

  const register = useCallback(
    async (
      email: string,
      password: string,
      confirmPassword: string,
      rememberMe = true
    ) => {
      const res = await registerWithEmail(email, password, confirmPassword, rememberMe);
      if (res.ok) {
        setUser(res.data);
        setSessionExpiredNotice(false);
      }
      return res;
    },
    []
  );

  const logout = useCallback(async () => {
    await logoutSession();
    setUser(null);
    setSessionExpiredNotice(false);
  }, []);

  const clearExpiredNotice = useCallback(() => {
    setSessionExpiredNotice(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        sessionExpiredNotice,
        clearExpiredNotice,
        login,
        register,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
