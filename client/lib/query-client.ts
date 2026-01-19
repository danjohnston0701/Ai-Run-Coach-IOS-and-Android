import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { Platform } from "react-native";
import { getStoredToken } from "./token-storage";

/**
 * Gets the base URL for the API
 * Uses local backend which connects to external Neon database
 * Backend runs on port 5000, accessible via Replit's port forwarding
 * @returns {string} The API base URL
 */
export function getApiUrl(): string {
  // Check if we have the Replit dev domain configured
  // EXPO_PUBLIC_DOMAIN is set to REPLIT_DEV_DOMAIN:5000 (includes port)
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  
  if (domain) {
    // Domain already includes port 5000, use it directly with https
    // Example: "abc-123.worf.replit.dev:5000" -> "https://abc-123.worf.replit.dev:5000"
    return `https://${domain}`;
  }
  
  // For web, construct URL for the backend port
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    // Always target port 5000 for the API
    return `https://${hostname}:5000`;
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
