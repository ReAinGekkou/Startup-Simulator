import express, { type NextFunction, type Request, type Response } from 'express';
import {
  type AuthUser,
  createSession,
  getDefaultAuthDataDir,
  registerUser,
  resolveSession,
  revokeSession,
  SESSION_TTL_REMEMBER_MS,
  verifyUserCredentials,
} from './authStore.ts';

export const SESSION_COOKIE_NAME = 'sf_session';

export interface AuthRouterOptions {
  dataDir?: string;
  rateLimitMax?: number;
  rateLimitWindowMs?: number;
}

interface AuthenticatedRequest extends Request {
  authUser?: AuthUser;
}

function parseCookies(headerValue: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!headerValue) return cookies;
  for (const part of headerValue.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const val = part.slice(eq + 1).trim();
    if (!key) continue;
    try {
      cookies[key] = decodeURIComponent(val);
    } catch {
      cookies[key] = val;
    }
  }
  return cookies;
}

function isHttpsRequest(req: Request): boolean {
  const proto = req.get('x-forwarded-proto');
  if (proto) {
    return proto.split(',')[0].trim().toLowerCase() === 'https';
  }
  return req.secure;
}

function buildSessionCookie(
  req: Request,
  rawToken: string,
  rememberMe: boolean
): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(rawToken)}`,
    'HttpOnly',
    'Path=/',
  ];
  if (rememberMe) {
    parts.push(`Max-Age=${Math.floor(SESSION_TTL_REMEMBER_MS / 1000)}`);
  }
  if (isHttpsRequest(req)) {
    parts.push('SameSite=None', 'Secure', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  return parts.join('; ');
}

function buildClearSessionCookie(req: Request): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'HttpOnly',
    'Path=/',
    'Max-Age=0',
  ];
  if (isHttpsRequest(req)) {
    parts.push('SameSite=None', 'Secure', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  return parts.join('; ');
}

export function mountAuthRoutes(
  app: express.Express,
  options: AuthRouterOptions = {}
): void {
  const dataDir = options.dataDir ?? getDefaultAuthDataDir();
  const rateLimitMax = options.rateLimitMax ?? 12;
  const rateLimitWindowMs = options.rateLimitWindowMs ?? 15 * 60 * 1000;
  const attemptsByIp = new Map<string, number[]>();

  const checkRateLimit = (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const recent = (attemptsByIp.get(ip) ?? []).filter((ts) => now - ts < rateLimitWindowMs);
    if (recent.length >= rateLimitMax) {
      const oldest = recent[0];
      const retryAfterSec = Math.max(1, Math.ceil((rateLimitWindowMs - (now - oldest)) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({ errorCode: 'RATE_LIMITED' });
      return;
    }
    recent.push(now);
    attemptsByIp.set(ip, recent);
    next();
  };

  const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const cookies = parseCookies(req.headers.cookie);
    const resolved = resolveSession(dataDir, cookies[SESSION_COOKIE_NAME]);
    if (resolved.status !== 'VALID') {
      if (resolved.status === 'EXPIRED') {
        res.setHeader('Set-Cookie', buildClearSessionCookie(req));
        res.status(401).json({ errorCode: 'SESSION_EXPIRED' });
        return;
      }
      res.status(401).json({ errorCode: 'UNAUTHORIZED' });
      return;
    }
    req.authUser = resolved.user;
    next();
  };

  app.use('/api', express.json({ limit: '64kb' }));

  app.get('/api/auth/session', (req, res) => {
    const cookies = parseCookies(req.headers.cookie);
    const resolved = resolveSession(dataDir, cookies[SESSION_COOKIE_NAME]);
    if (resolved.status === 'VALID') {
      res.json({
        authenticated: true,
        user: resolved.user,
      });
      return;
    }
    if (resolved.status === 'EXPIRED') {
      res.setHeader('Set-Cookie', buildClearSessionCookie(req));
      res.json({
        authenticated: false,
        user: null,
        expired: true,
      });
      return;
    }
    res.json({
      authenticated: false,
      user: null,
      expired: false,
    });
  });

  app.post('/api/auth/register', checkRateLimit, async (req, res) => {
    try {
      const body = req.body as { email?: unknown; password?: unknown; rememberMe?: unknown };
      const email = typeof body?.email === 'string' ? body.email : '';
      const password = typeof body?.password === 'string' ? body.password : '';
      const rememberMe = Boolean(body?.rememberMe ?? true);

      const result = await registerUser(dataDir, email, password);
      if (result.ok === false) {
        const status = result.code === 'EMAIL_IN_USE' ? 409 : 400;
        res.status(status).json({ errorCode: result.code });
        return;
      }

      const { rawToken } = createSession(dataDir, result.user, rememberMe);
      res.setHeader('Set-Cookie', buildSessionCookie(req, rawToken, rememberMe));
      res.status(201).json({ user: result.user });
    } catch {
      res.status(500).json({ errorCode: 'SERVER_ERROR' });
    }
  });

  app.post('/api/auth/login', checkRateLimit, async (req, res) => {
    try {
      const body = req.body as { email?: unknown; password?: unknown; rememberMe?: unknown };
      const email = typeof body?.email === 'string' ? body.email : '';
      const password = typeof body?.password === 'string' ? body.password : '';
      const rememberMe = Boolean(body?.rememberMe ?? true);

      const result = await verifyUserCredentials(dataDir, email, password);
      if (result.ok === false) {
        res.status(401).json({ errorCode: result.code });
        return;
      }

      const { rawToken } = createSession(dataDir, result.user, rememberMe);
      res.setHeader('Set-Cookie', buildSessionCookie(req, rawToken, rememberMe));
      res.json({ user: result.user });
    } catch {
      res.status(500).json({ errorCode: 'SERVER_ERROR' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    const cookies = parseCookies(req.headers.cookie);
    revokeSession(dataDir, cookies[SESSION_COOKIE_NAME]);
    res.setHeader('Set-Cookie', buildClearSessionCookie(req));
    res.json({ ok: true });
  });

  app.get('/api/account/me', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ user: req.authUser });
  });
}

export function createAuthApp(options: AuthRouterOptions = {}): express.Express {
  const app = express();
  app.set('trust proxy', 1);
  mountAuthRoutes(app, options);
  return app;
}
