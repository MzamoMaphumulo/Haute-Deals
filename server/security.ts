import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Haute Deals Security & Hardening Suite
 * Enforces API key protection, security headers, rate limiting, bot protection,
 * input validation, SSRF defense, field tampering protection, and response trimming.
 */

// ==========================================
// 1. SECURITY HEADERS & HTTPS ENFORCEMENT
// ==========================================

export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Prevent MIME-sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Clickjacking protection (allow sameorigin and AI Studio preview containers)
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // Legacy XSS filter activation
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Strict Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Enforce HTTPS (HSTS)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // Permissions policy (restrict device hardware)
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');

  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https:",
    "frame-ancestors 'self' https://*.run.app https://ai.studio https://*.google.com",
    "object-src 'none'",
    "base-uri 'self'"
  ].join('; ');

  res.setHeader('Content-Security-Policy', csp);

  // Remove server fingerprint
  res.removeHeader('X-Powered-By');

  next();
}

/**
 * Force HTTPS redirect in production environments
 */
export function enforceHttpsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const forwardedProto = req.headers['x-forwarded-proto'];
  if (forwardedProto && forwardedProto === 'http' && process.env.NODE_ENV === 'production') {
    const host = req.headers.host || 'localhost';
    res.redirect(301, `https://${host}${req.url}`);
    return;
  }
  next();
}

// ==========================================
// 2. BOT & THREAT PROTECTION
// ==========================================

const MALICIOUS_BOT_SIGNATURES = [
  /sqlmap/i,
  /nikto/i,
  /masscan/i,
  /dirbuster/i,
  /wpscan/i,
  /acunetix/i,
  /gobuster/i,
  /nessus/i,
  /nmap/i,
  /python-requests/i, // automated scrapers without custom UA
];

export function botAndThreatProtectionMiddleware(req: Request, res: Response, next: NextFunction): void {
  const userAgent = req.headers['user-agent'] || '';

  // Check for known automated attacking tools
  for (const pattern of MALICIOUS_BOT_SIGNATURES) {
    if (pattern.test(userAgent)) {
      res.status(403).json({ error: 'Access denied: Automated request signature flagged.' });
      return;
    }
  }

  // Path traversal check
  const rawUrl = req.originalUrl || req.url;
  if (rawUrl.includes('../') || rawUrl.includes('..\\') || rawUrl.includes('%2e%2e')) {
    res.status(400).json({ error: 'Bad Request: Malformed URI path sequence.' });
    return;
  }

  // Prototype pollution attempt check in body (checks own properties, not prototype chain)
  if (req.body && typeof req.body === 'object') {
    const checkPollution = (target: any): boolean => {
      if (!target || typeof target !== 'object') return false;
      const ownKeys = Object.getOwnPropertyNames(target);
      if (ownKeys.includes('__proto__') || ownKeys.includes('constructor') || ownKeys.includes('prototype')) {
        return true;
      }
      for (const k of ownKeys) {
        if (target[k] && typeof target[k] === 'object' && checkPollution(target[k])) {
          return true;
        }
      }
      return false;
    };

    if (checkPollution(req.body)) {
      res.status(400).json({ error: 'Bad Request: Forbidden object properties detected.' });
      return;
    }
  }

  next();
}

// ==========================================
// 3. SLIDING-WINDOW RATE LIMITING
// ==========================================

interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Clean up stale IP records every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    record.timestamps = record.timestamps.filter((ts) => now - ts < 600000); // 10 minutes
    if (record.timestamps.length === 0) {
      rateLimitStore.delete(key);
    }
  }
}, 300000);

export function createRateLimiter(options: {
  maxRequests: number;
  windowMs: number;
  name: string;
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    const key = `${options.name}:${ip}`;
    const now = Date.now();

    let record = rateLimitStore.get(key);
    if (!record) {
      record = { timestamps: [] };
      rateLimitStore.set(key, record);
    }

    // Filter out timestamps outside current window
    record.timestamps = record.timestamps.filter((ts) => now - ts < options.windowMs);

    if (record.timestamps.length >= options.maxRequests) {
      const oldest = record.timestamps[0];
      const resetTime = Math.ceil((oldest + options.windowMs - now) / 1000);

      res.setHeader('Retry-After', String(Math.max(1, resetTime)));
      res.setHeader('RateLimit-Limit', String(options.maxRequests));
      res.setHeader('RateLimit-Remaining', '0');
      res.status(429).json({
        error: `Rate limit reached for ${options.name}. Please wait ${Math.max(1, resetTime)} seconds before retrying.`,
        retryAfterSeconds: Math.max(1, resetTime)
      });
      return;
    }

    record.timestamps.push(now);
    res.setHeader('RateLimit-Limit', String(options.maxRequests));
    res.setHeader('RateLimit-Remaining', String(options.maxRequests - record.timestamps.length));
    next();
  };
}

