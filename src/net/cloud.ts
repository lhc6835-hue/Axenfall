// Accounts and cloud saves, talking to the Cloudflare Pages Function in functions/api.
import { onPersist, progressOf, replaceProgress, save, type Save } from '../game/save';

/**
 * Where the API lives. Served from Cloudflare Pages, the game and the API share an origin and this stays ''.
 * For the GitHub Pages copy, put the Cloudflare Pages address here (e.g. 'https://parry-cube.pages.dev').
 */
export const CLOUD_API: string = 'https://parrycube-api.celesta.workers.dev';

const TOKEN_KEY = 'parrycube_token';
const SYNC_KEY = 'parrycube_sync';

export type CloudStatus = 'off' | 'checking' | 'nodb' | 'out' | 'idle' | 'syncing' | 'error';

interface SyncMeta {
  user: string;
  rev: number;
  at: number;
}

export interface Summary {
  gold: number;
  weapons: number;
  skins: number;
  runs: number;
  bestTime: number;
  updated?: number;
}

export interface ConflictChoice {
  local: Summary;
  cloud: Summary;
  /** resolve with which copy to keep */
  choose: (keep: 'local' | 'cloud') => Promise<void>;
}

const listeners = new Set<() => void>();
let status: CloudStatus = 'checking';
let user = '';
let meta: SyncMeta | null = null;
let dirty = false;
let timer = 0;
let applying = false;
let onConflict: ((c: ConflictChoice) => void) | null = null;

const base = () => {
  // local development talks to `wrangler pages dev` through the Vite proxy
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return '';
  return CLOUD_API.replace(/\/$/, '');
};
const usable = () => !(location.hostname.endsWith('github.io') && !CLOUD_API);

function store<T>(k: string, v: T | null) {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  } catch {
    /* ignore */
  }
}
function read(k: string) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
const token = () => read(TOKEN_KEY);

function set(s: CloudStatus) {
  status = s;
  listeners.forEach((f) => f());
}

export const cloud = {
  get status() {
    return status;
  },
  get user() {
    return user;
  },
  get lastSync() {
    return meta?.at ?? 0;
  },
  subscribe(f: () => void) {
    listeners.add(f);
    return () => listeners.delete(f);
  },
  setConflictHandler(f: (c: ConflictChoice) => void) {
    onConflict = f;
  },
};

class ApiError extends Error {
  constructor(public code: string, public status: number, public body: Record<string, unknown> = {}) {
    super(code);
  }
}

