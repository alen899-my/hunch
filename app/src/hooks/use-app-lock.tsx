import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { constantTimeEqual, generateSalt, hashPinWithSalt } from '@/utils/crypto';

const STORAGE_PIN_KEY = '@hunch_app_lock_pin_v1';
const STORAGE_REMINDERS_KEY = '@hunch_reminders_v1';
const MAX_PIN_ATTEMPTS = 5;
const LOCKOUT_MS = 30000;

interface StoredPinRecord {
  salt: string;
  hash: string;
}

export interface ReminderSettings {
  morningEnabled: boolean;
  eveningEnabled: boolean;
  morningTime: string;
  eveningTime: string;
}

const DEFAULT_REMINDERS: ReminderSettings = {
  morningEnabled: false,
  eveningEnabled: false,
  morningTime: '08:30',
  eveningTime: '21:00',
};

interface AppLockContextType {
  pinEnabled: boolean;
  isLocked: boolean;
  lockoutSeconds: number;
  reminders: ReminderSettings;
  unlockWithPin: (pin: string) => boolean;
  setAppPin: (pin: string) => Promise<void>;
  removeAppPin: () => Promise<void>;
  updateReminders: (next: Partial<ReminderSettings>) => Promise<void>;
}

const AppLockContext = createContext<AppLockContextType>({
  pinEnabled: false,
  isLocked: false,
  lockoutSeconds: 0,
  reminders: DEFAULT_REMINDERS,
  unlockWithPin: () => true,
  setAppPin: async () => {},
  removeAppPin: async () => {},
  updateReminders: async () => {},
});

export function AppLockProvider({ children }: { children: ReactNode }) {
  const [pinRecord, setPinRecord] = useState<StoredPinRecord | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number>(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [reminders, setReminders] = useState<ReminderSettings>(DEFAULT_REMINDERS);

  useEffect(() => {
    (async () => {
      try {
        const [pinVal, remVal] = await Promise.all([
          AsyncStorage.getItem(STORAGE_PIN_KEY),
          AsyncStorage.getItem(STORAGE_REMINDERS_KEY),
        ]);
        if (pinVal) {
          // Transparently migrate legacy plaintext 4-digit PINs to salted hash
          if (/^\d{4}$/.test(pinVal)) {
            const salt = generateSalt();
            const migrated: StoredPinRecord = {
              salt,
              hash: hashPinWithSalt(pinVal, salt),
            };
            setPinRecord(migrated);
            setIsLocked(true);
            AsyncStorage.setItem(STORAGE_PIN_KEY, JSON.stringify(migrated)).catch(() => {});
          } else {
            try {
              const parsed = JSON.parse(pinVal) as StoredPinRecord;
              if (parsed?.salt && parsed?.hash) {
                setPinRecord(parsed);
                setIsLocked(true);
              }
            } catch {
              // ignore corrupted value
            }
          }
        }
        if (remVal) {
          setReminders({ ...DEFAULT_REMINDERS, ...JSON.parse(remVal) });
        }
      } catch {
        // ignore storage errors
      }
    })();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if ((nextState === 'background' || nextState === 'inactive') && pinRecord) {
        setIsLocked(true);
      }
    });
    return () => sub.remove();
  }, [pinRecord]);

  useEffect(() => {
    if (lockoutUntil <= Date.now()) {
      setLockoutSeconds(0);
      return;
    }
    const updateTick = () => {
      const secs = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));
      setLockoutSeconds(secs);
      if (secs === 0) {
        setLockoutUntil(0);
        setFailedAttempts(0);
      }
    };
    updateTick();
    const timer = setInterval(updateTick, 500);
    return () => clearInterval(timer);
  }, [lockoutUntil]);

  const unlockWithPin = useCallback(
    (pin: string) => {
      if (!pinRecord) {
        setIsLocked(false);
        return true;
      }
      if (lockoutUntil > Date.now()) {
        return false;
      }
      const attemptHash = hashPinWithSalt(pin, pinRecord.salt);
      if (constantTimeEqual(attemptHash, pinRecord.hash)) {
        setIsLocked(false);
        setFailedAttempts(0);
        setLockoutUntil(0);
        setLockoutSeconds(0);
        return true;
      }

      const nextFailed = failedAttempts + 1;
      setFailedAttempts(nextFailed);
      if (nextFailed >= MAX_PIN_ATTEMPTS) {
        const until = Date.now() + LOCKOUT_MS;
        setLockoutUntil(until);
        setLockoutSeconds(Math.ceil(LOCKOUT_MS / 1000));
      }
      return false;
    },
    [pinRecord, failedAttempts, lockoutUntil]
  );

  const setAppPin = useCallback(async (pin: string) => {
    const salt = generateSalt();
    const record: StoredPinRecord = {
      salt,
      hash: hashPinWithSalt(pin, salt),
    };
    setPinRecord(record);
    setFailedAttempts(0);
    setLockoutUntil(0);
    setLockoutSeconds(0);
    setIsLocked(false);
    await AsyncStorage.setItem(STORAGE_PIN_KEY, JSON.stringify(record));
  }, []);

  const removeAppPin = useCallback(async () => {
    setPinRecord(null);
    setFailedAttempts(0);
    setLockoutUntil(0);
    setLockoutSeconds(0);
    setIsLocked(false);
    await AsyncStorage.removeItem(STORAGE_PIN_KEY);
  }, []);

  const updateReminders = useCallback(
    async (next: Partial<ReminderSettings>) => {
      const merged = { ...reminders, ...next };
      setReminders(merged);
      await AsyncStorage.setItem(STORAGE_REMINDERS_KEY, JSON.stringify(merged));
    },
    [reminders]
  );

  return (
    <AppLockContext.Provider
      value={{
        pinEnabled: Boolean(pinRecord),
        isLocked,
        lockoutSeconds,
        reminders,
        unlockWithPin,
        setAppPin,
        removeAppPin,
        updateReminders,
      }}
    >
      {children}
    </AppLockContext.Provider>
  );
}

export function useAppLock() {
  return useContext(AppLockContext);
}
