// Dünner fetch-Wrapper: Auth-Header, JSON, einheitliche Fehler (RFC 7807 ProblemDetails).

export type FieldErrors = Record<string, string[]>;

export class ApiError extends Error {
  readonly status: number;
  readonly fields: FieldErrors;

  constructor(status: number, message: string, fields: FieldErrors = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;   // 0 = keine Verbindung
    this.fields = fields;   // { username: ['...'] }
  }

  get isNetwork() { return this.status === 0; }
  get isAuth() { return this.status === 401; }
  /** Lohnt sich ein erneuter Versuch später? (Netzwerk, Serverfehler, Rate Limit) */
  get isRetryable() { return this.status === 0 || this.status === 408 || this.status === 429 || this.status >= 500; }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;

async function parseError(response: Response): Promise<ApiError> {
  let message = `Request failed (${response.status})`;
  let fields: FieldErrors = {};
  try {
    const body = await response.json() as { errors?: FieldErrors; title?: string; detail?: string; message?: string };
    if (body?.errors && typeof body.errors === 'object') {
      fields = body.errors;
      const first = Object.values(body.errors).flat()[0];
      message = first || body.title || message;
    } else if (body?.title || body?.detail || body?.message) {
      message = body.detail && body.title ? `${body.title} ${body.detail}` : body.title || body.detail || body.message || message;
    }
  } catch { /* kein JSON */ }
  if (response.status === 429) message = 'Too many attempts. Please wait a minute.';
  return new ApiError(response.status, message, fields);
}

export interface Api {
  get<T = unknown>(path: string): Promise<T>;
  post<T = unknown>(path: string, body?: unknown): Promise<T>;
  put<T = unknown>(path: string, body?: unknown): Promise<T>;
  del<T = unknown>(path: string, body?: unknown): Promise<T>;
}

export interface ApiOptions {
  getToken: () => string;
  onUnauthorized?: () => void;
  timeoutMs?: number;
}

export function createApi({ getToken, onUnauthorized, timeoutMs = 15000 }: ApiOptions): Api {
  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetch(path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      throw new ApiError(0, 'No connection to server.');
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 401 && token) onUnauthorized?.();
    if (!response.ok) throw await parseError(response);
    if (response.status === 204) return null as T;
    const text = await response.text();
    return (text ? JSON.parse(text) : null) as T;
  }

  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    put: (path, body) => request('PUT', path, body),
    del: (path, body) => request('DELETE', path, body),
  };
}
