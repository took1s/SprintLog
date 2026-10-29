// Dünner fetch-Wrapper: Auth-Header, JSON, einheitliche Fehler (RFC 7807 ProblemDetails).

export class ApiError extends Error {
  constructor(status, message, fields = {}) {
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

async function parseError(response) {
  let message = `Request failed (${response.status})`;
  let fields = {};
  try {
    const body = await response.json();
    if (body?.errors && typeof body.errors === 'object') {
      fields = body.errors;
      const first = Object.values(body.errors).flat()[0];
      message = first || body.title || message;
    } else if (body?.title || body?.detail || body?.message) {
      message = body.detail && body.title ? `${body.title} ${body.detail}` : body.title || body.detail || body.message;
    }
  } catch { /* kein JSON */ }
  if (response.status === 429) message = 'Too many attempts. Please wait a minute.';
  return new ApiError(response.status, message, fields);
}

export function createApi({ getToken, onUnauthorized, timeoutMs = 15000 }) {
  async function request(method, path, body) {
    const headers = { Accept: 'application/json' };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
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
    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    put: (path, body) => request('PUT', path, body),
    del: (path, body) => request('DELETE', path, body),
  };
}
