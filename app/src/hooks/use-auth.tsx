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
import { registerUnauthorizedHandler, setGlobalToken } from '../services/api';
import { uploadToR2 } from '../services/upload.service';
import type { User } from '../services/auth.service';

const STORAGE_KEY_TOKEN = '@hunch_auth_token';
const STORAGE_KEY_USER = '@hunch_auth_user';
const SENSITIVE_CACHE_PREFIXES = [
  '@hunch_days_cache_v1_',
  '@hunch_stream_cache_v1_',
  '@hunch_stats_cache_v1_',
  '@hunch_tags_cache_v1_',
  '@hunch_offline_queue_v1_',
  '@hunch_latest_mood_v1_',
  '@hunch_people_cache_v1_',
  '@hunch_person_detail_v1_',
];

async function clearSensitiveLocalCaches() {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const toRemove = allKeys.filter(
      (k) =>
        k === STORAGE_KEY_TOKEN ||
        k === STORAGE_KEY_USER ||
        SENSITIVE_CACHE_PREFIXES.some((prefix) => k.startsWith(prefix))
    );
    if (toRemove.length > 0) {
      await AsyncStorage.multiRemove(toRemove);
    }
  } catch {
    await AsyncStorage.multiRemove([STORAGE_KEY_TOKEN, STORAGE_KEY_USER]).catch(() => {});
  }
}

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
  updateProfile: (data: {
    name?: string;
    phone?: string | null;
    localAvatar?: { uri: string; mimeType: string } | null;
    avatarRemoved?: boolean;
  }) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
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
  updateProfile: async () => {},
  changePassword: async () => {},
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
                clearSensitiveLocalCaches();
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

  // Update user profile (optimistic name/phone/avatar + background R2 upload)
  const updateProfile = useCallback(
    async (data: {
      name?: string;
      phone?: string | null;
      localAvatar?: { uri: string; mimeType: string } | null;
      avatarRemoved?: boolean;
    }) => {
      if (!user) return;
      const previousUser = user;
      const normalizedPhone =
        data.phone === undefined
          ? undefined
          : typeof data.phone === 'string'
          ? data.phone.trim() || null
          : null;

      const optimisticUser: User = {
        ...user,
        ...(data.name?.trim() ? { name: data.name.trim() } : {}),
        ...(normalizedPhone !== undefined
          ? { phone: normalizedPhone ?? undefined }
          : {}),
        ...(data.avatarRemoved
          ? { avatar: undefined }
          : data.localAvatar?.uri
          ? { avatar: data.localAvatar.uri }
          : {}),
      };

      setUser(optimisticUser);
      AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(optimisticUser)).catch(() => {});

      try {
        let avatarUrl: string | null | undefined = undefined;
        if (data.avatarRemoved) {
          avatarUrl = null;
        } else if (data.localAvatar) {
          const uploaded = await uploadToR2(data.localAvatar.uri, data.localAvatar.mimeType);
          avatarUrl = uploaded.publicUrl;
        }

        const res = await authService.updateMe(
          {
            ...(data.name?.trim() ? { name: data.name.trim() } : {}),
            ...(normalizedPhone !== undefined ? { phone: normalizedPhone } : {}),
            ...(avatarUrl !== undefined ? { avatar: avatarUrl } : {}),
          },
          token
        );

        if (res.success && res.data?.user) {
          setUser(res.data.user);
          AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(res.data.user)).catch(() => {});
        }
      } catch (err) {
        setUser(previousUser);
        AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(previousUser)).catch(() => {});
        throw err;
      }
    },
    [user, token]
  );

  // Change password (old -> new) & rotate stored JWT session token
  const changePassword = useCallback(
    async (oldPassword: string, newPassword: string) => {
      const res = await authService.changePassword({ oldPassword, newPassword }, token);
      if (!res.success) {
        throw new Error(res.message || 'Could not update password');
      }
      if (res.data?.token) {
        const rotated = res.data.token;
        setToken(rotated);
        setGlobalToken(rotated);
        await AsyncStorage.setItem(STORAGE_KEY_TOKEN, rotated);
      }
    },
    [token]
  );

  // Logout: clears token, user state, and all private journal/people caches
  const logout = useCallback(async () => {
    setToken(null);
    setUser(null);
    setGlobalToken(null);
    try {
      await clearSensitiveLocalCaches();
    } catch (err) {
      console.warn('Failed to clear auth storage:', err);
    }
  }, []);

  useEffect(() => {
    registerUnauthorizedHandler(() => {
      logout();
    });
    return () => registerUnauthorizedHandler(null);
  }, [logout]);

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
        updateProfile,
        changePassword,
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
