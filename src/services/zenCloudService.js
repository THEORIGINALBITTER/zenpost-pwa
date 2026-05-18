import { getCloudSession } from './cloudAuthService';

const PLANNER_FILENAME = '__zenpost_planner.json';
const CACHED_PLANNER_DOC_ID_KEY = 'zenpost_pwa_cloud_planner_doc_id';
const SCHEDULE_FILENAME = '__zenpost_schedule.json';
const CACHED_SCHEDULE_DOC_ID_KEY = 'zenpost_pwa_cloud_schedule_doc_id';

function auth() {
  const s = getCloudSession();
  if (!s.baseUrl || !s.token) return null;
  return s;
}

export function getCloudImageUrl(docId) {
  const s = auth();
  if (!s || !docId) return null;
  return `${s.baseUrl}/image_download.php?id=${docId}&token=${encodeURIComponent(s.token)}`;
}

export async function uploadImageFileToZenCloud(file) {
  const s = auth();
  if (!s || !s.projectId || !file) return null;
  const form = new FormData();
  form.append('projectId', String(s.projectId));
  form.append('file', file);
  const res = await fetch(`${s.baseUrl}/documents_upload.php`, {
    method: 'POST',
    headers: { 'X-Auth-Token': s.token },
    body: form,
  });
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  if (!json?.success || !json?.id) return null;
  return { id: json.id, url: getCloudImageUrl(json.id) };
}

export async function listZenCloudImages() {
  const s = auth();
  if (!s || !s.projectId) return [];
  const res = await fetch(`${s.baseUrl}/documents_list.php?projectId=${s.projectId}`, {
    headers: { 'X-Auth-Token': s.token },
  });
  if (!res.ok) return [];
  const json = await res.json().catch(() => null);
  if (!json?.success || !Array.isArray(json.documents)) return [];
  return json.documents
    .filter((d) => String(d.mime_type || '').startsWith('image/'))
    .map((d) => ({
      id: d.id,
      fileName: d.file_name,
      createdAt: d.created_at,
      url: getCloudImageUrl(d.id),
    }));
}

export async function listZenCloudDocuments() {
  const s = auth();
  if (!s || !s.projectId) return [];
  const res = await fetch(`${s.baseUrl}/documents_list.php?projectId=${s.projectId}`, {
    headers: { 'X-Auth-Token': s.token },
  });
  if (!res.ok) return [];
  const json = await res.json().catch(() => null);
  if (!json?.success || !Array.isArray(json.documents)) return [];
  return json.documents.map((d) => ({
    id: Number(d.id),
    fileName: String(d.file_name || ''),
    mimeType: String(d.mime_type || ''),
    createdAt: d.created_at || '',
    size: Number(d.file_size || 0),
    imageUrl: String(d.mime_type || '').startsWith('image/') ? getCloudImageUrl(d.id) : '',
  }));
}

function createTextFile(content, fileName) {
  return new File([content], fileName, { type: 'application/json' });
}

export async function listZenCloudZenNotes() {
  const s = auth();
  if (!s || !s.projectId) return [];
  const res = await fetch(`${s.baseUrl}/documents_list.php?projectId=${s.projectId}`, {
    headers: { 'X-Auth-Token': s.token },
  });
  if (!res.ok) return [];
  const json = await res.json().catch(() => null);
  if (!json?.success || !Array.isArray(json.documents)) return [];
  return json.documents
    .filter((d) => {
      const name = String(d.file_name || '').toLowerCase();
      const mime = String(d.mime_type || '').toLowerCase();
      if (name.endsWith('.zennote')) return true;
      if (name.endsWith('.md')) return true;
      if (mime.startsWith('text/')) return true;
      if (mime.includes('json') && name.includes('zennote')) return true;
      return false;
    })
    .map((d) => ({
      id: Number(d.id),
      fileName: d.file_name,
      createdAt: d.created_at,
      mimeType: d.mime_type || '',
    }))
    .filter((d) => Number.isFinite(d.id) && d.id > 0);
}

export async function downloadZenCloudDocumentText(docId) {
  const s = auth();
  if (!s || !docId) return null;
  const res = await fetch(`${s.baseUrl}/documents_download.php?id=${docId}`, {
    headers: { 'X-Auth-Token': s.token },
  });
  if (!res.ok) return null;
  return res.text().catch(() => null);
}

