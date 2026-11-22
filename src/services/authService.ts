export interface ClientAuthUser {
  id: string;
  email: string;
  createdAt: number;
}

export type ClientAuthErrorCode =
  | 'INVALID_EMAIL'
  | 'WEAK_PASSWORD'
  | 'PASSWORD_MISMATCH'
  | 'EMAIL_IN_USE'
  | 'INVALID_CREDENTIALS'
  | 'SESSION_EXPIRED'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'SERVER_ERROR';

export type AuthResult<T> =
  | { ok: true; data: T }
  | { ok: false; errorCode: ClientAuthErrorCode };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmailInput(rawEmail: string): boolean {
  const email = rawEmail.trim().toLowerCase();
  return email.length >= 5 && email.length <= 254 && EMAIL_REGEX.test(email);
}

export function validatePasswordInput(password: string): boolean {
  if (password.length < 8 || password.length > 128) return false;
  return /[A-Za-z]/.test(password) && /\d/.test(password);
}

async function parseJsonSafe(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function fetchSession(): Promise<{
  authenticated: boolean;
  user: ClientAuthUser | null;
  expired: boolean;
  offline: boolean;
}> {
  try {
    const res = await fetch('/api/auth/session', {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) {
      return { authenticated: false, user: null, expired: false, offline: false };
    }
    const body = await parseJsonSafe(res);
    return {
      authenticated: Boolean(body.authenticated && body.user),
      user: (body.user as ClientAuthUser | null) ?? null,
      expired: Boolean(body.expired),
      offline: false,
    };
  } catch {
    return { authenticated: false, user: null, expired: false, offline: true };
  }
}

export async function loginWithEmail(
  email: string,
  password: string,
  rememberMe: boolean
): Promise<AuthResult<ClientAuthUser>> {
  if (!validateEmailInput(email)) {
    return { ok: false, errorCode: 'INVALID_EMAIL' };
  }
  if (!password) {
    return { ok: false, errorCode: 'INVALID_CREDENTIALS' };
  }
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim(),
        password,
        rememberMe,
      }),
    });
    const body = await parseJsonSafe(res);
    if (!res.ok) {
      return {
        ok: false,
        errorCode: (body.errorCode as ClientAuthErrorCode) ?? 'INVALID_CREDENTIALS',
      };
    }
    return { ok: true, data: body.user as ClientAuthUser };
  } catch {
    return { ok: false, errorCode: 'NETWORK_ERROR' };
  }
}

export async function registerWithEmail(
  email: string,
  password: string,
  confirmPassword: string,
  rememberMe = true
): Promise<AuthResult<ClientAuthUser>> {
  if (!validateEmailInput(email)) {
    return { ok: false, errorCode: 'INVALID_EMAIL' };
  }
  if (!validatePasswordInput(password)) {
    return { ok: false, errorCode: 'WEAK_PASSWORD' };
  }
  if (password !== confirmPassword) {
    return { ok: false, errorCode: 'PASSWORD_MISMATCH' };
  }
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim(),
        password,
        rememberMe,
      }),
    });
    const body = await parseJsonSafe(res);
    if (!res.ok) {
      return {
        ok: false,
        errorCode: (body.errorCode as ClientAuthErrorCode) ?? 'SERVER_ERROR',
      };
    }
    return { ok: true, data: body.user as ClientAuthUser };
  } catch {
    return { ok: false, errorCode: 'NETWORK_ERROR' };
  }
}

export async function logoutSession(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    return res.ok;
  } catch {
    return false;
  }
}
