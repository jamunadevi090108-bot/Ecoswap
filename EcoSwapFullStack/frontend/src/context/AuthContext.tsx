import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { api } from '../services/api';

export type Address = {
  addressLine: string;
  city: string;
  state: string;
  pinCode: string;
  country: string;
};

export type User = {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  address: Address;
  role: 'user' | 'admin';
};

type Registration = {
  name: string;
  email: string;
  phoneNumber: string;
  password: string;
  address: Address;
};

type AuthContextValue = {
  user: User | null;
  isCheckingSession: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (body: Registration) => Promise<void>;
  setUser: (user: User) => void;
  logout: () => void;
};

const Auth = createContext<AuthContextValue | null>(null);

function storedUser(): User | null {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null') as User | null;
  } catch {
    localStorage.removeItem('user');
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setCurrentUser] = useState<User | null>(storedUser);
  const [isCheckingSession, setCheckingSession] = useState(Boolean(localStorage.getItem('token')));

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      setCheckingSession(false);
      return;
    }
    let active = true;
    api.me()
      .then((data) => {
        if (!active) return;
        localStorage.setItem('user', JSON.stringify(data.user));
        setCurrentUser(data.user);
      })
      .catch(() => {
        if (!active) return;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setCurrentUser(null);
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const save = (data: { token: string; user: User }) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setCurrentUser(data.user);
  };

  const login = async (email: string, password: string) => {
    save(await api.login({ email, password }));
  };

  const register = async (body: Registration) => {
    save(await api.register(body));
  };

  const setUser = (nextUser: User) => {
    localStorage.setItem('user', JSON.stringify(nextUser));
    setCurrentUser(nextUser);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setCurrentUser(null);
  };

  const value = useMemo(
    () => ({ user, isCheckingSession, login, register, setUser, logout }),
    [user, isCheckingSession]
  );
  return <Auth.Provider value={value}>{children}</Auth.Provider>;
}

export function useAuth() {
  const context = useContext(Auth);
  if (!context) throw new Error('AuthProvider missing');
  return context;
}
