const ZEN_STUDIO_SETTINGS_STORAGE_KEY = 'zenpost_zen_studio_settings';
const DEFAULT_BASE_URL = 'https://denisbitter.de/stage02/api';

export function loadZenStudioSettings() {
  try {
    const raw = localStorage.getItem(ZEN_STUDIO_SETTINGS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      cloudApiBaseUrl: DEFAULT_BASE_URL,
      cloudAuthToken: parsed.cloudAuthToken || null,
      cloudUserEmail: parsed.cloudUserEmail || null,
      cloudProjectId: typeof parsed.cloudProjectId === 'number' ? parsed.cloudProjectId : null,
      cloudProjectName: parsed.cloudProjectName || null,
    };
  } catch {
    return {
      cloudApiBaseUrl: DEFAULT_BASE_URL,
      cloudAuthToken: null,
      cloudUserEmail: null,
      cloudProjectId: null,
      cloudProjectName: null,
    };
  }
}

export function saveZenStudioSettings(patch) {
  const current = loadZenStudioSettings();
  const next = { ...current, ...patch, cloudApiBaseUrl: DEFAULT_BASE_URL };
  localStorage.setItem(ZEN_STUDIO_SETTINGS_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export { DEFAULT_BASE_URL };