// Pre-configured rate limiters
export const apiGeneralLimiter = createRateLimiter({
  name: 'api',
  maxRequests: 120,
  windowMs: 60 * 1000 // 120 requests/min
});

export const authLimiter = createRateLimiter({
  name: 'auth',
  maxRequests: 5,
  windowMs: 60 * 1000 // 5 auth attempts/min to prevent brute-force
});

export const aiSearchLimiter = createRateLimiter({
  name: 'ai-search',
  maxRequests: 20,
  windowMs: 60 * 1000 // 20 requests/min to protect Gemini quota
});

export const syncLimiter = createRateLimiter({
  name: 'live-sync',
  maxRequests: 6,
  windowMs: 10 * 60 * 1000 // 6 live retail scrapings/10min
});

export const imageProxyLimiter = createRateLimiter({
  name: 'image-proxy',
  maxRequests: 90,
  windowMs: 60 * 1000 // 90 image queries/min
});

// ==========================================
// 4. INPUT VALIDATION & CONTENT SANITIZATION
// ==========================================

/**
 * Escapes HTML characters to prevent Cross-Site Scripting (XSS)
 */
export function escapeHtml(str: string): string {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitizes search input: removes control characters, limits length, strips tags
 */
export function sanitizeSearchQuery(input: unknown): string {
  if (typeof input !== 'string') return '';
  // Limit to 100 characters
  let clean = input.trim().slice(0, 100);
  // Strip HTML tags
  clean = clean.replace(/<[^>]*>?/gm, '');
  // Disallow prompt injection phrases targeted at breaking AI prompts
  const injectionPatterns = [
    /ignore previous instructions/i,
    /system prompt/i,
    /you are now/i,
    /disregard/i,
    /<script/i,
  ];
  for (const pattern of injectionPatterns) {
    clean = clean.replace(pattern, '');
  }
  return clean.trim();
}

/**
 * Validates integer within a given range
 */
export function validateBoundedInt(value: unknown, min: number, max: number, fallback: number): number {
  const num = Number(value);
  if (isNaN(num)) return fallback;
  return Math.min(Math.max(Math.floor(num), min), max);
}

// ==========================================
// 5. SSRF DEFENSE & IMAGE PROXY WHITELISTING
// ==========================================

const TRUSTED_IMAGE_HOSTS = new Set([
  'bash.com',
  'www.bash.com',
  'tfg.co.za',
  'woolworths.co.za',
  'www.woolworths.co.za',
  'mrprice.com',
  'www.mrprice.com',
  'superbalist.com',
  'www.superbalist.com',
  'truworths.co.za',
  'www.truworths.co.za',
  'cottonon.com',
  'images.unsplash.com',
  'res.cloudinary.com',
  'scene7.com',
  'akamaihd.net',
  'cdn.shopify.com',
  'static.zara.net',
]);

const PRIVATE_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./, // AWS/GCP metadata service
  /^0\./,
  /^::1$/,
  /^fc00:/,
  /^fe80:/,
  /^localhost$/i
];

/**
 * Validates external URL for image proxying, blocking SSRF, loopback, and cloud metadata access
 */
