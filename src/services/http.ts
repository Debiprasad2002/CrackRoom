import { API_URL } from './config';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** First message per field, for showing next to form controls. */
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

function readCookie(name: string) {
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

let csrfRequest: Promise<unknown> | null = null;

/** Django only sets the CSRF cookie on request; fetch it once before the first write. */
async function ensureCsrfCookie() {
  if (readCookie('csrftoken')) return;
  csrfRequest ??= fetch(`${API_URL}/auth/csrf/`, { credentials: 'include' }).finally(() => {
    csrfRequest = null;
  });
  await csrfRequest;
}

function firstMessage(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return firstMessage(value[0]);
  if (value && typeof value === 'object') return firstMessage(Object.values(value)[0]);
  return undefined;
}

function fallbackMessage(status: number) {
  if (status === 429) return 'You are going a little fast. Wait a few seconds and try again.';
  if (status === 403) return 'You do not have access to this.';
  if (status === 404) return 'This could not be found.';
  if (status >= 500) return 'The CrackRoom server is unavailable or waking up. Try again in a moment.';
  return `Request failed (${status}).`;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
}

export async function api<T>(path: string, { method = 'GET', body }: RequestOptions = {}): Promise<T> {
  const unsafe = method !== 'GET';
  if (unsafe) await ensureCsrfCookie();

  // Free hosting sleeps when idle, so reads retry briefly while the server wakes up.
  const attempts = unsafe ? 1 : 3;
  let res: Response | undefined;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      res = await fetch(`${API_URL}${path}`, {
        method,
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          ...(body !== undefined && { 'Content-Type': 'application/json' }),
          ...(unsafe && { 'X-CSRFToken': readCookie('csrftoken') ?? '' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      res = undefined;
    }
    // A short rate-limit wait on a read is retried once rather than shown as an error.
    const retryAfter = res?.status === 429 ? Number(res.headers.get('Retry-After')) : NaN;
    if (res && res.status === 429 && !unsafe && attempt < attempts && retryAfter > 0 && retryAfter <= 10) {
      await sleep(retryAfter * 1000);
      continue;
    }
    if (res && ![502, 503, 504].includes(res.status)) break;
    if (attempt < attempts) await sleep(1500 * attempt);
  }
  if (!res) throw new ApiError(0, 'You seem to be offline. Check your connection and try again.');

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const payload = (data ?? {}) as { detail?: unknown; errors?: Record<string, unknown> };
    const fields = Object.fromEntries(
      Object.entries(payload.errors ?? {}).map(([key, value]) => [key, firstMessage(value) ?? 'Check this field.']),
    );
    const message = res.status === 429 ? fallbackMessage(429) : (firstMessage(payload.detail) ?? fallbackMessage(res.status));
    throw new ApiError(res.status, message, fields);
  }
  // A body that is not JSON means something other than the API answered, such as a proxy page.
  if (text && data === null) throw new ApiError(502, fallbackMessage(502));
  return data as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return api<T>(path);
}

/** A human-readable message for any thrown value. */
export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Try again.';
}

/** Small delay so loading states behave the same with sample data as over the network. */
export function settle<T>(value: T, ms = 280): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}
