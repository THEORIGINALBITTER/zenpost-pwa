import { loadZenStudioSettings, saveZenStudioSettings } from './zenStudioSettings';

export function getCloudSession() {
  const settings = loadZenStudioSettings();
  return {
    baseUrl: settings.cloudApiBaseUrl?.replace(/\/+$/, '') || null,
    token: settings.cloudAuthToken || null,
    userEmail: settings.cloudUserEmail || null,
    projectId: settings.cloudProjectId || null,
    projectName: settings.cloudProjectName || null,
    isLoggedIn: !!settings.cloudAuthToken,
  };
}

export function saveCloudSession(input) {
  return saveZenStudioSettings({
    cloudApiBaseUrl: input.baseUrl,
    cloudAuthToken: input.token,
    cloudUserEmail: input.userEmail || null,
    cloudProjectId: input.projectId ? Number(input.projectId) : null,
    cloudProjectName: input.projectName || null,
  });
}

export function clearCloudSession() {
  return saveZenStudioSettings({
    cloudAuthToken: null,
    cloudUserEmail: null,
    cloudProjectId: null,
    cloudProjectName: null,
  });
}

async function postJson(url, body) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { ok: res.ok, status: res.status, json, text };
  } catch {
    return { ok: false, status: 0, json: null, text: '' };
  }
}

export async function loginWithEmailPassword(email, password, baseUrlOverride) {
  const s = getCloudSession();
  const baseUrl = (baseUrlOverride || s.baseUrl || '').replace(/\/+$/, '');
  if (!baseUrl || !email || !password) return { success: false, error: 'missing-fields', message: 'Bitte E-Mail und Passwort angeben.' };

  const { ok, status, json, text } = await postJson(`${baseUrl}/login_api.php`, { email, password });
  if (!ok || !json?.success || !json?.token) {
    const raw = (text || '').trim();
    return {
      success: false,
      error: 'login-failed',
      status,
      message: json?.message || `Login fehlgeschlagen (HTTP ${status || 0}).`,
      debug: raw ? raw.slice(0, 400) : null,
    };
  }

  saveCloudSession({
    baseUrl,
    token: json.token,
    userEmail: email,
    projectId: null,
    projectName: null,
  });
  return { success: true, message: 'Login erfolgreich.' };
}

export async function registerWithEmailPassword(email, password, baseUrlOverride) {
  const s = getCloudSession();
  const baseUrl = (baseUrlOverride || s.baseUrl || '').replace(/\/+$/, '');
  if (!baseUrl || !email || !password) return { success: false, error: 'missing-fields', message: 'Bitte E-Mail und Passwort angeben.' };

  const { ok, status, json, text } = await postJson(`${baseUrl}/register_api.php`, { email, password });
  if (!ok || !json?.success || !json?.token) {
    // 409: Account exists -> seamless fallback to login
    if (status === 409) {
      const login = await loginWithEmailPassword(email, password, baseUrl);
      if (login.success) {
        return { success: true, message: 'E-Mail bereits registriert. Erfolgreich eingeloggt.' };
      }
    }
    return {
      success: false,
      error: 'register-failed',
      status,
      message: json?.message || `Registrierung fehlgeschlagen (HTTP ${status || 0}).`,
      debug: (text || '').trim().slice(0, 400) || null,
    };
  }

  saveCloudSession({
    baseUrl,
    token: json.token,
    userEmail: email,
    projectId: null,
    projectName: null,
  });
  return { success: true, message: 'Konto erstellt und eingeloggt.' };
}

export async function loadProjectsForSession() {
  const s = getCloudSession();
  if (!s.baseUrl || !s.token) return [];
  try {
    const res = await fetch(`${s.baseUrl}/projects_list.php`, {
      headers: { 'X-Auth-Token': s.token },
    });
    if (!res.ok) return [];
    const json = await res.json().catch(() => null);
    const raw = Array.isArray(json?.projects) ? json.projects : [];
    return raw
      .map((p) => ({ id: Number(p.id), name: p.name || `Projekt ${p.id}` }))
      .filter((p) => Number.isFinite(p.id) && p.id > 0);
  } catch {
    return [];
  }
}

export async function seedProjectForSession() {
  const s = getCloudSession();
  if (!s.baseUrl || !s.token) return null;
  try {
    const res = await fetch(`${s.baseUrl}/projects_seed.php`, {
      method: 'POST',
      headers: { 'X-Auth-Token': s.token },
    });
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    if (!json?.success || !json?.project?.id) return null;
    return { id: Number(json.project.id), name: json.project.name || `Projekt ${json.project.id}` };
  } catch {
    return null;
  }
}
