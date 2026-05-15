const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

export interface RequestOptions {
  token?: string;
}

function buildHeaders(opts?: RequestOptions, jsonBody = false): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (jsonBody) headers['Content-Type'] = 'application/json';
  if (opts?.token) headers['Authorization'] = `Bearer ${opts.token}`;
  return headers;
}

async function parseResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      if (body && typeof body.message === 'string') {
        message = body.message;
      }
    } catch {
      // response body was not JSON; keep the default message
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

function isFormDataBody(body: unknown): body is FormData {
  return typeof FormData !== 'undefined' && body instanceof FormData;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  opts?: RequestOptions
): Promise<T> {
  const isForm = isFormDataBody(body);
  const isJson = body !== undefined && !isForm;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: buildHeaders(opts, isJson),
    // For FormData we deliberately do NOT set Content-Type so the browser
    // emits the correct multipart boundary header.
    body: isForm ? (body as FormData) : isJson ? JSON.stringify(body) : undefined,
  });
  return parseResponse<T>(res);
}

export function apiGet<T>(path: string, opts?: RequestOptions): Promise<T> {
  return request<T>('GET', path, undefined, opts);
}

export function apiPost<T>(path: string, body: unknown, opts?: RequestOptions): Promise<T> {
  return request<T>('POST', path, body, opts);
}

export function apiPatch<T>(path: string, body: unknown, opts?: RequestOptions): Promise<T> {
  return request<T>('PATCH', path, body, opts);
}

export function apiDelete<T>(path: string, opts?: RequestOptions): Promise<T> {
  return request<T>('DELETE', path, undefined, opts);
}
