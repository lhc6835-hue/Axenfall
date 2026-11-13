// Cloudflare Pages Function: accounts and cloud saves for PARRY CUBE.
// Bind a D1 database to the Pages project under the variable name `DB`.
// Tables are created on first use, so no manual migration is needed.
//
//   POST /api/signup  { id, pw }        -> { token, id }
//   POST /api/login   { id, pw }        -> { token, id }
//   POST /api/logout                     (Authorization: Bearer <token>)
//   GET  /api/me                         -> { id, rev, updated }
//   GET  /api/save                       -> { data, rev, updated } | { data: null, rev: 0 }
//   PUT  /api/save    { data, baseRev }  -> { rev, updated }  | 409 { rev, updated } when the server copy is newer

interface D1Result<T> { results: T[] }
interface D1Stmt {
  bind(...v: unknown[]): D1Stmt;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}
interface D1Database { prepare(sql: string): D1Stmt; batch(s: D1Stmt[]): Promise<unknown>; exec(sql: string): Promise<unknown> }
interface Env { DB?: D1Database; ALLOWED_ORIGINS?: string }
interface Ctx { request: Request; env: Env; params: { route?: string[] } }

const PBKDF2_ITER = 100_000; // the Workers runtime caps PBKDF2 at 100k iterations
const SESSION_DAYS = 30;
const MAX_SAVE_BYTES = 64 * 1024;
const MAX_FAILS = 5;
const LOCK_MS = 60_000;
const DEFAULT_ORIGINS = ['https://lhc6835-hue.github.io', 'http://localhost:5173', 'http://localhost:4173'];

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
     id TEXT PRIMARY KEY, name TEXT NOT NULL, pw_hash TEXT NOT NULL, salt TEXT NOT NULL, iter INTEGER NOT NULL,
     fails INTEGER NOT NULL DEFAULT 0, lock_until INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS sessions (
     token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, created INTEGER NOT NULL, expires INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id)`,
  `CREATE TABLE IF NOT EXISTS saves (
     user_id TEXT PRIMARY KEY, data TEXT NOT NULL, rev INTEGER NOT NULL, updated INTEGER NOT NULL)`,
];
let schemaReady = false;

// ---------------- helpers ----------------
const enc = new TextEncoder();
const b64u = (buf: ArrayBuffer | Uint8Array) => {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64u = (s: string) => {
  const t = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(t.length);
  for (let i = 0; i < t.length; i++) out[i] = t.charCodeAt(i);
  return out;
};
const randomB64u = (n: number) => b64u(crypto.getRandomValues(new Uint8Array(n)));

async function hashPw(pw: string, salt: Uint8Array, iter: number) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256);
  return b64u(bits);
}
async function sha256(s: string) {
  return b64u(await crypto.subtle.digest('SHA-256', enc.encode(s)));
}
function sameString(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

function corsHeaders(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('Origin');
  const allowed = (env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()) : DEFAULT_ORIGINS);
  const self = new URL(req.url).origin;
  if (!origin || (origin !== self && !allowed.includes(origin))) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}
function json(req: Request, env: Env, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...corsHeaders(req, env) },
  });
}
const fail = (req: Request, env: Env, status: number, code: string) => json(req, env, { error: code }, status);

async function body<T>(req: Request): Promise<T | null> {
  try {
    const t = await req.text();
    if (t.length > MAX_SAVE_BYTES + 1024) return null;
    return JSON.parse(t) as T;
  } catch {
    return null;
  }
}

const ID_RE = /^[a-z0-9_]{3,16}$/;
function checkCreds(id: unknown, pw: unknown): { id: string; name: string; pw: string } | string {
  if (typeof id !== 'string' || typeof pw !== 'string') return 'bad_input';
  const name = id.trim();
  const key = name.toLowerCase();
  if (!ID_RE.test(key)) return 'bad_id';
  if (pw.length < 6 || pw.length > 64) return 'bad_pw';
  return { id: key, name, pw };
}

async function ensureSchema(db: D1Database) {
  if (schemaReady) return;
  await db.batch(SCHEMA.map((s) => db.prepare(s)));
  schemaReady = true;
}

async function newSession(db: D1Database, userId: string) {
  const token = randomB64u(32);
  const now = Date.now();
  await db
    .prepare('INSERT INTO sessions (token_hash, user_id, created, expires) VALUES (?, ?, ?, ?)')
    .bind(await sha256(token), userId, now, now + SESSION_DAYS * 86400_000)
    .run();
  // keep the table tidy
  await db.prepare('DELETE FROM sessions WHERE expires < ?').bind(now).run();
  return token;
}

async function authed(req: Request, db: D1Database): Promise<string | null> {
  const h = req.headers.get('Authorization') || '';
  const m = /^Bearer ([A-Za-z0-9_-]{20,})$/.exec(h);
  if (!m) return null;
  const row = await db
    .prepare('SELECT user_id, expires FROM sessions WHERE token_hash = ?')
    .bind(await sha256(m[1]))
    .first<{ user_id: string; expires: number }>();
  if (!row || row.expires < Date.now()) return null;
  return row.user_id;
}

// ---------------- routes ----------------
export async function onRequest(ctx: Ctx): Promise<Response> {
  const { request: req, env } = ctx;
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req, env) });
  const db = env.DB;
  if (!db) return fail(req, env, 503, 'no_database');
  await ensureSchema(db);
  const route = (ctx.params.route || []).join('/');

  try {
    if (route === 'signup' && req.method === 'POST') {
      const b = await body<{ id: unknown; pw: unknown }>(req);
      const c = checkCreds(b?.id, b?.pw);
      if (typeof c === 'string') return fail(req, env, 400, c);
      const exists = await db.prepare('SELECT 1 FROM users WHERE id = ?').bind(c.id).first();
      if (exists) return fail(req, env, 409, 'id_taken');
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const h = await hashPw(c.pw, salt, PBKDF2_ITER);
      await db
        .prepare('INSERT INTO users (id, name, pw_hash, salt, iter, created) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(c.id, c.name, h, b64u(salt), PBKDF2_ITER, Date.now())
        .run();
      return json(req, env, { token: await newSession(db, c.id), id: c.name });
    }

    if (route === 'login' && req.method === 'POST') {
      const b = await body<{ id: unknown; pw: unknown }>(req);
      const c = checkCreds(b?.id, b?.pw);
      if (typeof c === 'string') return fail(req, env, 401, 'bad_login');
      const u = await db
        .prepare('SELECT id, name, pw_hash, salt, iter, fails, lock_until FROM users WHERE id = ?')
        .bind(c.id)
        .first<{ id: string; name: string; pw_hash: string; salt: string; iter: number; fails: number; lock_until: number }>();
      if (!u) {
        // spend about the same time as a real check so ids can't be probed by timing
        await hashPw(c.pw, crypto.getRandomValues(new Uint8Array(16)), PBKDF2_ITER);
        return fail(req, env, 401, 'bad_login');
      }
      if (u.lock_until > Date.now()) return fail(req, env, 429, 'locked');
      const h = await hashPw(c.pw, fromB64u(u.salt), u.iter);
      if (!sameString(h, u.pw_hash)) {
        const fails = u.fails + 1;
        const lock = fails >= MAX_FAILS ? Date.now() + LOCK_MS : 0;
        await db.prepare('UPDATE users SET fails = ?, lock_until = ? WHERE id = ?').bind(lock ? 0 : fails, lock, u.id).run();
        return fail(req, env, lock ? 429 : 401, lock ? 'locked' : 'bad_login');
      }
      await db.prepare('UPDATE users SET fails = 0, lock_until = 0 WHERE id = ?').bind(u.id).run();
      return json(req, env, { token: await newSession(db, u.id), id: u.name });
    }

    if (route === 'logout' && req.method === 'POST') {
      const h = req.headers.get('Authorization') || '';
      const m = /^Bearer ([A-Za-z0-9_-]{20,})$/.exec(h);
      if (m) await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(m[1])).run();
      return json(req, env, { ok: true });
    }

    const user = await authed(req, db);
    if (!user) return fail(req, env, 401, 'not_logged_in');

    if (route === 'me' && req.method === 'GET') {
      const u = await db.prepare('SELECT name FROM users WHERE id = ?').bind(user).first<{ name: string }>();
      const s = await db.prepare('SELECT rev, updated FROM saves WHERE user_id = ?').bind(user).first<{ rev: number; updated: number }>();
      return json(req, env, { id: u?.name ?? user, rev: s?.rev ?? 0, updated: s?.updated ?? 0 });
    }

    if (route === 'save' && req.method === 'GET') {
      const s = await db.prepare('SELECT data, rev, updated FROM saves WHERE user_id = ?').bind(user).first<{ data: string; rev: number; updated: number }>();
      if (!s) return json(req, env, { data: null, rev: 0, updated: 0 });
      return json(req, env, { data: JSON.parse(s.data), rev: s.rev, updated: s.updated });
    }

    if (route === 'save' && req.method === 'PUT') {
      const b = await body<{ data: unknown; baseRev: unknown }>(req);
      if (!b || typeof b.data !== 'object' || b.data === null || typeof b.baseRev !== 'number') return fail(req, env, 400, 'bad_input');
      const text = JSON.stringify(b.data);
      if (text.length > MAX_SAVE_BYTES) return fail(req, env, 413, 'too_big');
      const cur = await db.prepare('SELECT rev, updated FROM saves WHERE user_id = ?').bind(user).first<{ rev: number; updated: number }>();
      const curRev = cur?.rev ?? 0;
      // someone else (another device) saved since this client last synced
      if (b.baseRev !== curRev) return json(req, env, { error: 'conflict', rev: curRev, updated: cur?.updated ?? 0 }, 409);
      const now = Date.now();
      const rev = curRev + 1;
      await db
        .prepare('INSERT INTO saves (user_id, data, rev, updated) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, rev = excluded.rev, updated = excluded.updated WHERE saves.rev = ?')
        .bind(user, text, rev, now, curRev)
        .run();
      return json(req, env, { rev, updated: now });
    }

    return fail(req, env, 404, 'not_found');
  } catch (e) {
    console.error(e);
    return fail(req, env, 500, 'server_error');
  }
}
