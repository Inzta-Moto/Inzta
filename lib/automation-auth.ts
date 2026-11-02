import { createHash, timingSafeEqual } from 'crypto';

// F-010 (ADR-0020): the inzta-hq pipeline publishes articles with a per-person bearer token instead of an admin
// session. Each person has one Vercel variable AUTOMATION_TOKEN_<NAME> (for example AUTOMATION_TOKEN_ANGKASA);
// <NAME> in lower case becomes the actor stored on the article, so one token can be revoked without the others.
const PREFIX = 'AUTOMATION_TOKEN_';
const NAME_PATTERN = /^[A-Z][A-Z0-9]{1,31}$/;
// 32 characters is the floor for a random token (openssl rand -base64 32 gives 44); shorter values are ignored.
export const MIN_TOKEN_LENGTH = 32;

export type AutomationCheck =
  | { ok: true; actor: string }
  | { ok: false; status: 401 | 503; error: string };

type Env = Record<string, string | undefined>;

const digest = (value: string) => createHash('sha256').update(value).digest();

function configuredTokens(env: Env): { actor: string; digest: Buffer }[] {
  const tokens: { actor: string; digest: Buffer }[] = [];
  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith(PREFIX) || !value) continue;
    const name = key.slice(PREFIX.length);
    const token = value.trim();
    if (!NAME_PATTERN.test(name)) continue;
    if (token.length < MIN_TOKEN_LENGTH) {
      // Names only, never values: a short token in Vercel is a setup mistake the owner has to see in the logs.
      console.error('Automation token ignored: shorter than the minimum length', { variable: key });
      continue;
    }
    tokens.push({ actor: name.toLowerCase(), digest: digest(token) });
  }
  return tokens;
}

/**
 * Checks `Authorization: Bearer <token>` against every configured AUTOMATION_TOKEN_<NAME>.
 * Comparison is on SHA-256 digests with timingSafeEqual, so the buffers always have the same length and the time
 * taken does not depend on how much of the token matched. Every token is compared, with no early return.
 * No configured token means the feature is off (503), which keeps a missing Vercel variable distinguishable from a
 * wrong token without revealing anything about the tokens themselves.
 */
export function requireAutomationToken(request: Request, env: Env = process.env): AutomationCheck {
  const tokens = configuredTokens(env);
  if (tokens.length === 0) {
    console.error('Automation route called but no AUTOMATION_TOKEN_<NAME> is configured');
    return { ok: false, status: 503, error: 'Otomasi artikel belum diaktifkan di server' };
  }

  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(\S+)$/i);
  if (!match) return { ok: false, status: 401, error: 'Unauthorized' };

  const provided = digest(match[1]);
  let actor: string | null = null;
  for (const token of tokens) {
    if (timingSafeEqual(provided, token.digest) && actor === null) actor = token.actor;
  }
  if (!actor) {
    console.warn('Automation route: wrong token');
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  return { ok: true, actor };
}

// Best effort only: serverless instances do not share memory, so this caps a runaway loop on one instance, not a
// determined attacker (who would need a valid token first).
const WINDOW_MS = 60 * 60 * 1000;
export const AUTOMATION_RATE_LIMIT = 20;
const hits = new Map<string, number[]>();

export function allowAutomationRequest(actor: string, now = Date.now()): boolean {
  const recent = (hits.get(actor) || []).filter(t => now - t < WINDOW_MS);
  if (recent.length >= AUTOMATION_RATE_LIMIT) {
    hits.set(actor, recent);
    return false;
  }
  recent.push(now);
  hits.set(actor, recent);
  return true;
}

/** Tests only. */
export function resetAutomationRateLimit() {
  hits.clear();
}
