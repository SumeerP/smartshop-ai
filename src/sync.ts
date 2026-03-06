/**
 * SmartShop AI — Client Sync Engine
 *
 * Handles user authentication and background data sync with the Cloudflare Worker.
 * Session token stored in localStorage. Push is debounced (3s) to batch rapid changes.
 */

const API_BASE = 'https://smartshop-proxy.smartshop-proxy.workers.dev';

// Allow override for local development
function getBase() {
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:8787';
  }
  if (typeof window !== 'undefined' && window.location.hostname === '127.0.0.1') {
    return 'http://localhost:8787';
  }
  return API_BASE;
}

// --- State ---
const SESSION_KEY = '__ss_session_token';
const DEVICE_KEY = '__ss_device_id';
const ACCOUNTS_KEY = '__ss_accounts';
const LAST_SYNC_KEY = '__ss_last_sync';

function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function getToken(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

function setToken(token: string | null) {
  if (token) localStorage.setItem(SESSION_KEY, token);
  else localStorage.removeItem(SESSION_KEY);
}

// --- Public API ---

export function isLoggedIn(): boolean {
  return !!getToken();
}

export function getSessionToken(): string | null {
  return getToken();
}

export interface UserProfile {
  name: string;
  email: string;
  gender: string;
  age: string;
  skin: string;
  hair: string;
  interests: string[];
  budget: string;
}

export interface AuthResult {
  user: UserProfile;
  sessionToken: string;
  isNew?: boolean;
}

/**
 * Register a new account
 */
export async function register(
  profile: {
    name: string; email: string; gender?: string; age?: string;
    skin?: string; hair?: string; interests?: string[]; budget?: string;
  },
  password: string
): Promise<AuthResult> {
  const res = await fetch(`${getBase()}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...profile, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Registration failed');
  setToken(data.sessionToken);
  saveAccount(profile.email, profile.name);
  return data;
}

/**
 * Login with email + password
 */
export async function login(email: string, password: string): Promise<AuthResult> {
  const res = await fetch(`${getBase()}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  setToken(data.sessionToken);
  saveAccount(email, data.user.name);
  return data;
}

/**
 * Logout — invalidate server session + clear local token
 */
export async function logout(): Promise<void> {
  const token = getToken();
  if (token) {
    try {
      await fetch(`${getBase()}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-Token': token },
      });
    } catch {}
  }
  setToken(null);
  localStorage.removeItem(LAST_SYNC_KEY);
}

/**
 * Update user profile on server
 */
export async function updateProfile(updates: Partial<UserProfile>): Promise<UserProfile | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch(`${getBase()}/api/user/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Session-Token': token },
      body: JSON.stringify(updates),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user;
  } catch { return null; }
}

// --- Sync ---

export interface SyncPayload {
  saved: Array<{ product_id: string; product_json: string }>;
  buys: Array<{ product_id: string; product_json: string; retailer: string; purchased_at: string }>;
  searches: string[];
  threads: Array<{ thread_cid: string; name: string; created_at: string; updated_at: string }>;
  thread_data: Record<string, any>;
  viewed: Array<{ product_id: string; product_json: string }>;
}

export interface ServerData {
  user: UserProfile;
  saved: Array<{ product_id: string; product_json: string }>;
  buys: Array<{ product_id: string; product_json: string; retailer: string; purchased_at: string }>;
  searches: string[];
  threads: Array<{ thread_cid: string; name: string; created_at: string; updated_at: string }>;
  thread_data: Record<string, any>;
  viewed: Array<{ product_id: string; product_json: string }>;
  synced_at: string;
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let syncInFlight = false;

/**
 * Schedule a debounced push sync (3s delay, batches rapid changes)
 */
export function schedulePush(getData: () => SyncPayload) {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    pushSync(getData()).catch(() => {});
  }, 3000);
}

/**
 * Push local state to server
 */
export async function pushSync(data: SyncPayload): Promise<boolean> {
  const token = getToken();
  if (!token || syncInFlight) return false;
  syncInFlight = true;
  try {
    const res = await fetch(`${getBase()}/api/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Session-Token': token },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const result = await res.json();
      localStorage.setItem(LAST_SYNC_KEY, result.synced_at);
      return true;
    }
    return false;
  } catch {
    return false;
  } finally {
    syncInFlight = false;
  }
}

/**
 * Pull full state from server
 */
export async function pullSync(): Promise<ServerData | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch(`${getBase()}/api/sync/pull`, {
      headers: { 'X-Session-Token': token },
    });
    if (!res.ok) {
      if (res.status === 401) setToken(null); // token expired
      return null;
    }
    const data = await res.json();
    localStorage.setItem(LAST_SYNC_KEY, data.synced_at);
    return data;
  } catch {
    return null;
  }
}

// --- Accounts Management ---

export interface SavedAccount {
  email: string;
  name: string;
}

function saveAccount(email: string, name: string) {
  const accounts = getAccounts();
  const existing = accounts.find(a => a.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    existing.name = name;
  } else {
    accounts.push({ email, name });
  }
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function getAccounts(): SavedAccount[] {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function removeAccount(email: string) {
  const accounts = getAccounts().filter(a => a.email.toLowerCase() !== email.toLowerCase());
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function getLastSyncTime(): string | null {
  return localStorage.getItem(LAST_SYNC_KEY);
}
