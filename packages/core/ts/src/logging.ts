// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Structured JSON logger for TypeScript services.

type Level = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const ORDER: Level[] = ['debug', 'info', 'warn', 'error', 'fatal'];

function shouldLog(msgLevel: Level, configLevel: Level): boolean {
  return ORDER.indexOf(msgLevel) >= ORDER.indexOf(configLevel);
}

/**
 * Field names whose values must never appear in dev logs. Mirror this list in
 * packages/core/go/logging/redact.go and packages/core/python/caracalai_core/logging.py.
 */
export const SECRET_KEYS: readonly string[] = Object.freeze([
  'password',
  'secret',
  'token',
  'access_token',
  'refresh_token',
  'id_token',
  'api_key',
  'client_secret',
  'private_key',
  'session',
  'assertion',
  'authorization',
  'cookie',
  'set_cookie',
  'set-cookie',
  'hmac',
  'signature',
]);

export const REDACT_VALUE = '***';

export function isSecretKey(name: string): boolean {
  const lower = name.toLowerCase();
  return SECRET_KEYS.some((k) => lower.includes(k));
}

/**
 * Returns a deep copy of `value` with any field whose key matches SECRET_KEYS
 * replaced with REDACT_VALUE. Arrays and primitives are passed through.
 */
export function redact<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(redact) as unknown as T;
  if (typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = isSecretKey(k) ? REDACT_VALUE : redact(v);
  }
  return out as T;
}

export type Logger = {
  debug: (msg: string, fields?: Record<string, unknown>) => void;
  info: (msg: string, fields?: Record<string, unknown>) => void;
  warn: (msg: string, fields?: Record<string, unknown>) => void;
  error: (msg: string, fields?: Record<string, unknown>) => void;
  fatal: (msg: string, fields?: Record<string, unknown>) => void;
  with: (fields: Record<string, unknown>) => Logger;
};

export function createLogger(service: string, level: Level = 'info'): Logger {
  const baseFields = { service };
  return makeLogger(baseFields, level, process.stderr);
}

function makeLogger(
  bound: Record<string, unknown>,
  level: Level,
  stream: NodeJS.WritableStream,
): Logger {
  const emit = (msgLevel: Level, msg: string, fields?: Record<string, unknown>): void => {
    if (!shouldLog(msgLevel, level)) return;
    const safe = fields ? (redact(fields) as Record<string, unknown>) : undefined;
    stream.write(
      JSON.stringify({
        level: msgLevel,
        ...bound,
        msg,
        time: new Date().toISOString(),
        ...safe,
      }) + '\n',
    );
  };
  return {
    debug: (msg, fields) => emit('debug', msg, fields),
    info: (msg, fields) => emit('info', msg, fields),
    warn: (msg, fields) => emit('warn', msg, fields),
    error: (msg, fields) => emit('error', msg, fields),
    fatal: (msg, fields) => emit('fatal', msg, fields),
    with: (fields) => makeLogger({ ...bound, ...(redact(fields) as Record<string, unknown>) }, level, stream),
  };
}

