import { QueryClient } from '@tanstack/react-query';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
const API_KEY = import.meta.env.VITE_API_KEY;

if (!API_KEY) {
  console.warn('Warning: VITE_API_KEY is not set. API requests may fail.');
}

// ── Typed API error ───────────────────────────────────────────────────────────
// Mirrors the ApiProblemDetail shape returned by GlobalExceptionMiddleware.
// Components can catch this and switch on errorCode for specific UX.

export type ApiErrorCode =
  | 'UPSTREAM_RATE_LIMIT'
  | 'UPSTREAM_TIMEOUT'
  | 'UPSTREAM_AUTH_ERROR'
  | 'UPSTREAM_SERVICE_ERROR'
  | 'UPSTREAM_HTTP_ERROR'
  | 'UPSTREAM_PARSE_ERROR'
  | 'IMAGERY_NOT_FOUND'
  | 'INSUFFICIENT_WATER'
  | 'CIRCUIT_OPEN'
  | 'RATE_LIMITED'
  | 'CONCURRENCY_LIMIT'
  | 'DATABASE_ERROR'
  | 'CONFIGURATION_ERROR'
  | 'INTERNAL_ERROR'
  | 'UNKNOWN';

export class ApiError extends Error {
  readonly status: number;
  readonly errorCode: ApiErrorCode;
  readonly detail: string;

  constructor(status: number, errorCode: ApiErrorCode, title: string, detail: string) {
    super(title);
    this.name = 'ApiError';
    this.status = status;
    this.errorCode = errorCode;
    this.detail = detail;
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

// ── Client ────────────────────────────────────────────────────────────────────

export const apiClient = {
  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      ...options.headers,
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      // Attempt to parse the structured problem detail body from the server.
      // Fall back gracefully if the response isn't JSON (e.g. a network proxy error).
      let errorCode: ApiErrorCode = 'UNKNOWN';
      let title = `API Error: ${response.status} ${response.statusText}`;
      let detail = title;

      try {
        const body = await response.json();
        errorCode = (body.errorCode as ApiErrorCode) ?? 'UNKNOWN';
        title = body.title ?? title;
        detail = body.detail ?? detail;
      } catch {
        // Non-JSON error body — keep the fallback values above
      }

      throw new ApiError(response.status, errorCode, title, detail);
    }

    return response.json();
  },

  get<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'GET' });
  },

  post<T>(endpoint: string, body?: unknown) {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  put<T>(endpoint: string, body?: unknown) {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  delete<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'DELETE' });
  },
};

// ── Query client ──────────────────────────────────────────────────────────────
// Don't retry on rate-limit (429) or auth errors — retrying immediately makes
// things worse. Retry once on everything else.

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: (failureCount, error) => {
        if (isApiError(error)) {
          // Never retry deterministic domain outcomes — the result won't change
          // until external state changes (next satellite pass, pin moved, etc.)
          if (error.errorCode === 'IMAGERY_NOT_FOUND') return false;
          if (error.errorCode === 'INSUFFICIENT_WATER') return false;
          // Never retry rate limits or auth — retrying immediately makes things worse
          if (error.errorCode === 'UPSTREAM_RATE_LIMIT') return false;
          if (error.errorCode === 'RATE_LIMITED') return false;
          if (error.errorCode === 'CONCURRENCY_LIMIT') return false;
          if (error.errorCode === 'CIRCUIT_OPEN') return false;
          if (error.status === 401 || error.status === 403) return false;
          // Retry once for genuine transient failures (502, 503, 504, network errors)
          return failureCount < 1;
        }
        // Non-ApiError (e.g. network offline) — retry once
        return failureCount < 1;
      },
    },
  },
});