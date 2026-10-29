// Dünner fetch-Wrapper: JSON, einheitliche Fehler (RFC 7807 ProblemDetails), Cookie-Sitzung mit automatischem Refresh.
//
// Die Sitzung liegt in httpOnly-Cookies (Access-Token 15 min, Refresh-Token 30 Tage) - JavaScript sieht keine Tokens.
// Jeder Request trägt "X-Requested-With: SprintLog": Daran erkennt die API die Browser-App, und schreibende
// Requests mit Cookie werden nur mit diesem Header akzeptiert (CSRF-Schutz).

import { t } from '../i18n';

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

export const CLIENT_HEADER = Object.freeze({ 'X-Requested-With': 'SprintLog', 'X-Client-Version': __APP_VERSION__ });

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
  if (response.status === 429) message = t('common.tooManyAttempts');
  return new ApiError(response.status, message, fields);
}

export interface Api {
  get<T = unknown>(path: string): Promise<T>;
  post<T = unknown>(path: string, body?: unknown): Promise<T>;
  put<T = unknown>(path: string, body?: unknown): Promise<T>;
  del<T = unknown>(path: string, body?: unknown): Promise<T>;
  /** Access-Token per Refresh-Cookie erneuern (Rotation). false = Sitzung ungültig; wirft ApiError(0) ohne Verbindung. */
  refreshSession(): Promise<boolean>;
}

export interface ApiOptions {
  /** Sitzung abgelaufen und Refresh fehlgeschlagen -> neu anmelden. */
  onUnauthorized?: () => void;
  /** Nur für den Übergang: Token einer älteren App-Version (localStorage) - wird beim Refresh gegen Cookies getauscht. */
  getLegacyToken?: () => string | null;
  onLegacyTokenUsed?: () => void;
  timeoutMs?: number;
}

/** Endpunkte, bei denen ein 401 eine echte Antwort ist (falsches Passwort usw.) und kein abgelaufener Access-Token. */
const NO_REFRESH = /^\/api\/auth\/(login|register|refresh|logout|recover|reset-password|forgot-password|email\/verify|options)\b/;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createApi({ onUnauthorized, getLegacyToken, onLegacyTokenUsed, timeoutMs = 15000 }: ApiOptions = {}): Api {
  async function send(method: string, path: string, body?: unknown, extraHeaders: Record<string, string> = {}): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json', ...CLIENT_HEADER, ...extraHeaders };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(path, {
        method,
        headers,
        credentials: 'same-origin',
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      throw new ApiError(0, t('common.noConnection'));
    } finally {
      clearTimeout(timer);
    }
  }

  async function read<T>(response: Response): Promise<T> {
    if (!response.ok) throw await parseError(response);
    if (response.status === 204) return null as T;
    const text = await response.text();
    return (text ? JSON.parse(text) : null) as T;
  }

  return createRefreshingApi(send, read, { onUnauthorized, getLegacyToken, onLegacyTokenUsed });
}

type Send = (method: string, path: string, body?: unknown, headers?: Record<string, string>) => Promise<Response>;
type Read = <T>(response: Response) => Promise<T>;

/** Refresh-Logik getrennt vom Transport -> mit gefälschtem fetch unit-testbar. */
export function createRefreshingApi(send: Send, read: Read, { onUnauthorized, getLegacyToken, onLegacyTokenUsed }: ApiOptions): Api {
  // Mehrere gleichzeitige 401 lösen genau einen Refresh aus.
  let refreshing: Promise<boolean> | null = null;

  async function refreshOnce(): Promise<boolean> {
    const legacy = getLegacyToken?.();
    const headers: Record<string, string> = legacy ? { Authorization: `Bearer ${legacy}` } : {};
    let response = await send('POST', '/api/auth/refresh', undefined, headers);
    if (response.status === 409) {
      // Anderer Tab hat gerade rotiert - dessen neue Cookies sind schon im Browser.
      await sleep(300);
      response = await send('POST', '/api/auth/refresh');
    }
    if (response.ok && legacy) onLegacyTokenUsed?.();
    return response.ok;
  }

  function refresh(): Promise<boolean> {
    refreshing ??= refreshOnce().finally(() => { refreshing = null; });
    return refreshing;
  }

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    let response = await send(method, path, body);
    if (response.status === 401 && !NO_REFRESH.test(path)) {
      if (await refresh()) response = await send(method, path, body);
      if (response.status === 401) onUnauthorized?.();
    }
    return read<T>(response);
  }

  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    put: (path, body) => request('PUT', path, body),
    del: (path, body) => request('DELETE', path, body),
    refreshSession: refresh,
  };
}