async function api(path: string, init: RequestInit = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const t = token();
  if (t) headers.Authorization = `Bearer ${t}`;
  let r: Response;
  try {
    r = await fetch(`${base()}/api/${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string>) } });
  } catch {
    throw new ApiError('network', 0);
  }
  let b: Record<string, unknown> = {};
  try {
    b = await r.json();
  } catch {
    // a static host (no functions) answers with an HTML page
    throw new ApiError('no_server', r.status);
  }
  if (!r.ok) throw new ApiError(String(b.error ?? 'error'), r.status, b);
  return b;
}

export function summarize(s: Partial<Save>, updated?: number): Summary {
  return {
    gold: s.gold ?? 0,
    weapons: Object.keys(s.guns ?? {}).length + Object.keys(s.swords ?? {}).length,
    skins: (s.skins ?? []).length,
    runs: s.runs ?? 0,
    bestTime: s.best?.time ?? 0,
    updated,
  };
}

/** a fresh install with nothing worth keeping */
function isFresh(s: Save) {
  return s.runs === 0 && Object.keys(s.guns).length <= 1 && Object.keys(s.swords).length <= 1 && s.skins.length <= 1;
}

async function push(force = false) {
  if (!token() || !meta) return;
  window.clearTimeout(timer);
  dirty = false;
  set('syncing');
  try {
    const r = await api('save', { method: 'PUT', body: JSON.stringify({ data: progressOf(save), baseRev: meta.rev }) });
    meta = { user, rev: Number(r.rev), at: Date.now() };
    store(SYNC_KEY, meta);
    set('idle');
  } catch (e) {
    const err = e as ApiError;
    if (err.code === 'conflict' && !force) {
      await reconcile();
      return;
    }
    if (err.status === 401) return logoutLocal();
    dirty = true;
    set('error');
  }
}

function markDirty() {
  if (applying || !token() || !meta) return;
  dirty = true;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => push(), 1500);
}

/** compare the cloud copy with this device and settle on one */
async function reconcile() {
  set('syncing');
  const r = await api('save');
  const cloudData = r.data as Partial<Save> | null;
  const rev = Number(r.rev) || 0;
  meta = { user, rev, at: Date.now() };
  store(SYNC_KEY, meta);
  if (!cloudData) return push();
  if (isFresh(save)) return adopt(cloudData);
  // identical progress: nothing to ask
  if (JSON.stringify(progressOf(save)) === JSON.stringify(progressOf({ ...save, ...cloudData } as Save))) {
    set('idle');
    return;
  }
  if (!onConflict) return adopt(cloudData);
  set('idle');
  onConflict({
    local: summarize(save),
    cloud: summarize(cloudData, Number(r.updated) || 0),
    choose: async (keep) => {
      if (keep === 'cloud') adopt(cloudData);
      else await push(true);
    },
  });
}

function adopt(data: Partial<Save>) {
  applying = true;
  replaceProgress(data);
  applying = false;
  meta = { user, rev: meta?.rev ?? 0, at: Date.now() };
  store(SYNC_KEY, meta);
  set('idle');
  window.dispatchEvent(new Event('parrycube:progress'));
}

function logoutLocal() {
  store(TOKEN_KEY, null);
  store(SYNC_KEY, null);
  user = '';
  meta = null;
  set('out');
}

export async function initCloud() {
  onPersist.push(markDirty);
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && dirty) push();
  });
  if (!usable()) return set('off');
  try {
    if (!token()) {
      // a cheap probe tells us whether the API (and its database) is there at all
      await api('me').catch((e: ApiError) => {
        if (e.status === 401) return;
        throw e;
      });
      return set('out');
    }
    const me = await api('me');
    user = String(me.id);
    const saved = read(SYNC_KEY);
    meta = saved ? (JSON.parse(saved) as SyncMeta) : { user, rev: 0, at: 0 };
    if (meta.user !== user || Number(me.rev) !== meta.rev) await reconcile();
    else set('idle');
  } catch (e) {
    const err = e as ApiError;
    if (err.status === 401) return logoutLocal();
    set(err.code === 'no_database' ? 'nodb' : err.code === 'no_server' ? 'off' : 'error');
  }
}

export interface SwitchInfo {
  mode: 'login' | 'signup';
  /** what this device has now */
  local: Summary;
  /** what the account holds (login only; null when the account has nothing saved yet) */
  account: Summary | null;
}

/**
 * Sign in or sign up, then make this device follow the account: a new account starts from scratch,
 * an existing one replaces whatever this device had with its saved progress. When the device has
 * progress of its own, `confirm` is asked first; declining signs straight back out.
 */
export async function signIn(mode: 'login' | 'signup', id: string, pw: string, confirm: (info: SwitchInfo) => Promise<boolean>) {
  const r = await api(mode, { method: 'POST', body: JSON.stringify({ id, pw }) });
  store(TOKEN_KEY, String(r.token));
  let cloudData: Partial<Save> | null = null;
  let rev = 0;
  let updated = 0;
  try {
    if (mode === 'login') {
      const sv = await api('save');
      cloudData = (sv.data as Partial<Save> | null) ?? null;
      rev = Number(sv.rev) || 0;
      updated = Number(sv.updated) || 0;
    }
    if (!isFresh(save)) {
      const ok = await confirm({ mode, local: summarize(save), account: cloudData ? summarize(cloudData, updated) : null });
      if (!ok) throw new ApiError('cancelled', 0);
    }
  } catch (e) {
    // back out cleanly: this device keeps what it had
    try {
      await api('logout', { method: 'POST' });
    } catch {
      /* the token is dropped locally either way */
    }
    store(TOKEN_KEY, null);
    throw e;
  }
  user = String(r.id);
  meta = { user, rev, at: Date.now() };
  store(SYNC_KEY, meta);
  if (cloudData) {
    adopt(cloudData);
    return 'loaded' as const;
  }
  // a brand-new account (or one with nothing saved): a clean start, saved to the account at once
  applying = true;
  replaceProgress({});
  applying = false;
  window.dispatchEvent(new Event('parrycube:progress'));
  await push(true);
  return 'fresh' as const;
}

export async function signOut() {
  if (dirty) await push();
  try {
    await api('logout', { method: 'POST' });
  } catch {
    /* the token is dropped locally either way */
  }
  logoutLocal();
}

export async function syncNow() {
  if (!token()) return;
  if (dirty) return push();
  return reconcile();
}

export function errorText(e: unknown) {
  const code = (e as ApiError)?.code ?? 'error';
  return (
    {
      bad_id: '아이디는 영문·숫자·밑줄 3~16자',
      bad_pw: '비밀번호는 6~64자',
      bad_input: '입력값 오류',
      id_taken: '이미 사용 중인 아이디',
      bad_login: '아이디 또는 비밀번호 불일치',
      locked: '로그인 시도 초과. 1분 후 다시 시도',
      network: '서버 연결 실패',
      cancelled: '취소함. 이 기기의 진행은 그대로',
      no_server: '서버 미연결',
      no_database: '서버 데이터베이스 미연결',
    } as Record<string, string>
  )[code] ?? '오류 발생';
}
