import { createHmac, timingSafeEqual } from 'crypto';
import { getSessionSecret } from '../config/env.validation';

/** The guest's proof of membership in a table session. Scoped to /m/<slug>. */
export const TABLE_SESSION_COOKIE = 'qaemati_ts';

/** How long a socket ticket lives. It only has to survive the handshake. */
export const TICKET_TTL_MS = 60_000;

const DEFAULT_IDLE_HOURS = 6;

/** How long a session may sit without activity before it counts as closed. */
export function sessionIdleMs(raw: string | undefined = process.env.TABLE_SESSION_IDLE_HOURS) {
  const hours = Number(raw);
  return (Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_IDLE_HOURS) * 3_600_000;
}

export function isSessionIdle(lastActivityAt: Date, now: Date, idleMs = sessionIdleMs()): boolean {
  return now.getTime() - lastActivityAt.getTime() >= idleMs;
}

const mac = (purpose: string, payload: string): string =>
  createHmac('sha256', getSessionSecret()).update(`${purpose}|${payload}`).digest('base64url');

const safeEqual = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

/** The cookie value: the session id and a signature, so it cannot be forged or edited. */
export function signSessionCookie(sessionId: string): string {
  return `${sessionId}.${mac('cookie', sessionId)}`;
}

/** The session id inside a cookie value, or null when it is missing or tampered with. */
export function readSessionCookie(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const dot = value.lastIndexOf('.');
  if (dot <= 0) return null;
  const id = value.slice(0, dot);
  return safeEqual(value.slice(dot + 1), mac('cookie', id)) ? id : null;
}

/**
 * A short lived stand-in for the cookie, for the websocket handshake: the
 * cookie is scoped to /m/<slug> and the browser does not send it to /socket.io.
 * Different signing purpose, so a ticket is never accepted as a cookie.
 */
export function signSocketTicket(sessionId: string, now = Date.now()): string {
  const expires = String(now + TICKET_TTL_MS);
  return `${sessionId}.${expires}.${mac('ticket', `${sessionId}.${expires}`)}`;
}

export function readSocketTicket(value: unknown, now = Date.now()): string | null {
  if (typeof value !== 'string') return null;
  const parts = value.split('.');
  if (parts.length !== 3) return null;
  const [id, expires, signature] = parts;
  if (!safeEqual(signature, mac('ticket', `${id}.${expires}`))) return null;
  return Number(expires) > now ? id : null;
}