export function isValidProxyImageUrl(targetUrl: string): { valid: boolean; reason?: string } {
  try {
    const parsed = new URL(targetUrl);

    // Only allow HTTPS
    if (parsed.protocol !== 'https:') {
      return { valid: false, reason: 'Only secure HTTPS protocols are permitted.' };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Check for private / metadata IP ranges
    for (const pattern of PRIVATE_IP_RANGES) {
      if (pattern.test(hostname)) {
        return { valid: false, reason: 'Private IP addresses and internal networks are forbidden.' };
      }
    }

    // Check domain whitelisting (exact or subdomain match)
    const isAllowedHost = Array.from(TRUSTED_IMAGE_HOSTS).some(
      (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`)
    );

    if (!isAllowedHost) {
      return { valid: false, reason: 'Image domain is not in the verified retailer or CDN whitelist.' };
    }

    return { valid: true };
  } catch {
    return { valid: false, reason: 'Invalid URL structure.' };
  }
}

// ==========================================
// 6. FIELD TAMPERING & RECORD ACCESS (RBAC)
// ==========================================

/**
 * Blocks mass-assignment / field tampering by whitelisting permitted keys
 */
export function validateAllowedPayloadFields<T extends Record<string, any>>(
  payload: Record<string, any>,
  allowedKeys: (keyof T)[]
): { valid: boolean; forbiddenKeys: string[] } {
  const allowedSet = new Set(allowedKeys as string[]);
  const forbiddenKeys: string[] = [];

  for (const key of Object.keys(payload)) {
    if (!allowedSet.has(key)) {
      forbiddenKeys.push(key);
    }
  }

  return {
    valid: forbiddenKeys.length === 0,
    forbiddenKeys
  };
}

/**
 * Row-level access check ensuring user ID matches record owner or admin role
 */
export function verifyRecordAccess(params: {
  userId: string;
  recordOwnerId: string;
  userRole?: 'user' | 'admin' | 'superadmin';
}): boolean {
  if (params.userRole === 'admin' || params.userRole === 'superadmin') {
    return true;
  }
  return params.userId === params.recordOwnerId;
}

// ==========================================
// 7. CRYPTOGRAPHIC UTILITIES & PASSWORDS
// ==========================================

/**
 * Secure password hashing using Node.js scrypt with cryptographic salt
 */
export function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

/**
 * Timing-safe password verification preventing side-channel attacks
 */
export function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) {
      resolve(false);
      return;
    }
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      const keyBuffer = Buffer.from(key, 'hex');
      const match = crypto.timingSafeEqual(derivedKey, keyBuffer);
      resolve(match);
    });
  });
}

/**
 * Cryptographically random session token generator
 */
export function generateSecureToken(byteLength = 32): string {
  return crypto.randomBytes(byteLength).toString('hex');
}

/**
 * Hardened cookie security flags
 */
export const SECURE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 24 * 60 * 60 * 1000 // 24 hours
};

/**
 * Parse incoming HTTP cookies safely without external dependencies
 */
export function parseCookies(req: Request): Record<string, string> {
  const list: Record<string, string> = {};
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return list;

  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const name = parts.shift()?.trim();
    if (name) {
      list[name] = decodeURIComponent(parts.join('='));
    }
  });
  return list;
}

// 256-bit key derived for AES-256-GCM data encryption
const ENCRYPTION_SECRET = crypto
  .createHash('sha256')
  .update(process.env.ENCRYPTION_KEY || process.env.GEMINI_API_KEY || 'haute-deals-fallback-vault-salt')
  .digest();

/**
 * Encrypt sensitive data using AES-256-GCM authenticated encryption
 */
export function encryptSensitiveData(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_SECRET, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt sensitive data using AES-256-GCM
 */
export function decryptSensitiveData(cipherPayload: string): string {
  const [ivHex, tagHex, encryptedHex] = cipherPayload.split(':');
  if (!ivHex || !tagHex || !encryptedHex) {
    throw new Error('Malformed cipher payload');
  }
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_SECRET, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

// ==========================================
// 8. SERVER-SIDE AUTH & ROW-LEVEL SECURITY
// ==========================================

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'user' | 'admin';
  createdAt: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

// In-memory session store mapping session tokens to authenticated user accounts
export const activeSessions = new Map<string, { user: AuthenticatedUser; expiresAt: number }>();

/**
 * Enforce server-side authentication on protected routes
 */
export function requireServerAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  // Check Authorization header (Bearer token) or secure session cookie
  const authHeader = req.headers.authorization;
  const cookies = parseCookies(req);
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : cookies['haute_session'];

  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please log in.' });
    return;
  }

  const session = activeSessions.get(token);
  if (!session) {
    res.status(401).json({ error: 'Invalid or expired session token.' });
    return;
  }

  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    res.status(401).json({ error: 'Session has expired. Please log in again.' });
    return;
  }

  req.user = session.user;
  next();
}

// ==========================================
// 9. RESPONSE TRIMMING & ERROR SANITIZATION
// ==========================================

/**
 * Sanitizes errors so internal traces, API keys, and stack info are never leaked
 */
export function sanitizeErrorMessage(error: any): string {
  if (!error) return 'An unexpected error occurred.';
  const raw = String(error?.message || error);
  // Strip out any accidental API keys or internal file paths
  const sanitized = raw
    .replace(/[A-Za-z0-9_-]{39}/g, '[REDACTED_KEY]')
    .replace(/\/[\w.-]+(\/[\w.-]+)+/g, '[INTERNAL_PATH]');
  return sanitized;
}
