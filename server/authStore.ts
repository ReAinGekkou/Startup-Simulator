import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';

export interface AuthUser {
  id: string;
  email: string;
  createdAt: number;
}

interface StoredUserRecord extends AuthUser {
  passwordHash: string;
}

interface StoredSessionRecord {
  tokenHash: string;
  userId: string;
  email: string;
  createdAt: number;
  expiresAt: number;
  rememberMe: boolean;
}

interface AuthDatabase {
  users: StoredUserRecord[];
  sessions: StoredSessionRecord[];
}

export type AuthErrorCode =
  | 'INVALID_EMAIL'
  | 'WEAK_PASSWORD'
  | 'EMAIL_IN_USE'
  | 'INVALID_CREDENTIALS'
  | 'SESSION_EXPIRED'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const BCRYPT_COST = 12;
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKxGhu6H1xE7j9gN1yY/8bA1C4hL8Q8vD8e1O';

export const SESSION_TTL_SHORT_MS = 12 * 60 * 60 * 1000; // 12 hours
export const SESSION_TTL_REMEMBER_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function getDefaultAuthDataDir(): string {
  return process.env.AUTH_DATA_DIR || path.resolve(process.cwd(), '.data');
}

function getDbFilePath(dataDir: string): string {
  return path.join(dataDir, 'auth-db.json');
}

function readDb(dataDir: string): AuthDatabase {
  const file = getDbFilePath(dataDir);
  try {
    if (!fs.existsSync(file)) {
      return { users: [], sessions: [] };
    }
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw) as Partial<AuthDatabase>;
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    };
  } catch {
    return { users: [], sessions: [] };
  }
}

function writeDb(dataDir: string, db: AuthDatabase): void {
  fs.mkdirSync(dataDir, { recursive: true });
  const file = getDbFilePath(dataDir);
  const tmpFile = `${file}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmpFile, file);
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateEmail(raw: string): boolean {
  const email = normalizeEmail(raw);
  return email.length >= 5 && email.length <= 254 && EMAIL_REGEX.test(email);
}

export function validatePasswordStrength(password: string): boolean {
  if (typeof password !== 'string') return false;
  if (password.length < 8 || password.length > 128) return false;
  const hasLetter = /[A-Za-z]/.test(password);
  const hasDigit = /\d/.test(password);
  return hasLetter && hasDigit;
}

function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export async function registerUser(
  dataDir: string,
  rawEmail: string,
  password: string
): Promise<{ ok: true; user: AuthUser } | { ok: false; code: AuthErrorCode }> {
  const email = normalizeEmail(rawEmail);
  if (!validateEmail(email)) {
    return { ok: false, code: 'INVALID_EMAIL' };
  }
  if (!validatePasswordStrength(password)) {
    return { ok: false, code: 'WEAK_PASSWORD' };
  }

  const db = readDb(dataDir);
  if (db.users.some((u) => u.email === email)) {
    return { ok: false, code: 'EMAIL_IN_USE' };
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const record: StoredUserRecord = {
    id: `usr_${crypto.randomUUID()}`,
    email,
    passwordHash,
    createdAt: Date.now(),
  };

  db.users.push(record);
  writeDb(dataDir, db);

  return {
    ok: true,
    user: {
      id: record.id,
      email: record.email,
      createdAt: record.createdAt,
    },
  };
}

export async function verifyUserCredentials(
  dataDir: string,
  rawEmail: string,
  password: string
): Promise<{ ok: true; user: AuthUser } | { ok: false; code: AuthErrorCode }> {
  const email = normalizeEmail(rawEmail);
  if (!validateEmail(email) || typeof password !== 'string' || password.length === 0) {
    return { ok: false, code: 'INVALID_CREDENTIALS' };
  }

  const db = readDb(dataDir);
  const found = db.users.find((u) => u.email === email);
  if (!found) {
    // Equalize timing even when email does not exist
    await bcrypt.compare(password, DUMMY_HASH);
    return { ok: false, code: 'INVALID_CREDENTIALS' };
  }

  const matched = await bcrypt.compare(password, found.passwordHash);
  if (!matched) {
    return { ok: false, code: 'INVALID_CREDENTIALS' };
  }

  return {
    ok: true,
    user: {
      id: found.id,
      email: found.email,
      createdAt: found.createdAt,
    },
  };
}

export function createSession(
  dataDir: string,
  user: AuthUser,
  rememberMe: boolean,
  ttlOverrideMs?: number
): { rawToken: string; expiresAt: number } {
  const now = Date.now();
  const db = readDb(dataDir);
  // Prune expired sessions and cap per-user sessions cleanly
  db.sessions = db.sessions.filter((s) => s.expiresAt > now);
  const userSessions = db.sessions.filter((s) => s.userId === user.id);
  if (userSessions.length >= 10) {
    const oldest = userSessions.slice(0, userSessions.length - 9).map((s) => s.tokenHash);
    db.sessions = db.sessions.filter((s) => !oldest.includes(s.tokenHash));
  }

  const rawToken = crypto.randomBytes(32).toString('base64url');
  const ttlMs =
    ttlOverrideMs ?? (rememberMe ? SESSION_TTL_REMEMBER_MS : SESSION_TTL_SHORT_MS);
  const expiresAt = now + ttlMs;

  db.sessions.push({
    tokenHash: hashToken(rawToken),
    userId: user.id,
    email: user.email,
    createdAt: now,
    expiresAt,
    rememberMe,
  });
  writeDb(dataDir, db);

  return { rawToken, expiresAt };
}

export function resolveSession(
  dataDir: string,
  rawToken: string | undefined,
  now = Date.now()
):
  | { status: 'VALID'; user: AuthUser; rememberMe: boolean; expiresAt: number }
  | { status: 'EXPIRED' }
  | { status: 'MISSING' } {
  if (!rawToken || typeof rawToken !== 'string') {
    return { status: 'MISSING' };
  }
  const tokenHash = hashToken(rawToken);
  const db = readDb(dataDir);
  const idx = db.sessions.findIndex((s) => s.tokenHash === tokenHash);
  if (idx === -1) {
    return { status: 'MISSING' };
  }
  const session = db.sessions[idx];
  if (session.expiresAt <= now) {
    db.sessions.splice(idx, 1);
    writeDb(dataDir, db);
    return { status: 'EXPIRED' };
  }

  const user = db.users.find((u) => u.id === session.userId);
  if (!user) {
    db.sessions.splice(idx, 1);
    writeDb(dataDir, db);
    return { status: 'MISSING' };
  }

  return {
    status: 'VALID',
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
    },
    rememberMe: session.rememberMe,
    expiresAt: session.expiresAt,
  };
}

export function revokeSession(dataDir: string, rawToken: string | undefined): void {
  if (!rawToken || typeof rawToken !== 'string') return;
  const tokenHash = hashToken(rawToken);
  const db = readDb(dataDir);
  const nextSessions = db.sessions.filter((s) => s.tokenHash !== tokenHash);
  if (nextSessions.length !== db.sessions.length) {
    db.sessions = nextSessions;
    writeDb(dataDir, db);
  }
}
