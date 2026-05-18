import { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolder, faImage, faNoteSticky, faPenNib } from '@fortawesome/free-solid-svg-icons';
import AppHeader from './AppHeader.jsx';
import SheetHeader from './SheetHeader.jsx';
import { getCloudSession } from '../services/cloudAuthService';
import { listZenCloudDocuments } from '../services/zenCloudService';
import { getThemeMode, subscribeThemeMode } from '../services/themeService';

function docType(doc) {
  const name = doc.fileName.toLowerCase();
  const mime = doc.mimeType.toLowerCase();
  if (mime.startsWith('image/')) return 'ZenImage';
  if (name.endsWith('.zennote') || name.endsWith('.md')) return 'ZenNote';
  if (name.includes('article-') || name.endsWith('.zenpost.json')) return 'Artikel';
  return 'Dokument';
}

function isRelevantContentDoc(doc) {
  const t = docType(doc);
  return t === 'Artikel' || t === 'ZenNote' || t === 'ZenImage';
}

function formatDate(value) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return value;
  }
}

function renderMarkdownContent(text, keyPrefix = 'dash-md') {
  const source = String(text || '').trim();
  if (!source) return null;
  const lines = source.split('\n');
  return lines.map((line, idx) => {
    const row = line.trim();
    if (!row) return <div key={`${keyPrefix}-sp-${idx}`} className="h-2" />;
    const imgMatch = row.match(/^!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)$/i);
    if (imgMatch) {
      const [, alt, url] = imgMatch;
      return (
        <figure key={`${keyPrefix}-img-${idx}`} className="mb-2">
          <img src={url} alt={alt || 'Bild'} className="w-full rounded-[10px] border border-[#e8dece]" />
          {alt ? <figcaption className="mt-1 text-[11px] text-[#8a8174]">{alt}</figcaption> : null}
        </figure>
      );
    }
    return <p key={`${keyPrefix}-p-${idx}`} className="mb-1.5">{line}</p>;
  });
}

function compactTitle(fileName = '') {
  const raw = String(fileName || '').trim();
  const withoutExt = raw.replace(/\.(zenpost\.json|zennote|json|md|txt|pdf|docx?|webp|png|jpe?g)$/i, '');
  let base = withoutExt;

  // article-<timestamp>-<slug> -> <slug>
  if (/^article-\d+-/i.test(base)) base = base.replace(/^article-\d+-/i, '');
  // zennote[-_]<timestamp>[-_]<slug> -> <slug>
  if (/^zennote[-_]\d+[-_]/i.test(base)) base = base.replace(/^zennote[-_]\d+[-_]/i, '');

  const human = base
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!human) return raw;
  return human.length > 52 ? `${human.slice(0, 52)}…` : human;
}

