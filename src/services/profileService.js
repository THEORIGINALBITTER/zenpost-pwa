import { getCloudSession } from './cloudAuthService';

const PROFILE_STORAGE_KEY = 'zenpost_pwa_profile_v1';
export const DEFAULT_AVATAR_URL = 'https://denisbitter.de/images/responsive/deni_round-128.webp';
export const DEFAULT_THEME_MODE = 'light';

function parseProfile(raw) {
  try {
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      avatarUrl: typeof parsed.avatarUrl === 'string' && parsed.avatarUrl.trim() ? parsed.avatarUrl.trim() : DEFAULT_AVATAR_URL,
      themeMode: parsed.themeMode === 'dark' ? 'dark' : DEFAULT_THEME_MODE,
    };
  } catch {
    return { avatarUrl: DEFAULT_AVATAR_URL, themeMode: DEFAULT_THEME_MODE };
  }
}

export function loadLocalProfile() {
  return parseProfile(localStorage.getItem(PROFILE_STORAGE_KEY));
}

export function saveLocalProfile(patch) {
  const current = loadLocalProfile();
  const next = { ...current, ...patch };
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function loadProfileFromServer() {
  const s = getCloudSession();
  if (!s.baseUrl || !s.token) return { success: false, profile: loadLocalProfile() };
  try {
    const res = await fetch(`${s.baseUrl}/profile_get.php`, {
      headers: { 'X-Auth-Token': s.token },
    });
    if (!res.ok) return { success: false, profile: loadLocalProfile() };
    const json = await res.json().catch(() => null);
    const serverAvatar = typeof json?.profile?.avatarUrl === 'string' ? json.profile.avatarUrl.trim() : '';
    const serverTheme = json?.profile?.themeMode === 'dark' ? 'dark' : 'light';
    if (serverAvatar || json?.profile?.themeMode) {
      const next = saveLocalProfile({
        avatarUrl: serverAvatar || loadLocalProfile().avatarUrl,
        themeMode: serverTheme,
      });
      return { success: true, profile: next };
    }
    return { success: false, profile: loadLocalProfile() };
  } catch {
    return { success: false, profile: loadLocalProfile() };
  }
}

export async function saveProfileToServer(patch) {
  const local = saveLocalProfile(patch);
  const s = getCloudSession();
  if (!s.baseUrl || !s.token) return { success: true, synced: false, profile: local };
  try {
    const res = await fetch(`${s.baseUrl}/profile_update.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': s.token,
      },
      body: JSON.stringify({ profile: { avatarUrl: local.avatarUrl, themeMode: local.themeMode } }),
    });
    const json = await res.json().catch(() => null);
    return { success: !!(res.ok && json?.success), synced: !!(res.ok && json?.success), profile: local };
  } catch {
    return { success: true, synced: false, profile: local };
  }
}
