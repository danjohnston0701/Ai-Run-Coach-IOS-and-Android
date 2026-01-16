import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { getApiUrl } from './query-client';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'user_data';

export interface User {
  id: string;
  userCode?: string;
  email: string;
  name: string;
  dob?: string;
  gender?: string;
  height?: string;
  weight?: string;
  fitnessLevel?: string;
  desiredFitnessLevel?: string;
  coachName?: string;
  coachGender?: string;
  coachAccent?: string;
  coachTone?: string;
  profilePic?: string;
  distanceMinKm?: number;
  distanceMaxKm?: number;
  distanceDecimalsEnabled?: boolean;
  isAdmin?: boolean;
  subscriptionTier?: string;
  subscriptionStatus?: string;
  entitlementType?: string;
  entitlementExpiresAt?: string;
  createdAt?: string;
  locationPermissionGranted?: boolean;
}

// Storage wrapper that works on both web and native
async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  } else {
    return await SecureStore.getItemAsync(key);
  }
}

async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

export async function getStoredToken(): Promise<string | null> {
  return await getItem(TOKEN_KEY);
}

export async function setStoredToken(token: string): Promise<void> {
  await setItem(TOKEN_KEY, token);
}

export async function clearStoredToken(): Promise<void> {
  await deleteItem(TOKEN_KEY);
}

export async function getStoredUser(): Promise<User | null> {
  const userData = await getItem(USER_KEY);
  if (userData) {
    try {
      return JSON.parse(userData);
    } catch {
      return null;
    }
  }
  return null;
}

export async function setStoredUser(user: User): Promise<void> {
  await setItem(USER_KEY, JSON.stringify(user));
}

export async function clearStoredUser(): Promise<void> {
  await deleteItem(USER_KEY);
}

export async function login(email: string, password: string): Promise<{ user: User; token?: string }> {
  const baseUrl = getApiUrl();
  const url = `${baseUrl}/api/auth/login`;
  
  console.log('[Auth] Attempting login to:', url);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
      credentials: 'include',
    });

    console.log('[Auth] Login response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('[Auth] Login error:', errorText);
      
      // Try to parse as JSON to get error message
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.error || errorJson.message || 'Login failed');
      } catch {
        throw new Error(errorText || 'Login failed');
      }
    }

    const data = await response.json();
    console.log('[Auth] Login successful, full response:', JSON.stringify(data));
    
    // Handle different response formats from backend
    // Some backends return { user, token }, others return the user directly
    const user = data.user || data;
    const token = data.token || data.accessToken || data.jwt;
    
    console.log('[Auth] Extracted user:', JSON.stringify(user));
    console.log('[Auth] Extracted token:', token ? 'present' : 'none');
    
    if (user && (user.id || user.email)) {
      await setStoredUser(user);
    }
    
    if (token) {
      await setStoredToken(token);
    }

    return { user, token };
  } catch (error: any) {
    console.log('[Auth] Login exception:', error.message);
    throw error;
  }
}

export async function register(name: string, email: string, password: string): Promise<{ user: User; token?: string }> {
  const baseUrl = getApiUrl();
  
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, email, password }),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Registration failed');
  }

  const data = await response.json();
  
  if (data.user) {
    await setStoredUser(data.user);
  }
  
  if (data.token) {
    await setStoredToken(data.token);
  }

  return data;
}

export async function logout(): Promise<void> {
  const baseUrl = getApiUrl();
  
  try {
    await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    // Ignore logout errors
  }
  
  await clearStoredToken();
  await clearStoredUser();
}

export async function fetchCurrentUser(): Promise<User | null> {
  const baseUrl = getApiUrl();
  
  try {
    const response = await fetch(`${baseUrl}/api/user`, {
      credentials: 'include',
    });

    if (!response.ok) {
      if (response.status === 401) {
        await clearStoredToken();
        await clearStoredUser();
        return null;
      }
      throw new Error('Failed to fetch user');
    }

    const user = await response.json();
    await setStoredUser(user);
    return user;
  } catch {
    return null;
  }
}
