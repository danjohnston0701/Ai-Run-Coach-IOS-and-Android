import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { 
  User, 
  getStoredUser, 
  fetchCurrentUser, 
  login as authLogin, 
  register as authRegister, 
  logout as authLogout 
} from '@/lib/auth';

const LOCATION_PERMISSION_KEY = "location_permission_granted";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  locationPermissionGranted: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: (fetchFromServer?: boolean) => Promise<void>;
  setLocationPermission: (granted: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    locationPermissionGranted: false,
  });

  const refreshUser = useCallback(async (fetchFromServer: boolean = false) => {
    try {
      const locationPermission = await AsyncStorage.getItem(LOCATION_PERMISSION_KEY);
      const currentUser = await getStoredUser();
      
      // If fetchFromServer is true, try to get fresh data from the API
      let user: User | null = currentUser;
      if (fetchFromServer && currentUser) {
        try {
          const freshUser = await fetchCurrentUser();
          // Only update if we got a valid user back
          if (freshUser) {
            user = freshUser;
          }
        } catch (error) {
          console.log("Failed to fetch fresh user data, keeping current user");
          // Keep the current user if fetch fails
        }
      }
      
      if (user) {
        setState({
          user,
          isLoading: false,
          isAuthenticated: true,
          locationPermissionGranted: locationPermission === "true",
        });
      } else {
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
          locationPermissionGranted: false,
        });
      }
    } catch {
      // On error, try to keep the user logged in if we have stored data
      const storedUser = await getStoredUser();
      if (storedUser) {
        setState(prev => ({
          ...prev,
          isLoading: false,
        }));
      } else {
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
          locationPermissionGranted: false,
        });
      }
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const setLocationPermission = useCallback((granted: boolean) => {
    setState(prev => ({ ...prev, locationPermissionGranted: granted }));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const { user } = await authLogin(email, password);
      console.log('[AuthContext] Login successful, setting user:', user?.email);
      setState(prev => ({
        ...prev,
        user,
        isLoading: false,
        isAuthenticated: true,
      }));
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const { user } = await authRegister(name, email, password);
      setState(prev => ({
        ...prev,
        user,
        isLoading: false,
        isAuthenticated: true,
      }));
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    await authLogout();
    setState(prev => ({
      ...prev,
      user: null,
      isLoading: false,
      isAuthenticated: false,
    }));
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, refreshUser, setLocationPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