function trimLabel(value = '', max = 52) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export default function CloudDashboardScreen({ onOpenSettings, onFooterActionChange, onOpenArticleDraft, avatarUrl }) {
  const [themeMode, setThemeMode] = useState(() => getThemeMode());
  const [session, setSession] = useState(() => getCloudSession());
  const [docs, setDocs] = useState([]);
  const [titleOverrides, setTitleOverrides] = useState({});
  const [loading, setLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [previewText, setPreviewText] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('Alle');
  const [sortMode, setSortMode] = useState('neu');
  const isDark = themeMode === 'dark';
  const isConfigured = useMemo(() => !!session.token && !!session.projectId && !!session.baseUrl, [session]);
  const projectLabel = session.projectName || (session.projectId ? `#${session.projectId}` : '-');

  const refresh = async () => {
    if (!isConfigured) return;
    setLoading(true);
    const next = await listZenCloudDocuments();
    setDocs(next.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()));
    setTitleOverrides({});
    setLoading(false);
  };

  useEffect(() => {
    const unsub = subscribeThemeMode((mode) => setThemeMode(mode));
    return () => unsub();
  }, []);

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
    if (isConfigured) void refresh();
  }, [isConfigured]);

  useEffect(() => {
    if (!session?.baseUrl || !session?.token) return;
    const articleDocs = docs.filter((d) => docType(d) === 'Artikel').slice(0, 20);
    if (!articleDocs.length) return;
    let cancelled = false;
    void Promise.all(
      articleDocs.map(async (doc) => {
        try {
          const res = await fetch(`${session.baseUrl}/documents_download.php?id=${doc.id}`, {
            headers: { 'X-Auth-Token': session.token },
          });
          if (!res.ok) return null;
          const text = await res.text();
          const parsed = JSON.parse(text);
          const pretty = String(parsed?.title || '').trim();
          return pretty ? { id: doc.id, title: pretty } : null;
        } catch {
          return null;
        }
      })
    ).then((rows) => {
      if (cancelled) return;
      const next = {};
      for (const row of rows) {
        if (row?.id && row?.title) next[row.id] = row.title;
      }
      if (Object.keys(next).length) setTitleOverrides((prev) => ({ ...prev, ...next }));
    });
    return () => {
      cancelled = true;
    };
  }, [docs, session?.baseUrl, session?.token]);

  useEffect(() => {
    if (!onFooterActionChange) return undefined;
    onFooterActionChange({
      plusLabel: 'Neu erstellen',
      items: [
        { key: 'db-home', tabKey: 'HomeDashboard', label: 'Home', type: 'tab' },
        { key: 'db-refresh', label: 'Reload', type: 'action', actionKey: 'refresh' },
        { key: 'db-plus', label: '+', type: 'plus' },
        { key: 'db-studio', tabKey: 'Studio', label: 'Kamera', type: 'tab' },
        { key: 'db-article', tabKey: 'Home', label: 'Schreiben', type: 'tab' },
      ],
      actions: { refresh: () => void refresh() },
    });
    return () => onFooterActionChange(null);
  }, [onFooterActionChange, isConfigured]);

  const contentDocs = useMemo(() => docs.filter((d) => isRelevantContentDoc(d)), [docs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = contentDocs.filter((d) => {
      const type = docType(d);
      if (filter !== 'Alle' && type !== filter) return false;
      if (!q) return true;
      return d.fileName.toLowerCase().includes(q) || type.toLowerCase().includes(q);
    });
    if (sortMode === 'az') return rows.sort((a, b) => a.fileName.localeCompare(b.fileName, 'de'));
    return rows.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [contentDocs, search, filter, sortMode]);

  const counts = useMemo(() => {
    const base = { Alle: contentDocs.length, ZenNote: 0, ZenImage: 0, Artikel: 0 };
    for (const d of contentDocs) {
      const t = docType(d);
      if (t in base) base[t] += 1;
    }
    return base;
  }, [contentDocs]);

  const openPreview = async (doc) => {
    if (!session?.baseUrl || !session?.token || !doc?.id) return;
    setSelectedDoc(doc);
    setPreviewText('');
    setPreviewLoading(true);
    setPreviewOpen(true);
    try {
      if (doc.imageUrl || String(doc.mimeType || '').startsWith('image/')) {
        return;
      }
      const res = await fetch(`${session.baseUrl}/documents_download.php?id=${doc.id}`, {
        headers: { 'X-Auth-Token': session.token },
      });
      if (!res.ok) return;
      const text = await res.text().catch(() => '');
      setPreviewText(text.slice(0, 3000));
    } finally {
      setPreviewLoading(false);
    }
  };

  const openInArticleWriter = () => {
    if (!selectedDoc) return;
    const text = previewText || '';
    if (!text) return;
    try {
      const parsed = JSON.parse(text);
      sessionStorage.setItem('zenpost_open_article_draft', JSON.stringify(parsed));
      onOpenArticleDraft?.();
      setPreviewOpen(false);
    } catch {
      // non-json payloads are not article drafts
    }
  };

  return (
    <div className={`min-h-screen w-full ${isDark ? 'bg-[#121212] text-[#ece7df]' : 'bg-[#f5f1ea] text-[#171717]'}`}>
      <section className="mx-auto w-full max-w-[390px] px-4 pb-28 pt-4">
        <AppHeader
          sticky
          stickyClassName={isDark ? 'bg-[#121212]/95' : 'bg-[#f5f1ea]/95'}
          title="Cloud Dashboard"
          subtitle={isConfigured ? `Projektmappe aktiv // ${projectLabel}` : 'Cloud Login + Projekt wählen'}
          titleAlign="left"
          titleClassName={isDark ? 'text-[#f0ebe3]' : 'text-[#191919]'}
          subtitleClassName={isDark ? 'text-[#a1988a]' : 'text-[#8a8174]'}
          right={
            <button onClick={onOpenSettings} aria-label="Profil öffnen" className="mt-0 h-10 w-10 overflow-hidden rounded-full border-[0.5px] border-[#AC8E66]">
              <img src={avatarUrl} alt="Profilbild" className="h-full w-full object-cover" />
            </button>
          }
        />

        {!isConfigured ? (
          <div className={`mt-5 rounded-[14px] border p-3 ${isDark ? 'border-[#3d3b37] bg-[#1b1b1a]' : 'border-[#ece3d4] bg-[#fbf8f3]'}`}>
            <p className={`text-[12px] ${isDark ? 'text-[#a1988a]' : 'text-[#7f7768]'}`}>Nicht eingeloggt. Bitte ZenCloud in Profil verbinden.</p>
            <button onClick={onOpenSettings} className={`mt-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${isDark ? 'border-[#6b604f] bg-[#2a2824] text-[#e6dccd]' : 'border-[#d6c6ad] bg-[#f3ecdf] text-[#5d4a33]'}`}>ZenSettings öffnen</button>
          </div>
        ) : (
          <>
            <div className="mt-4 grid gap-2">
              <div className="flex flex-wrap gap-2">
                {[
                  ['Alle', counts.Alle],
                  ['ZenImage', counts.ZenImage],
                  ['ZenNote', counts.ZenNote],
                  ['Artikel', counts.Artikel],
                ].map(([label, count]) => (
                  <button
                    key={label}
                    onClick={() => setFilter(label)}
                    className={`rounded-[10px] border px-3 py-1.5 text-[11px] font-semibold ${
                      filter === label ? 'border-[#AC8E66] bg-[#2a2722] text-[#f0e7d8]' : isDark ? 'border-[#4a4338] bg-[#1f1f1f] text-[#b8ae9f]' : 'border-[#d7ccbb] bg-[#f6f1e7] text-[#6b6255]'
                    }`}
                  >
                    {label} · {count}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSortMode((v) => (v === 'neu' ? 'az' : 'neu'))}
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${isDark ? 'border-[#3a352f] bg-[#1f1f1f] text-[#d8c8ad]' : 'border-[#e0d4c1] bg-[#fbf8f3] text-[#6b6255]'}`}
                >
                  {sortMode === 'neu' ? 'Neueste' : 'A-Z'}
                </button>
              </div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Suchen..."
                className={`w-full rounded-[12px] border px-3 py-2 text-[12px] outline-none ${isDark ? 'border-[#3a352f] bg-[#1f1f1f] text-[#ece7df] placeholder:text-[#7f786a]' : 'border-[#e0d4c1] bg-[#fbf8f3] text-[#2a2722] placeholder:text-[#9a9285]'}`}
              />
            </div>

            <div className="mt-4 grid gap-2.5">
              {loading ? <p className={`text-[12px] ${isDark ? 'text-[#a1988a]' : 'text-[#7f7768]'}`}>Lade Dokumente …</p> : null}
              {!loading && filtered.length === 0 ? <p className={`text-[12px] ${isDark ? 'text-[#a1988a]' : 'text-[#7f7768]'}`}>Keine Dokumente gefunden.</p> : null}
              {filtered.map((doc) => {
                const type = docType(doc);
                const icon = type === 'ZenImage' ? faImage : type === 'ZenNote' ? faNoteSticky : type === 'Artikel' ? faPenNib : faFolder;
                const isAll = filter === 'Alle';
                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => void openPreview(doc)}
                    className={`w-full rounded-[12px] border text-left ${isDark ? 'border-[#3a352f] bg-[#171717]' : 'border-[#e8dece] bg-white'} ${isAll ? 'p-2' : 'p-2.5'}`}
                  >
                    <div className={`flex items-start ${isAll ? 'gap-2' : 'gap-2.5'}`}>
                      <div className={`grid place-items-center rounded-[10px] ${isDark ? 'bg-[#212121] text-[#d8c8ad]' : 'bg-[#f3ecdf] text-[#5d4a33]'} ${isAll ? 'h-8 w-8' : 'h-9 w-9'}`}>
                        <FontAwesomeIcon icon={icon} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`truncate font-semibold ${isDark ? 'text-[#ece7df]' : 'text-[#2a2722]'} ${isAll ? 'text-[11px]' : 'text-[12px]'}`}>
                          {isAll
                            ? trimLabel(titleOverrides[doc.id] || compactTitle(doc.fileName) || `Dokument #${doc.id}`, 40)
                            : (titleOverrides[doc.id] || compactTitle(doc.fileName) || `Dokument #${doc.id}`)}
                        </p>
                        <p className={`${isDark ? 'text-[#a1988a]' : 'text-[#7f7768]'} ${isAll ? 'mt-0 text-[9.5px]' : 'mt-0.5 text-[10px]'}`}>{type} • {formatDate(doc.createdAt)}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </section>

      <div className={`fixed inset-0 z-50 transition ${previewOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <button type="button" onClick={() => setPreviewOpen(false)} className={`absolute inset-0 bg-black/45 transition-opacity ${previewOpen ? 'opacity-100' : 'opacity-0'}`} aria-label="Preview schließen" />
        <section className={`absolute bottom-0 left-0 right-0 mx-auto w-full max-w-[390px] rounded-t-[20px] border px-4 pb-6 pt-4 shadow-[0_-10px_28px_rgba(0,0,0,0.22)] transition-transform duration-200 ${isDark ? 'border-[#3a352f] bg-[#171717]' : 'border-[#e8dece] bg-[#fbf8f3]'} ${previewOpen ? 'translate-y-0' : 'translate-y-full'}`}>
          <SheetHeader title="Preview" onClose={() => setPreviewOpen(false)} closeLabel="Preview schließen" isDark={isDark} />
          {selectedDoc ? (
            <div className="mt-3">
              <p className={`truncate text-[13px] font-semibold ${isDark ? 'text-[#ece7df]' : 'text-[#2a2722]'}`}>{selectedDoc.fileName}</p>
              <p className={`mt-1 text-[10px] ${isDark ? 'text-[#a1988a]' : 'text-[#7f7768]'}`}>{docType(selectedDoc)} • {formatDate(selectedDoc.createdAt)}</p>
              {selectedDoc.imageUrl ? (
                <img src={selectedDoc.imageUrl} alt={selectedDoc.fileName} className={`mt-3 max-h-[46vh] w-full rounded-[12px] border object-contain ${isDark ? 'border-[#3a352f] bg-[#0f0f0f]' : 'border-[#e8dece] bg-white'}`} />
              ) : (
                <article className={`mt-3 max-h-[46vh] overflow-auto whitespace-pre-wrap rounded-[12px] border px-3 py-3 text-[12px] leading-[1.45] ${isDark ? 'border-[#3a352f] bg-[#0f0f0f] text-[#e8e1d6]' : 'border-[#e8dece] bg-white text-[#2a2722]'}`}>
                  {previewLoading
                    ? 'Lade Inhalt …'
                    : (() => {
                        try {
                          const parsed = JSON.parse(previewText || '');
                          if (docType(selectedDoc) === 'Artikel') {
                            const title = String(parsed?.title || '').trim();
                            const excerpt = String(parsed?.postMeta?.excerpt || '').trim();
                            const body = String(parsed?.content || '').trim();
                            return (
                              <>
                                {title ? <h4 className="mb-2 text-[16px] font-bold">{title}</h4> : null}
                                {excerpt ? <p className="mb-2 text-[12px]">{excerpt}</p> : null}
                                {renderMarkdownContent(body, 'dash-article') || <p>Keine Vorschau verfügbar.</p>}
                              </>
                            );
                          }
                          if (docType(selectedDoc) === 'ZenNote') {
                            return renderMarkdownContent(String(parsed?.content || ''), 'dash-note') || <p>Keine Vorschau verfügbar.</p>;
                          }
                        } catch {
                          // plain text fallback
                        }
                        return renderMarkdownContent(previewText, 'dash-plain') || 'Keine Vorschau verfügbar.';
                      })()}
                </article>
              )}
              {docType(selectedDoc) === 'Artikel' && !previewLoading ? (
                <button
                  type="button"
                  onClick={openInArticleWriter}
                  className={`mt-3 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${isDark ? 'border-[#4a4338] bg-[#212121] text-[#d8c8ad]' : 'border-[#d6c6ad] bg-[#f3ecdf] text-[#5d4a33]'}`}
                >
                  In Artikel öffnen
                </button>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
