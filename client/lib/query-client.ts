import { QueryClient, QueryFunction } from "@tanstack/react-query";

/**
 * Gets the base URL for the API server (local proxy to production)
 * @returns {string} The API base URL
 */
export function getApiUrl(): string {
  // Use the local server which proxies to the production API
  // This ensures proper handling of mobile app requests
  let host = process.env.EXPO_PUBLIC_DOMAIN;

  console.log('[API] EXPO_PUBLIC_DOMAIN:', host);

  if (!host) {
    // Fallback for development
    host = 'localhost:5000';
  }

  // Strip port from host if present (Replit routes port 5000 to base HTTPS URL)
  // EXPO_PUBLIC_DOMAIN is set as "domain:5000" but we need just "domain"
  if (host.includes(':5000')) {
    host = host.replace(':5000', '');
  }

  // Ensure we're using https for non-localhost
  const protocol = host.includes('localhost') || host.includes('127.0.0.1') 
    ? 'http' 
    : 'https';
    
  let url = new URL(`${protocol}://${host}`);
  console.log('[API] Final URL:', url.href.slice(0, -1));
  return url.href.slice(0, -1); // Remove trailing slash
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown | undefined,
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = new URL(route, baseUrl);

  const res = await fetch(url.toString(), {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
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

    const res = await fetch(url.toString(), {
      credentials: "include",
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
