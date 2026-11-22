import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as authService from '../services/auth.service';
import { setGlobalToken } from '../services/api';
import type { User } from '../services/auth.service';

const STORAGE_KEY_TOKEN = '@hunch_auth_token';
const STORAGE_KEY_USER = '@hunch_auth_user';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  loading: boolean;
  error: string | null;
  register: (
    data: { name: string; email?: string; phone?: string; password: string },
    autoLogin?: boolean
  ) => Promise<{ success: boolean; data?: any; message?: string }>;
  login: (data: {
    email?: string;
    phone?: string;
    password: string;
  }) => Promise<{ success: boolean; data?: any; message?: string }>;
  googleSignIn: (
    idToken: string
  ) => Promise<{ success: boolean; data?: any; message?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isAuthenticated: false,
  isInitialized: false,
  loading: false,
  error: null,
  register: async () => ({ success: false }),
  login: async () => ({ success: false }),
  googleSignIn: async () => ({ success: false }),
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore saved session on app launch
  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      try {
        const [savedToken, savedUserJson] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_TOKEN),
          AsyncStorage.getItem(STORAGE_KEY_USER),
        ]);

        if (savedToken && isMounted) {
          setToken(savedToken);
          setGlobalToken(savedToken);

          if (savedUserJson) {
            try {
              setUser(JSON.parse(savedUserJson));
            } catch {
              // ignore json parse error
            }
          }

          // In background, verify token validity with /auth/me
          authService
            .getMe(savedToken)
            .then((res) => {
              if (!isMounted) return;
              if (res.success && res.data?.user) {
                setUser(res.data.user);
                AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(res.data.user));
              } else if (!res.success) {
                // Token expired or invalid
                setToken(null);
                setUser(null);
                setGlobalToken(null);
                AsyncStorage.multiRemove([STORAGE_KEY_TOKEN, STORAGE_KEY_USER]);
              }
            })
            .catch(() => {
              // Network/offline error — keep restored token for offline usage
            });
        }
      } catch (err) {
        console.warn('Failed to restore auth session from storage:', err);
      } finally {
        if (isMounted) {
          setIsInitialized(true);
        }
      }
    };

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  // Register: creates user on backend without auto-login by default (so flow moves to login)
  const register = useCallback(
    async (
      data: { name: string; email?: string; phone?: string; password: string },
      autoLogin = false
    ) => {
      setLoading(true);
      setError(null);
      try {
        const res = await authService.register(data);
        if (res.success && res.data) {
          if (autoLogin) {
            const { token: newToken, user: newUser } = res.data;
            setToken(newToken);
            setUser(newUser);
            setGlobalToken(newToken);
            await Promise.all([
              AsyncStorage.setItem(STORAGE_KEY_TOKEN, newToken),
              AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newUser)),
            ]);
          }
        } else {
          setError(res.message || 'Registration failed');
        }
        return res;
      } catch (err: any) {
        const msg = err?.message || 'Registration failed';
        setError(msg);
        return { success: false, message: msg };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Login: saves token and user to persistent AsyncStorage
  const login = useCallback(
    async (data: { email?: string; phone?: string; password: string }) => {
      setLoading(true);
      setError(null);
      try {
        const res = await authService.login(data);
        if (res.success && res.data) {
          const { token: newToken, user: newUser } = res.data;
          setToken(newToken);
          setUser(newUser);
          setGlobalToken(newToken);
          await Promise.all([
            AsyncStorage.setItem(STORAGE_KEY_TOKEN, newToken),
            AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newUser)),
          ]);
        } else {
          setError(res.message || 'Login failed');
        }
        return res;
      } catch (err: any) {
        const msg = err?.message || 'Login failed';
        setError(msg);
        return { success: false, message: msg };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Google Sign-In
  const googleSignIn = useCallback(async (idToken: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await authService.googleSignIn(idToken);
      if (res.success && res.data) {
        const { token: newToken, user: newUser } = res.data;
        setToken(newToken);
        setUser(newUser);
        setGlobalToken(newToken);
        await Promise.all([
          AsyncStorage.setItem(STORAGE_KEY_TOKEN, newToken),
          AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newUser)),
        ]);
      } else {
        setError(res.message || 'Google sign-in failed');
      }
      return res;
    } catch (err: any) {
      const msg = err?.message || 'Google sign-in failed';
      setError(msg);
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  }, []);

  // Logout: clears storage and in-memory state
  const logout = useCallback(async () => {
    setToken(null);
    setUser(null);
    setGlobalToken(null);
    try {
      await AsyncStorage.multiRemove([STORAGE_KEY_TOKEN, STORAGE_KEY_USER]);
    } catch (err) {
      console.warn('Failed to clear auth storage:', err);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(token),
        isInitialized,
        loading,
        error,
        register,
        login,
        googleSignIn,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
