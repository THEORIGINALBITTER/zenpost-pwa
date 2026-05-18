import { loadLocalProfile, saveLocalProfile, saveProfileToServer } from './profileService';

export const THEME_LIGHT = 'light';
export const THEME_DARK = 'dark';
const THEME_EVENT = 'zenpost:theme-change';

function normalizeTheme(mode) {
  return mode === THEME_DARK ? THEME_DARK : THEME_LIGHT;
}

export function getThemeMode() {
  return normalizeTheme(loadLocalProfile().themeMode);
}

export function applyThemeMode(mode) {
  const next = normalizeTheme(mode);
  document.documentElement.setAttribute('data-theme', next);
  document.body.style.background = next === THEME_DARK ? '#121212' : '';
}

export function subscribeThemeMode(callback) {
  const handler = (event) => callback(event.detail.mode);
  window.addEventListener(THEME_EVENT, handler);
  return () => window.removeEventListener(THEME_EVENT, handler);
}

export async function setThemeMode(mode) {
  const next = normalizeTheme(mode);
  saveLocalProfile({ themeMode: next });
  applyThemeMode(next);
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: { mode: next } }));
  await saveProfileToServer({ themeMode: next });
  return next;
}