export async function createZenCloudZenNote(note) {
  const s = auth();
  if (!s || !s.projectId) return null;
  const safeTitle = String(note.title || 'quick-note')
    .replace(/[^a-zA-Z0-9\-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'quick-note';
  const fileName = `zennote-${Date.now()}-${safeTitle}.zennote`;
  const payload = JSON.stringify(note);
  const file = createTextFile(payload, fileName);
  const form = new FormData();
  form.append('projectId', String(s.projectId));
  form.append('file', file);
  const res = await fetch(`${s.baseUrl}/documents_upload.php`, {
    method: 'POST',
    headers: { 'X-Auth-Token': s.token },
    body: form,
  });
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  if (!json?.success || !json?.id) return null;
  return Number(json.id);
}

export async function updateZenCloudZenNote(docId, note) {
  const s = auth();
  if (!s || !docId) return false;
  const safeTitle = String(note.title || 'quick-note')
    .replace(/[^a-zA-Z0-9\-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'quick-note';
  const fileName = `zennote-${safeTitle}.zennote`;
  const payload = JSON.stringify(note);
  const file = createTextFile(payload, fileName);
  const form = new FormData();
  form.append('id', String(docId));
  form.append('file', file);
  const res = await fetch(`${s.baseUrl}/documents_update.php`, {
    method: 'POST',
    headers: { 'X-Auth-Token': s.token },
    body: form,
  });
  if (!res.ok) return false;
  const json = await res.json().catch(() => null);
  return !!json?.success;
}

export async function deleteZenCloudDocument(docId) {
  const s = auth();
  if (!s || !docId) return false;
  const res = await fetch(`${s.baseUrl}/documents_delete.php`, {
    method: 'POST',
    headers: { 'X-Auth-Token': s.token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: docId }),
  });
  if (!res.ok) return false;
  const json = await res.json().catch(() => null);
  return !!json?.success;
}

export async function createZenCloudArticleDraft(draft) {
  const s = auth();
  if (!s || !s.projectId) return null;
  const safeTitle = String(draft.title || 'artikel-entwurf')
    .replace(/[^a-zA-Z0-9\-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50) || 'artikel-entwurf';
  const fileName = `article-${Date.now()}-${safeTitle}.zenpost.json`;
  const payload = JSON.stringify(draft);
  const file = createTextFile(payload, fileName);
  const form = new FormData();
  form.append('projectId', String(s.projectId));
  form.append('file', file);
  const res = await fetch(`${s.baseUrl}/documents_upload.php`, {
    method: 'POST',
    headers: { 'X-Auth-Token': s.token },
    body: form,
  });
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  if (!json?.success || !json?.id) return null;
  return Number(json.id);
}

function getCachedPlannerDocId() {
  try {
    const raw = localStorage.getItem(CACHED_PLANNER_DOC_ID_KEY);
    if (!raw) return null;
    const id = Number(raw);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

function setCachedPlannerDocId(id) {
  try {
    if (id === null) localStorage.removeItem(CACHED_PLANNER_DOC_ID_KEY);
    else localStorage.setItem(CACHED_PLANNER_DOC_ID_KEY, String(id));
  } catch {
    // ignore
  }
}

function getCachedScheduleDocId() {
  try {
    const raw = localStorage.getItem(CACHED_SCHEDULE_DOC_ID_KEY);
    if (!raw) return null;
    const id = Number(raw);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

function setCachedScheduleDocId(id) {
  try {
    if (id === null) localStorage.removeItem(CACHED_SCHEDULE_DOC_ID_KEY);
    else localStorage.setItem(CACHED_SCHEDULE_DOC_ID_KEY, String(id));
  } catch {
    // ignore
  }
}

async function findPlannerDocId() {
  const s = auth();
  if (!s || !s.projectId) return null;
  const res = await fetch(`${s.baseUrl}/documents_list.php?projectId=${s.projectId}`, {
    headers: { 'X-Auth-Token': s.token },
  });
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  if (!json?.success || !Array.isArray(json.documents)) return null;
  const doc = json.documents.find((d) => String(d.file_name || '') === PLANNER_FILENAME);
  return doc?.id ? Number(doc.id) : null;
}

async function findScheduleDocId() {
  const s = auth();
  if (!s || !s.projectId) return null;
  const res = await fetch(`${s.baseUrl}/documents_list.php?projectId=${s.projectId}`, {
    headers: { 'X-Auth-Token': s.token },
  });
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  if (!json?.success || !Array.isArray(json.documents)) return null;
  const doc = json.documents.find((d) => String(d.file_name || '') === SCHEDULE_FILENAME);
  return doc?.id ? Number(doc.id) : null;
}

function safePlannerStorage(raw) {
  if (!raw || typeof raw !== 'object') {
    return { version: '1.0.0', updatedAt: new Date().toISOString(), manualPosts: [], schedules: {}, checklistItems: [] };
  }
  return {
    version: '1.0.0',
    updatedAt: raw.updatedAt || new Date().toISOString(),
    manualPosts: Array.isArray(raw.manualPosts) ? raw.manualPosts : [],
    schedules: raw.schedules && typeof raw.schedules === 'object' ? raw.schedules : {},
    checklistItems: Array.isArray(raw.checklistItems) ? raw.checklistItems : [],
  };
}

export async function loadZenCloudPlanner() {
  const s = auth();
  if (!s || !s.projectId) return null;
  let docId = getCachedPlannerDocId();
  if (!docId) {
    docId = await findPlannerDocId();
    if (docId) setCachedPlannerDocId(docId);
  }
  if (!docId) return null;
  const res = await fetch(`${s.baseUrl}/documents_download.php?id=${docId}`, {
    headers: { 'X-Auth-Token': s.token },
  });
  if (!res.ok) {
    setCachedPlannerDocId(null);
    return null;
  }
  const text = await res.text().catch(() => '');
  if (!text) return safePlannerStorage(null);
  try {
    return safePlannerStorage(JSON.parse(text));
  } catch {
    return safePlannerStorage(null);
  }
}

export async function loadZenCloudSchedule() {
  const s = auth();
  if (!s || !s.projectId) return null;
  let docId = getCachedScheduleDocId();
  if (!docId) {
    docId = await findScheduleDocId();
    if (docId) setCachedScheduleDocId(docId);
  }
  if (!docId) return null;
  const res = await fetch(`${s.baseUrl}/documents_download.php?id=${docId}`, {
    headers: { 'X-Auth-Token': s.token },
  });
  if (!res.ok) {
    setCachedScheduleDocId(null);
    return null;
  }
  const text = await res.text().catch(() => '');
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveZenCloudPlanner(planner) {
  const s = auth();
  if (!s || !s.projectId) return false;
  const normalized = safePlannerStorage(planner);
  normalized.updatedAt = new Date().toISOString();
  const file = createTextFile(JSON.stringify(normalized, null, 2), PLANNER_FILENAME);

  let docId = getCachedPlannerDocId();
  if (!docId) {
    docId = await findPlannerDocId();
  }

  if (docId) {
    const form = new FormData();
    form.append('id', String(docId));
    form.append('file', file);
    const res = await fetch(`${s.baseUrl}/documents_update.php`, {
      method: 'POST',
      headers: { 'X-Auth-Token': s.token },
      body: form,
    });
    if (res.ok) {
      const json = await res.json().catch(() => null);
      if (json?.success) {
        setCachedPlannerDocId(docId);
        return true;
      }
    }
    setCachedPlannerDocId(null);
  }

  const form = new FormData();
  form.append('projectId', String(s.projectId));
  form.append('file', file);
  const res = await fetch(`${s.baseUrl}/documents_upload.php`, {
    method: 'POST',
    headers: { 'X-Auth-Token': s.token },
    body: form,
  });
  if (!res.ok) return false;
  const json = await res.json().catch(() => null);
  if (!json?.success || !json?.id) return false;
  setCachedPlannerDocId(Number(json.id));
  return true;
}

function buildTextFromEditorBlocks(contentText) {
  try {
    const parsed = JSON.parse(String(contentText || '{"blocks":[]}'));
    const blocks = Array.isArray(parsed?.blocks) ? parsed.blocks : [];
    const lines = blocks
      .map((b) => {
        if (b?.type === 'list') return Array.isArray(b?.data?.items) ? b.data.items.join('\n') : '';
        if (b?.type === 'zenimage') return String(b?.data?.url || '');
        return String(b?.data?.text || '');
      })
      .map((v) => String(v).replace(/<[^>]*>/g, ' ').trim())
      .filter(Boolean);
    return lines.join('\n');
  } catch {
    return String(contentText || '');
  }
}

export async function upsertPlannerEntryFromArticleDraft({ draft, articleDocId, planDate, planTime }) {
  const channel = String(draft?.postMeta?.channel || 'linkedin');
  const normalizedDate = String(planDate || draft?.postMeta?.planDate || draft?.postMeta?.publishDate || '').trim();
  if (!normalizedDate) return { ok: false, reason: 'missing-date' };
  const normalizedTime = String(planTime || draft?.postMeta?.planTime || '12:00').trim() || '12:00';
  const planner = (await loadZenCloudPlanner()) || safePlannerStorage(null);

  const postId = articleDocId ? `article-${articleDocId}` : `article-${Date.now()}`;
  const contentText = draft?.contentType === 'editorjs'
    ? buildTextFromEditorBlocks(draft?.content)
    : String(draft?.content || '');
  const plain = contentText.replace(/\s+/g, ' ').trim();
  const wordCount = plain ? plain.split(' ').filter(Boolean).length : 0;
  const characterCount = plain.length;

  const nextPost = {
    id: postId,
    platform: channel,
    title: String(draft?.title || 'Ohne Titel'),
    subtitle: String(draft?.postMeta?.subTitle || ''),
    imageUrl: String(draft?.postMeta?.coverImageUrl || ''),
    content: contentText,
    characterCount,
    wordCount,
    source: 'manual',
    updatedAt: new Date().toISOString(),
    articleDocId: articleDocId || null,
  };

  const index = planner.manualPosts.findIndex((p) => String(p?.id) === postId || (articleDocId && Number(p?.articleDocId) === Number(articleDocId)));
  if (index >= 0) planner.manualPosts[index] = { ...planner.manualPosts[index], ...nextPost };
  else planner.manualPosts.unshift(nextPost);

  planner.schedules[postId] = { date: normalizedDate, time: normalizedTime };
  const saved = await saveZenCloudPlanner(planner);
  return { ok: saved, postId };
}
