import { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolder, faTag, faSearch, faNoteSticky, faClock, faPen, faTrash, faXmark } from '@fortawesome/free-solid-svg-icons';
import AppHeader from './AppHeader.jsx';
import ZenDropdownField from './ZenDropdownField.jsx';
import { getThemeMode, subscribeThemeMode } from '../services/themeService';
import { getCloudSession } from '../services/cloudAuthService';
import {
  createZenCloudZenNote,
  deleteZenCloudDocument,
  downloadZenCloudDocumentText,
  listZenCloudZenNotes,
  updateZenCloudZenNote,
} from '../services/zenCloudService';

const STORAGE_KEY = 'zenpost_pwa_quick_notes_v1';

function loadNotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveNotes(notes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatQuickTitle(iso = new Date().toISOString()) {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `Quick ${day}.${month}., ${hour}:${min}`;
}

function hashString(value) {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (h << 5) - h + value.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

const FOLDER_COLORS = [
  { bg: '#f6eee2', border: '#eadfcf', text: '#7d6548' },
  { bg: '#e8f3ec', border: '#cfe4d7', text: '#3e6d52' },
  { bg: '#eaf0fb', border: '#d3ddf1', text: '#4b5e8d' },
  { bg: '#f8ecec', border: '#ecd6d6', text: '#8b5858' },
];

const TAG_COLORS = [
  { bg: '#f1efff', border: '#ddd9f8', text: '#6660a8' },
  { bg: '#fff3e9', border: '#f0decc', text: '#8a6845' },
  { bg: '#e9f7f5', border: '#cde8e2', text: '#3d6e66' },
  { bg: '#fbeff6', border: '#ead7e3', text: '#8a5f7c' },
];

function resolveFolderColor(name) {
  return FOLDER_COLORS[hashString(name.toLowerCase()) % FOLDER_COLORS.length];
}

function resolveTagColor(name) {
  return TAG_COLORS[hashString(name.toLowerCase()) % TAG_COLORS.length];
}

function parseZenNoteFileName(fileName = '') {
  const base = String(fileName).replace(/\.(zennote|md)$/i, '');
  let folder = '';
  let rest = base;
  const atIdx = base.indexOf('@@');
  if (atIdx !== -1) {
    folder = base.slice(0, atIdx);
    rest = base.slice(atIdx + 2);
  }
  const sep = rest.lastIndexOf('__');
  if (sep === -1) return { title: rest, tag: '', folder };
  const maybeTag = rest.slice(sep + 2);
  if (maybeTag && /^[a-zA-Z0-9_-]+$/.test(maybeTag)) {
    return { title: rest.slice(0, sep), tag: maybeTag, folder };
  }
  return { title: rest, tag: '', folder };
}

function deriveTitleFromContent(text) {
  const first = String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  if (!first) return 'Ohne Titel';
  return first.length > 80 ? `${first.slice(0, 80)}…` : first;
}

export default function ZenNoteQuickScreen({ onBack, onOpenSettings, onFooterActionChange, avatarUrl }) {
  const [session, setSession] = useState(() => getCloudSession());
  const [title, setTitle] = useState('');
  const [tag, setTag] = useState('');
  const [folder, setFolder] = useState('');
  const [content, setContent] = useState('');
  const [search, setSearch] = useState('');
  const [notes, setNotes] = useState(() => loadNotes());
  const [editingId, setEditingId] = useState(null);
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [status, setStatus] = useState('');
  const [themeMode, setThemeMode] = useState(() => getThemeMode());
  const isDark = themeMode === 'dark';

  const isDisabled = useMemo(() => !content.trim(), [content]);
  const cloudReady = useMemo(() => !!session.token && !!session.projectId && !!session.baseUrl, [session]);
  const projectLabel = useMemo(() => {
    if (session.projectName) return session.projectName;
    if (session.projectId) return `#${session.projectId}`;
    return '-';
  }, [session.projectId, session.projectName]);

  const loadCloudNotes = async () => {
    if (!cloudReady) return;
    setLoadingCloud(true);
    const docs = await listZenCloudZenNotes();
    const sorted = [...docs].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    const loaded = await Promise.all(
      sorted.map(async (doc) => {
        const text = await downloadZenCloudDocumentText(doc.id);
        let parsed = null;
        try {
          parsed = text ? JSON.parse(text) : null;
        } catch {
          parsed = null;
        }
        const fileMeta = parseZenNoteFileName(doc.fileName);
        const rawContent = parsed?.content ?? text ?? '';
        const inferredTitle = deriveTitleFromContent(rawContent);
        return {
          id: doc.id,
          title: parsed?.title || fileMeta.title || inferredTitle,
          tag: parsed?.tag || fileMeta.tag || '',
          folder: parsed?.folder || fileMeta.folder || '',
          content: rawContent,
          createdAt: parsed?.createdAt || doc.createdAt || new Date().toISOString(),
        };
      })
    );
    const valid = loaded.filter(Boolean);
    setNotes(valid);
    setLoadingCloud(false);
  };

  useEffect(() => {
    const syncSession = () => setSession(getCloudSession());
    window.addEventListener('focus', syncSession);
    window.addEventListener('visibilitychange', syncSession);
    syncSession();
    return () => {
      window.removeEventListener('focus', syncSession);
      window.removeEventListener('visibilitychange', syncSession);
    };
  }, []);

  useEffect(() => {
    const unsub = subscribeThemeMode((mode) => setThemeMode(mode));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (cloudReady) void loadCloudNotes();
  }, [cloudReady]);

  const availableTags = useMemo(() => {
    const values = Array.from(new Set(notes.map((n) => (n.tag || '').trim()).filter(Boolean)));
    return values.sort((a, b) => a.localeCompare(b, 'de'));
  }, [notes]);

  const availableFolders = useMemo(() => {
    const values = Array.from(new Set(notes.map((n) => (n.folder || '').trim()).filter(Boolean)));
    return values.sort((a, b) => a.localeCompare(b, 'de'));
  }, [notes]);

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) =>
      n.title.toLowerCase().includes(q) ||
      (n.tag || '').toLowerCase().includes(q) ||
      (n.folder || '').toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q)
    );
  }, [notes, search]);

  const handleSave = async () => {
    const nowIso = new Date().toISOString();
    const existing = editingId ? notes.find((n) => n.id === editingId) : null;
    const computedTitle = title.trim() || existing?.title || formatQuickTitle(nowIso);
    const payload = {
      title: computedTitle,
      tag: tag.trim(),
      folder: editingId ? folder.trim() : '',
      content: content.trim(),
      createdAt: editingId ? existing?.createdAt || nowIso : nowIso,
      updatedAt: nowIso,
    };
    if (!cloudReady) return;
    if (editingId) {
      const ok = await updateZenCloudZenNote(editingId, payload);
      setStatus(ok ? 'ZenNote aktualisiert.' : 'Update fehlgeschlagen.');
    } else {
      const docId = await createZenCloudZenNote(payload);
      setStatus(docId ? 'ZenNote gespeichert.' : 'Speichern fehlgeschlagen.');
    }
    await loadCloudNotes();
    setTitle('');
    setTag('');
    setFolder('');
    setContent('');
    setEditingId(null);
  };

  const handleLoad = (note) => {
    setTitle(note.title || '');
    setTag(note.tag || '');
    setFolder(note.folder || '');
    setContent(note.content || '');
    setEditingId(note.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!cloudReady) return;
    const ok = await deleteZenCloudDocument(id);
    setStatus(ok ? 'ZenNote gelöscht.' : 'Löschen fehlgeschlagen.');
    await loadCloudNotes();
    if (editingId === id) {
      setTitle('');
      setTag('');
      setFolder('');
      setContent('');
      setEditingId(null);
    }
  };

  const cancelEditing = () => {
    setTitle('');
    setTag('');
    setFolder('');
    setContent('');
    setEditingId(null);
  };

  const scrollToList = () => {
    const el = document.getElementById('zennote-list');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    if (!onFooterActionChange) return undefined;
    onFooterActionChange({
      plusLabel: editingId ? 'Neu (Bearbeitung verlassen)' : 'Neue Quick Note',
      onPlus: () => cancelEditing(),
      items: [
        { key: 'zn-home', tabKey: 'HomeDashboard', label: 'Home', type: 'tab' },
        { key: 'zn-list', label: 'Liste', type: 'action', actionKey: 'list' },
        { key: 'zn-plus', label: '+', type: 'plus' },
        { key: 'zn-save', label: 'Speichern', type: 'action', actionKey: 'save' },
        { key: 'zn-dashboard', tabKey: 'Dashboard', label: 'Aktionen', type: 'tab' },
      ],
      actions: {
        list: scrollToList,
        save: handleSave,
      },
    });
    return () => onFooterActionChange(null);
  }, [editingId, onFooterActionChange, title, tag, folder, content, notes, cloudReady, search]);

  return (
    <div className={`min-h-screen w-full ${isDark ? 'bg-[#121212] text-[#ece7df]' : 'bg-[#f5f1ea] text-[#171717]'}`}>
      <section className="mx-auto w-full max-w-[390px] px-4 pb-28 pt-4">
        <AppHeader
          sticky
          stickyClassName={isDark ? 'bg-[#121212]/95' : 'bg-[#f5f1ea]/95'}
          title="ZenNote Quick"
          subtitle={cloudReady ? `Cloud Sync aktiv // ${projectLabel}` : 'ZenNote benötigt ZenCloud Login + Projekt.'}
          titleAlign="left"
          titleClassName={isDark ? 'text-[#f0ebe3]' : 'text-[#191919]'}
          subtitleClassName={isDark ? 'text-[#a1988a]' : 'text-[#8a8174]'}
          right={
            <button onClick={onOpenSettings} aria-label="Profil öffnen" className="mt-0 h-10 w-10 overflow-hidden rounded-full border-[0.5px] border-[#AC8E66]">
              <img src={avatarUrl} alt="Profilbild" className="h-full w-full object-cover" />
            </button>
          }
        />
        {status ? <p className={`mt-1 text-[11px] ${isDark ? 'text-[#a1988a]' : 'text-[#8a8174]'}`}>{status}</p> : null}

        {!cloudReady ? (
          <div className={`mt-5 rounded-[14px] border p-4 text-center ${isDark ? 'border-[#3d3b37] bg-[#1a1a1a] text-[#efe9dc]' : 'border-[#e6dbc8] bg-[#131313] text-[#efe9dc]'}`}>
            <p className="text-[12px] leading-[1.4]">ZenNote benötigt einen ZenCloud Account.</p>
            <p className="mt-1 text-[11px] text-[#cfc4b2]">Bitte zuerst in Profil anmelden und Projekt wählen.</p>
            <button
              type="button"
              onClick={onOpenSettings}
              className={`mt-3 rounded-full px-4 py-1.5 text-[12px] font-semibold ${isDark ? 'bg-[#2f2b25] text-[#efe3d1]' : 'bg-[#eee1c9] text-[#2b251e]'}`}
            >
              Anmelden
            </button>
          </div>
        ) : null}

        <div className={`mt-6 grid grid-cols-2 gap-2.5 ${!cloudReady ? 'pointer-events-none opacity-45' : ''}`}>
          <ZenDropdownField
            id="znTag"
            label="Tag"
            value={tag}
            onChange={setTag}
            placeholder="kein Tag"
            options={availableTags}
            disabled={!cloudReady}
          />
          <ZenDropdownField
            id="znFolder"
            label="Ordner"
            value={folder}
            onChange={setFolder}
            placeholder="kein Ordner"
            options={availableFolders}
            disabled={!cloudReady}
          />
        </div>

        <div className={`mt-5 ${!cloudReady ? 'pointer-events-none opacity-45' : ''}`}>
          <label htmlFor="znTitle" className="block text-[12px] font-semibold text-[#a09a8f]">Titel</label>
          <input
            id="znTitle"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Quick 11.05., 15:21"
            className={`mt-2 w-full rounded-[14px] border px-4 py-2.5 text-[13px] font-semibold outline-none ${
              isDark
                ? 'border-[#3d3b37] bg-[#1f1f1e] text-[#ece7df] placeholder:text-[#7f786c] focus:border-[#6d6354]'
                : 'border-[#efe9df] bg-[#fbf8f3] text-[#222] placeholder:text-[#b6b0a6] focus:border-[#f0c060]'
            }`}
          />
        </div>

        <div className={`mt-4 ${!cloudReady ? 'pointer-events-none opacity-45' : ''}`}>
          <label htmlFor="znContent" className="block text-[12px] font-semibold text-[#a09a8f]">Notiz</label>
          <textarea
            id="znContent"
            rows="6"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Schnelle Notiz oder Snippet …"
            className={`mt-2 w-full resize-none rounded-[16px] border px-4 py-4 text-[14px] font-medium outline-none ${
              isDark
                ? 'border-[#3d3b37] bg-[#1f1f1e] text-[#ece7df] placeholder:text-[#7f786c] focus:border-[#6d6354]'
                : 'border-[#efe9df] bg-[#fbf8f3] text-[#222] placeholder:text-[#b6b0a6] focus:border-[#ddd4c7]'
            }`}
          />
        </div>

        <div className={`mt-7 flex items-center gap-2 ${!cloudReady ? 'pointer-events-none opacity-45' : ''}`}>
          <button
            onClick={handleSave}
            disabled={isDisabled}
            className={`w-full rounded-full py-3 text-[15px] font-semibold shadow-[0_6px_18px_rgba(0,0,0,0.2)] disabled:cursor-not-allowed disabled:opacity-45 ${
              isDark ? 'bg-[#d8c8ad] text-[#1b1814]' : 'bg-[#101113] text-[#f2ede5]'
            }`}
          >
            {editingId ? 'Quick Note aktualisieren' : 'Quick Note speichern'}
          </button>
          {editingId ? (
            <button
              onClick={cancelEditing}
              className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-full border border-[#e7ddd0] bg-[#fbf8f3] text-[#6f675b]"
              aria-label="Bearbeitung abbrechen"
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          ) : null}
        </div>

        <div id="zennote-list" className={`mt-8 ${!cloudReady ? 'pointer-events-none opacity-45' : ''}`}>
          <div className="flex items-center justify-between gap-3">
            <h3 className={`text-[12px] font-bold tracking-[-0.02em] ${isDark ? 'text-[#d8c8ad]' : 'text-[#6d665b]'}`}>ZenNote Liste</h3>
            <label className={`flex w-[150px] items-center gap-1.5 rounded-[10px] border px-2.5 py-1.5 ${
              isDark ? 'border-[#c9b998] bg-[#d8c8ad]' : 'border-[#efe9df] bg-[#fbf8f3]'
            }`}>
              <FontAwesomeIcon icon={faSearch} className={`text-[10px] ${isDark ? 'text-[#514637]' : 'text-[#9d9488]'}`} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Suchen"
                className={`w-full bg-transparent text-[11px] outline-none ${
                  isDark ? 'text-[#3a3024] placeholder:text-[#756a5b]' : 'text-[#5a544b] placeholder:text-[#b6b0a6]'
                }`}
              />
            </label>
          </div>

          <div className="mt-3 grid gap-2.5">
            {loadingCloud ? (
              <p className={`rounded-[12px] border px-3 py-2 text-[11px] ${
                isDark ? 'border-[#c9b998] bg-[#d8c8ad] text-[#4f4638]' : 'border-[#efe9df] bg-[#fbf8f3] text-[#8f877b]'
              }`}>ZenNote Cloud lädt …</p>
            ) : filteredNotes.length === 0 ? (
              <p className={`rounded-[12px] border px-3 py-2 text-[11px] ${
                isDark ? 'border-[#c9b998] bg-[#d8c8ad] text-[#4f4638]' : 'border-[#efe9df] bg-[#fbf8f3] text-[#8f877b]'
              }`}>Keine Notizen gefunden.</p>
            ) : (
              filteredNotes.map((note) => (
                <article
                  key={note.id}
                  onClick={() => handleLoad(note)}
                  className={`cursor-pointer rounded-[12px] border px-3 py-2.5 ${
                    isDark ? 'bg-[#d8c8ad] border-[#c9b998]' : 'bg-[#fbf8f3] border-[#efe9df]'
                  } ${
                    editingId === note.id ? 'ring-1 ring-[#f0c060]' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <FontAwesomeIcon icon={faNoteSticky} className="text-[10px] text-[#f0c060]" />
                      <p className={`text-[12px] font-semibold ${isDark ? 'text-[#1f1811]' : 'text-[#23211d]'}`}>{note.title}</p>
                    </div>
                    <span className={`flex items-center gap-1 text-[10px] ${isDark ? 'text-[#5f5343]' : 'text-[#9b9386]'}`}>
                      <FontAwesomeIcon icon={faClock} className="text-[9px]" />
                      {formatDate(note.createdAt)}
                    </span>
                  </div>

                  {(note.tag || note.folder) ? (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {note.folder ? (() => {
                        const c = resolveFolderColor(note.folder);
                        return (
                          <span
                            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]"
                            style={{ backgroundColor: c.bg, borderColor: c.border, color: c.text }}
                          >
                            <FontAwesomeIcon icon={faFolder} className="text-[9px]" />
                            {note.folder}
                          </span>
                        );
                      })() : null}
                      {note.tag ? (() => {
                        const c = resolveTagColor(note.tag);
                        return (
                          <span
                            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]"
                            style={{ backgroundColor: c.bg, borderColor: c.border, color: c.text }}
                          >
                            <FontAwesomeIcon icon={faTag} className="text-[9px]" />
                            {note.tag}
                          </span>
                        );
                      })() : null}
                    </div>
                  ) : null}

                  <div className="mt-2.5 flex gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLoad(note);
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-[#e2dbcf] bg-[#f6f1e8] px-2.5 py-1 text-[10px] font-semibold text-[#6c6559]"
                    >
                      <FontAwesomeIcon icon={faPen} className="text-[9px]" />
                      Editieren
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(note.id);
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-[#ecd6d6] bg-[#f8ecec] px-2.5 py-1 text-[10px] font-semibold text-[#8b5858]"
                    >
                      <FontAwesomeIcon icon={faTrash} className="text-[9px]" />
                      Löschen
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
