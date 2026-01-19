import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { Platform } from "react-native";
import { getStoredToken } from "./token-storage";

/**
 * Gets the base URL for the API
 * Uses local backend which connects to external Neon database
 * @returns {string} The API base URL
 */
export function getApiUrl(): string {
  // For web platform in development, use the Replit dev domain
  if (Platform.OS === 'web') {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    if (domain) {
      // Remove port suffix if present and use https
      const cleanDomain = domain.replace(':5000', '').replace(':8081', '');
      return `https://${cleanDomain}`;
    }
    if (typeof window !== 'undefined' && window.location) {
      // Use same origin for web
      return window.location.origin;
    }
  }
  
  // For native mobile apps, use the Replit dev domain backend
  // This will be the same domain that serves the app
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) {
    const cleanDomain = domain.replace(':5000', '').replace(':8081', '');
    return `https://${cleanDomain}`;
  }
  
  // Fallback to localhost for development
  return 'http://localhost:5000';
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown | undefined,
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = new URL(route, baseUrl);
  const headers = await getAuthHeaders();

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const baseUrl = getApiUrl();
    const path = queryKey.join("/");
    const url = new URL(path, baseUrl);
    const headers = await getAuthHeaders();

    const res = await fetch(url.toString(), {
      headers,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
