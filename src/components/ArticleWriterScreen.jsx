import { useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faNewspaper } from '@fortawesome/free-solid-svg-icons';
import { faLinkedin, faReddit, faGithub, faDev, faMedium, faHashnode, faXTwitter } from '@fortawesome/free-brands-svg-icons';
import AppHeader from './AppHeader.jsx';
import SheetHeader from './SheetHeader.jsx';
import { getCloudSession } from '../services/cloudAuthService';
import { createZenCloudArticleDraft, listZenCloudImages, upsertPlannerEntryFromArticleDraft } from '../services/zenCloudService';
import { getDistributionChannels, getChannelLabel } from '../services/distributionChannelsService';

const DRAFT_KEY = 'zenpost_pwa_article_drafts_v1';

function loadDrafts() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveDraftLocal(draft) {
  const list = loadDrafts();
  const next = [{ ...draft, localId: `draft-${Date.now()}` }, ...list].slice(0, 50);
  localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
}

function stripHtml(value) {
  return String(value || '').replace(/<[^>]*>/g, '').trim();
}

function parseMarkdownImageLine(line) {
  const row = String(line || '').trim();
  const match = row.match(/^!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)$/i);
  if (!match) return null;
  return { alt: match[1] || 'Bild', url: match[2] };
}

function normalizeEditorBlocksPayload(payload) {
  const source = payload && Array.isArray(payload.blocks) ? payload : { blocks: [] };
  const normalized = source.blocks.map((block) => {
    if (block?.type !== 'paragraph') return block;
    const rawText = stripHtml(block?.data?.text);
    const img = parseMarkdownImageLine(rawText);
    if (!img?.url) return block;
    return {
      type: 'zenimage',
      data: {
        url: img.url,
        alt: img.alt,
      },
    };
  });
  return { ...source, blocks: normalized };
}

function renderMarkdownContent(text, keyPrefix = 'md') {
  const source = String(text || '').trim();
  if (!source) return null;
  const lines = source.split('\n');
  return lines.map((line, idx) => {
    const row = line.trim();
    if (!row) return <div key={`${keyPrefix}-sp-${idx}`} className="h-2" />;
    const img = parseMarkdownImageLine(row);
    if (img?.url) {
      return (
        <figure key={`${keyPrefix}-img-${idx}`} className="mb-2">
          <img src={img.url} alt={img.alt || 'Bild'} className="w-full rounded-[10px] border border-[#e8dece]" />
          {img.alt ? <figcaption className="mt-1 text-[11px] text-[#8a8174]">{img.alt}</figcaption> : null}
        </figure>
      );
    }
    return <p key={`${keyPrefix}-p-${idx}`} className="mb-1.5">{line}</p>;
  });
}

function renderEditorBlock(block, idx) {
  if (!block) return null;
  const key = `${block.id || 'b'}-${idx}`;

  if (block.type === 'header') {
    const level = Number(block?.data?.level) || 2;
    const text = stripHtml(block?.data?.text);
    if (!text) return null;
    if (level === 1) return <h1 key={key} className="mb-2 text-[22px] font-bold leading-tight text-[#1d1b18]">{text}</h1>;
    if (level === 2) return <h2 key={key} className="mb-2 text-[19px] font-bold leading-tight text-[#1d1b18]">{text}</h2>;
    return <h3 key={key} className="mb-2 text-[16px] font-semibold leading-tight text-[#1d1b18]">{text}</h3>;
  }

  if (block.type === 'list') {
    const style = block?.data?.style === 'ordered' ? 'ordered' : 'unordered';
    const items = Array.isArray(block?.data?.items) ? block.data.items.map((item) => stripHtml(item)).filter(Boolean) : [];
    if (!items.length) return null;
    if (style === 'ordered') {
      return (
        <ol key={key} className="mb-3 list-decimal pl-5">
          {items.map((item, i) => <li key={`${key}-i-${i}`} className="mb-1">{item}</li>)}
        </ol>
      );
    }
    return (
      <ul key={key} className="mb-3 list-disc pl-5">
        {items.map((item, i) => <li key={`${key}-i-${i}`} className="mb-1">{item}</li>)}
      </ul>
    );
  }

  if (block.type === 'quote') {
    const text = stripHtml(block?.data?.text);
    if (!text) return null;
    return <blockquote key={key} className="mb-3 border-l-2 border-[#d8ccb8] pl-3 italic text-[#4b453c]">{text}</blockquote>;
  }

  if (block.type === 'zenimage') {
    const url = String(block?.data?.url || '').trim();
    const alt = String(block?.data?.alt || '').trim();
    if (!url) return null;
    return (
      <figure key={key} className="mb-3">
        <img src={url} alt={alt || 'Bild'} className="w-full rounded-[10px] border border-[#e8dece]" />
        {alt ? <figcaption className="mt-1 text-[11px] text-[#8a8174]">{alt}</figcaption> : null}
      </figure>
    );
  }

  if (block.type === 'delimiter') {
    return <hr key={key} className="my-3 border-[#e8dece]" />;
  }

  const text = stripHtml(block?.data?.text);
  if (!text) return null;
  const inlineImage = parseMarkdownImageLine(text);
  if (inlineImage?.url) {
    return (
      <figure key={key} className="mb-3">
        <img src={inlineImage.url} alt={inlineImage.alt || 'Bild'} className="w-full rounded-[10px] border border-[#e8dece]" />
        {inlineImage.alt ? <figcaption className="mt-1 text-[11px] text-[#8a8174]">{inlineImage.alt}</figcaption> : null}
      </figure>
    );
  }
  return <p key={key} className="mb-2">{text}</p>;
}

function getChannelIcon(channelId) {
  const map = {
    blog: faNewspaper,
    linkedin: faLinkedin,
    twitter: faXTwitter,
    reddit: faReddit,
    github: faGithub,
    devto: faDev,
    medium: faMedium,
    hashnode: faHashnode,
  };
  return map[channelId] || faNewspaper;
}

export default function ArticleWriterScreen({ onFooterActionChange, onOpenSettings, avatarUrl, themeMode = 'light' }) {
  const editorHolderRef = useRef(null);
  const editorJsRef = useRef(null);
  const contentRef = useRef(null);
  const [topic, setTopic] = useState('Dein Post braucht einen Titel...');
  const [content, setContent] = useState('');
  const [editorMode, setEditorMode] = useState('editorjs');
  const [editorBlocks, setEditorBlocks] = useState({ blocks: [] });
  const [audience, setAudience] = useState('Selbstständige, Creator, Unternehmer');
  const [metaTab, setMetaTab] = useState('basics');
  const [visualMode, setVisualMode] = useState('bild_url');
  const [subTitle, setSubTitle] = useState('');
  const [publishDate, setPublishDate] = useState('');
  const [tags, setTags] = useState('');
  const [slug, setSlug] = useState('');
  const [ogTitle, setOgTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [coverImageAlt, setCoverImageAlt] = useState('');
  const [ogImageUrl, setOgImageUrl] = useState('');
  const [canonicalUrl, setCanonicalUrl] = useState('');
  const [channel, setChannel] = useState('blog');
  const [planDate, setPlanDate] = useState('');
  const [planTime, setPlanTime] = useState('12:00');
  const [metaOpen, setMetaOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [imagePickerTarget, setImagePickerTarget] = useState('meta');
  const [imageList, setImageList] = useState([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [status, setStatus] = useState('');
  const zenImagePickCallbackRef = useRef(null);
  const isDark = themeMode === 'dark';

  const cloudSession = useMemo(() => getCloudSession(), []);
  const cloudReady = useMemo(() => !!cloudSession?.token && !!cloudSession?.projectId && !!cloudSession?.baseUrl, [cloudSession]);
  const projectLabel = cloudSession?.projectName || (cloudSession?.projectId ? `#${cloudSession.projectId}` : 'Offline');
  const headerSubtitle = cloudReady ? `Cloud Sync aktiv // ${projectLabel}` : 'Cloud offline // bitte anmelden';
  const hasEditorBlocks = useMemo(
    () =>
      Array.isArray(editorBlocks?.blocks) &&
      editorBlocks.blocks.some((b) => {
        if (b?.type === 'list') {
          return Array.isArray(b?.data?.items) && b.data.items.some((item) => stripHtml(item).length > 0);
        }
        return stripHtml(b?.data?.text).length > 0;
      }),
    [editorBlocks]
  );
  const hasContent = useMemo(
    () => topic.trim().length > 0 || (editorMode === 'editorjs' ? hasEditorBlocks : content.trim().length > 0),
    [topic, editorMode, hasEditorBlocks, content]
  );

  const draftPayload = useMemo(
    () => ({
      type: 'article-draft',
      title: topic.trim() || 'Ohne Titel',
      content: editorMode === 'editorjs' ? JSON.stringify(editorBlocks || { blocks: [] }) : content.trim(),
      contentType: editorMode,
      meta: { audience },
      postMeta: {
        subTitle,
        publishDate,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        slug,
        excerpt,
        visualMode,
        coverImageUrl,
        coverImageAlt,
        ogTitle,
        ogImageUrl,
        canonicalUrl,
        channel,
        channelLabel: getChannelLabel(channel),
        planDate,
        planTime,
      },
      createdAt: new Date().toISOString(),
    }),
    [topic, content, editorMode, editorBlocks, audience, subTitle, publishDate, tags, slug, excerpt, visualMode, coverImageUrl, coverImageAlt, ogTitle, ogImageUrl, canonicalUrl, channel, planDate, planTime]
  );

  const handleSave = async () => {
    if (!hasContent) {
      setStatus('Nichts zu speichern.');
      return;
    }
    saveDraftLocal(draftPayload);
    if (!cloudReady) {
      setStatus('Entwurf lokal gespeichert.');
      window.setTimeout(() => setStatus(''), 1800);
      return;
    }
    const docId = await createZenCloudArticleDraft(draftPayload);
    if (!docId) {
      setStatus('Lokal gespeichert, Cloud fehlgeschlagen.');
      window.setTimeout(() => setStatus(''), 2200);
      return;
    }

    let plannerHint = 'ohne Kalender';
    if (planDate.trim()) {
      const plannerResult = await upsertPlannerEntryFromArticleDraft({
        draft: draftPayload,
        articleDocId: docId,
        planDate,
        planTime,
      });
      plannerHint = plannerResult?.ok ? 'mit Kalender' : 'Kalender fehlgeschlagen';
    }
    setStatus(`Entwurf lokal + Cloud gespeichert (#${docId}) // ${plannerHint}.`);
    window.setTimeout(() => setStatus(''), 3200);
  };

  const openImagePicker = async (target = 'meta', onPick = null) => {
    setImagePickerTarget(target);
    zenImagePickCallbackRef.current = typeof onPick === 'function' ? onPick : null;
    setImagePickerOpen(true);
    setLoadingImages(true);
    const list = await listZenCloudImages();
    setImageList(list);
    setLoadingImages(false);
  };

  const applyImageToMeta = (img) => {
    if (!img?.url) return;
    setCoverImageUrl(img.url);
    if (!coverImageAlt.trim()) setCoverImageAlt(img.fileName || '');
    setImagePickerOpen(false);
  };

  const insertImageIntoDraft = (img) => {
    if (!img?.url) return;
    const alt = (coverImageAlt || img.fileName || 'Bild').replace(/\.(webp|png|jpg|jpeg|gif)$/i, '');
    if (editorMode === 'editorjs' && editorJsRef.current) {
      editorJsRef.current.blocks.insert('zenimage', { url: img.url, alt });
      editorJsRef.current.save().then((data) => setEditorBlocks(data)).catch(() => {});
    } else {
      const md = `![${alt}](${img.url})`;
      insertAtCursor(md, { inline: false });
    }
    setImagePickerOpen(false);
  };

  const insertAtCursor = (snippet, opts = { inline: true }) => {
    const el = contentRef.current;
    if (!el) {
      setContent((prev) => `${prev || ''}${snippet}`);
      return;
    }
    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? content.length;
    const before = content.slice(0, start);
    const after = content.slice(end);
    const insertText = opts.inline ? snippet : `\n\n${snippet}\n`;
    const next = `${before}${insertText}${after}`;
    setContent(next);
    window.requestAnimationFrame(() => {
      const pos = start + insertText.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const wrapSelection = (left, right = left) => {
    const el = contentRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const selected = content.slice(start, end) || 'Text';
    const next = `${content.slice(0, start)}${left}${selected}${right}${content.slice(end)}`;
    setContent(next);
    window.requestAnimationFrame(() => {
      const selStart = start + left.length;
      const selEnd = selStart + selected.length;
      el.focus();
      el.setSelectionRange(selStart, selEnd);
    });
  };

  const insertEditorBlock = async (type, data = {}) => {
    if (editorMode !== 'editorjs' || !editorJsRef.current) return;
    try {
      editorJsRef.current.blocks.insert(type, data, undefined, undefined, true);
      const saved = await editorJsRef.current.save();
      setEditorBlocks(saved);
    } catch {
      // ignore insertion errors
    }
  };

  const transformCurrentEditorBlock = async (targetType, opts = {}) => {
    if (editorMode !== 'editorjs' || !editorJsRef.current) return;
    try {
      const api = editorJsRef.current;
      const currentIndex = api.blocks.getCurrentBlockIndex();
      const saved = await api.save();
      const blocks = Array.isArray(saved?.blocks) ? saved.blocks : [];
      const current = blocks[currentIndex];
      const sourceText = stripHtml(current?.data?.text) || '';
      const sourceItems = Array.isArray(current?.data?.items)
        ? current.data.items.map((item) => stripHtml(item)).filter(Boolean)
        : [];
      const sourceCombinedText = sourceText || sourceItems.join(' ').trim();

      let nextData = {};
      if (targetType === 'header') {
        nextData = { text: sourceCombinedText || (opts.level === 1 ? 'Überschrift' : 'Unterüberschrift'), level: opts.level || 2 };
      } else if (targetType === 'paragraph') {
        nextData = { text: sourceCombinedText || 'Text' };
      } else if (targetType === 'list') {
        const fallback = opts.data?.style === 'ordered' ? 'Punkt' : 'Listenpunkt';
        const fromText = sourceText
          .split('\n')
          .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, '').trim())
          .filter(Boolean);
        const items = sourceItems.length ? sourceItems : fromText.length ? fromText : [fallback];
        nextData = { style: opts.data?.style === 'ordered' ? 'ordered' : 'unordered', items };
      } else if (targetType === 'quote') {
        nextData = { text: sourceCombinedText || 'Zitat', caption: '', alignment: 'left' };
      } else {
        nextData = opts.data || {};
      }

      if (currentIndex >= 0 && current) {
        api.blocks.delete(currentIndex);
        api.blocks.insert(targetType, nextData, undefined, currentIndex, true);
      } else {
        api.blocks.insert(targetType, nextData, undefined, undefined, true);
      }

      const next = await api.save();
      setEditorBlocks(next);
    } catch {
      // ignore conversion errors
    }
  };

  useEffect(() => {
    if (!onFooterActionChange) return undefined;
    onFooterActionChange({
      plusLabel: hasContent ? 'Entwurf speichern' : 'Neu erstellen',
      plusSymbol: hasContent ? 'S' : '+',
      onPlus: () => {
        if (hasContent) void handleSave();
      },
      items: [
        { key: 'aw-home', tabKey: 'HomeDashboard', label: 'Home', type: 'tab' },
        { key: 'aw-meta', label: 'Meta', type: 'action', actionKey: 'meta' },
        { key: 'aw-plus', label: '+', type: 'plus' },
        { key: 'aw-preview', label: 'Preview', type: 'action', actionKey: 'preview' },
        { key: 'aw-dashboard', tabKey: 'Dashboard', label: 'Aktionen', type: 'tab' },
      ],
      actions: {
        meta: () => setMetaOpen(true),
        preview: () => setPreviewOpen(true),
      },
    });
    return () => onFooterActionChange(null);
  }, [onFooterActionChange, hasContent, draftPayload]);

  useEffect(() => {
    const raw = sessionStorage.getItem('zenpost_open_article_draft');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      setTopic(String(parsed?.title || '').trim() || 'Ohne Titel');
      if (parsed?.contentType === 'editorjs') {
        let blocks = { blocks: [] };
        try {
          blocks = JSON.parse(String(parsed?.content || '{"blocks":[]}'));
        } catch {
          blocks = { blocks: [] };
        }
        setEditorMode('editorjs');
        setEditorBlocks(normalizeEditorBlocksPayload(blocks));
      } else {
        setEditorMode('markdown');
        setContent(String(parsed?.content || ''));
      }
      setAudience(String(parsed?.meta?.audience || audience));
      setSubTitle(String(parsed?.postMeta?.subTitle || ''));
      setPublishDate(String(parsed?.postMeta?.publishDate || ''));
      setTags(Array.isArray(parsed?.postMeta?.tags) ? parsed.postMeta.tags.join(', ') : '');
      setSlug(String(parsed?.postMeta?.slug || ''));
      setExcerpt(String(parsed?.postMeta?.excerpt || ''));
      setVisualMode(String(parsed?.postMeta?.visualMode || 'bild_url'));
      setCoverImageUrl(String(parsed?.postMeta?.coverImageUrl || ''));
      setCoverImageAlt(String(parsed?.postMeta?.coverImageAlt || ''));
      setOgTitle(String(parsed?.postMeta?.ogTitle || ''));
      setOgImageUrl(String(parsed?.postMeta?.ogImageUrl || ''));
      setCanonicalUrl(String(parsed?.postMeta?.canonicalUrl || ''));
      setChannel(String(parsed?.postMeta?.channel || 'blog'));
      setPlanDate(String(parsed?.postMeta?.planDate || parsed?.postMeta?.publishDate || ''));
      setPlanTime(String(parsed?.postMeta?.planTime || '12:00'));
    } catch {
      // ignore invalid handover payload
    } finally {
      sessionStorage.removeItem('zenpost_open_article_draft');
    }
  }, []);

  useEffect(() => {
    if (editorMode !== 'editorjs') return undefined;
    if (!editorHolderRef.current) return undefined;
    let destroyed = false;

    const boot = async () => {
      if (editorJsRef.current) return;
      const [{ default: EditorJS }, { default: Header }, { default: List }, { default: Quote }, { default: Delimiter }] = await Promise.all([
        import('@editorjs/editorjs'),
        import('@editorjs/header'),
        import('@editorjs/list'),
        import('@editorjs/quote'),
        import('@editorjs/delimiter'),
      ]);

      if (destroyed || !editorHolderRef.current) return;

      class ZenImageTool {
        static get toolbox() {
          return {
            title: 'ZenImage',
            icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3.5" y="5.5" width="17" height="13" rx="2.5" stroke="currentColor" stroke-width="1.8"/><circle cx="9" cy="10" r="1.3" fill="currentColor"/><path d="M6.2 16.2l3.8-3.4 2.7 2.2 2.9-2.5 2.2 3.7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
          };
        }

        constructor({ data, config }) {
          this.data = data || {};
          this.config = config || {};
          this.wrapper = null;
          this.img = null;
          this.caption = null;
        }

        render() {
          const wrapper = document.createElement('div');
          wrapper.className = 'rounded-[10px] border border-[#e8dece] bg-white p-2';

          const preview = document.createElement('div');
          preview.className = 'overflow-hidden rounded-[8px] border border-[#efe9df] bg-[#f7f2e8]';

          const img = document.createElement('img');
          img.className = 'hidden w-full';
          if (this.data.url) {
            img.src = this.data.url;
            img.alt = this.data.alt || 'Bild';
            img.classList.remove('hidden');
          }
          preview.appendChild(img);

          const caption = document.createElement('p');
          caption.className = 'mt-1 text-[11px] text-[#8a8174]';
          caption.textContent = this.data.alt || '';

          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'mt-2 rounded-full border border-[#d6c6ad] bg-[#f3ecdf] px-3 py-1.5 text-[11px] font-semibold text-[#5d4a33]';
          button.textContent = this.data.url ? 'ZenImage ändern' : 'Aus ZenImage wählen';
          button.addEventListener('click', () => {
            if (typeof this.config.onPick !== 'function') return;
            this.config.onPick((picked) => {
              if (!picked?.url) return;
              const nextAlt = (picked.fileName || 'Bild').replace(/\.(webp|png|jpg|jpeg|gif)$/i, '');
              this.data = { url: picked.url, alt: nextAlt };
              img.src = picked.url;
              img.alt = nextAlt;
              img.classList.remove('hidden');
              caption.textContent = nextAlt;
              button.textContent = 'ZenImage ändern';
            });
          });

          wrapper.appendChild(preview);
          wrapper.appendChild(caption);
          wrapper.appendChild(button);

          this.wrapper = wrapper;
          this.img = img;
          this.caption = caption;
          return wrapper;
        }

        save() {
          return {
            url: this.data.url || '',
            alt: this.data.alt || '',
          };
        }
      }

      const normalizedInitial = normalizeEditorBlocksPayload(editorBlocks?.blocks?.length ? editorBlocks : { blocks: [] });
      const instance = new EditorJS({
        holder: editorHolderRef.current,
        data: normalizedInitial,
        placeholder: 'Platz für Deine Gedanken …',
        tools: {
          header: Header,
          list: List,
          quote: Quote,
          delimiter: Delimiter,
          zenimage: {
            class: ZenImageTool,
            config: {
              onPick: (cb) => openImagePicker('editorjs', cb),
            },
          },
        },
        async onChange(api) {
          const data = await api.saver.save();
          setEditorBlocks(normalizeEditorBlocksPayload(data));
        },
      });

      editorJsRef.current = instance;
      await instance.isReady;
    };

    boot();

    return () => {
      destroyed = true;
    };
  }, [editorMode, editorBlocks]);

  useEffect(() => {
    return () => {
      if (editorJsRef.current) {
        editorJsRef.current.destroy();
        editorJsRef.current = null;
      }
    };
  }, []);

  return (
    <div className={`min-h-[100dvh] w-full ${isDark ? 'bg-[#121212] text-[#ece7df]' : 'bg-[#f5f1ea] text-[#171717]'}`}>
      <section className="mx-auto w-full max-w-[390px] px-4 pb-44 pt-4">
        <AppHeader
          sticky
          stickyClassName={isDark ? 'bg-[#121212]/95' : 'bg-[#f5f1ea]/95'}
          title="Artikel schreiben"
          subtitle={headerSubtitle}
          titleAlign="left"
          titleClassName={isDark ? 'text-[#f0ebe3]' : 'text-[#191919]'}
          subtitleClassName={isDark ? 'text-[#a1988a]' : 'text-[#8a8174]'}
          right={
            <button onClick={() => onOpenSettings?.()} aria-label="Profil öffnen" className="mt-0 h-10 w-10 overflow-hidden rounded-full border-[0.5px] border-[#AC8E66]">
              <img src={avatarUrl} alt="Profilbild" className="h-full w-full object-cover" />
            </button>
          }
        />

        <div className="mt-6">
          <label htmlFor="topicInput" className={`block text-[10px] font-normal ${isDark ? 'text-[#9f988b]' : 'text-[#a09a8f]'}`}>Titel</label>
          <input
            id="topicInput"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className={`mt-2 w-full rounded-[8px] border px-4 py-3 text-[12px] font-normal outline-none ${isDark ? 'border-[#3a352f] bg-[#1c1c1c] text-[#ece7df] focus:border-[#5a5246]' : 'border-[#efe9df] bg-[#fbf8f3] text-[#222] focus:border-[#ddd4c7]'}`}
          />
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between">
            <label htmlFor="contentInput" className={`block text-[10px] font-normal ${isDark ? 'text-[#9f988b]' : 'text-[#a09a8f]'}`}>Entwurf</label>
            <div className="flex gap-1">
              <button type="button" onClick={() => setEditorMode('editorjs')} className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${editorMode === 'editorjs' ? 'border-[#b99a69] bg-[#e8d6b9] text-[#3d2f1d]' : isDark ? 'border-[#3a352f] bg-[#1f1f1f] text-[#b8ae9f]' : 'border-[#e0d4c1] bg-[#fbf8f3] text-[#6b6255]'}`}>Editor.js</button>
              <button type="button" onClick={() => setEditorMode('markdown')} className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${editorMode === 'markdown' ? 'border-[#b99a69] bg-[#e8d6b9] text-[#3d2f1d]' : isDark ? 'border-[#3a352f] bg-[#1f1f1f] text-[#b8ae9f]' : 'border-[#e0d4c1] bg-[#fbf8f3] text-[#6b6255]'}`}>Markdown</button>
            </div>
          </div>
          {editorMode === 'editorjs' ? (
            <div className={`mt-2 min-h-[46dvh] rounded-[8px] border px-2 py-2 ${isDark ? 'border-[#3a352f] bg-[#1c1c1c]' : 'border-[#efe9df] bg-[#fbf8f3]'}`}>
              <div
                ref={editorHolderRef}
                className="min-h-[44dvh] text-[14px] [&_.ce-toolbar]:hidden [&_.ce-popover]:hidden [&_.ce-settings]:hidden [&_.ce-paragraph]:text-[14px] [&_.ce-paragraph]:leading-[1.55] [&_.ce-header]:mb-2 [&_.ce-header]:leading-[1.25] [&_.ce-header]:text-[#1d1b18] [&_h1.ce-header]:text-[28px] [&_h1.ce-header]:font-bold [&_h2.ce-header]:text-[23px] [&_h2.ce-header]:font-bold [&_h3.ce-header]:text-[19px] [&_h3.ce-header]:font-semibold [&_h4.ce-header]:text-[17px] [&_h4.ce-header]:font-semibold [&_h5.ce-header]:text-[15px] [&_h5.ce-header]:font-semibold [&_h6.ce-header]:text-[14px] [&_h6.ce-header]:font-semibold"
              />
            </div>
          ) : (
            <>
              <textarea
                id="contentInput"
                ref={contentRef}
                rows="14"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Schreibe deinen Artikelentwurf …"
                className={`mt-2 w-full min-h-[46dvh] resize-none rounded-[12px] border px-4 py-4 text-[10px] font-medium outline-none ${isDark ? 'border-[#3a352f] bg-[#1c1c1c] text-[#ece7df] placeholder:text-[#7f786a] focus:border-[#5a5246]' : 'border-[#efe9df] bg-[#fbf8f3] text-[#222] placeholder:text-[#b6b0a6] focus:border-[#ddd4c7]'}`}
              />
            </>
          )}
        </div>

        {status ? <p className="mt-3 text-[11px] text-[#8a8174]">{status}</p> : null}
      </section>

      {!metaOpen && !previewOpen && !imagePickerOpen && editorMode === 'markdown' ? (
        <div className={`fixed bottom-[98px] left-2 right-2 z-[35] mx-auto w-full max-w-[390px] rounded-[8px] border p-2 shadow-[0_8px_20px_rgba(0,0,0,0.12)] backdrop-blur ${isDark ? 'border-[#3a352f] bg-[#171717]/98' : 'border-[#dfd3bf] bg-[#f7f2e8]/98'}`}>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => wrapSelection('**')} className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${isDark ? 'border-[#4a4338] bg-[#212121] text-[#d8c8ad]' : 'border-[#d6c6ad] bg-[#fffdfa] text-[#4e4333]'}`}>B</button>
            <button type="button" onClick={() => wrapSelection('*')} className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${isDark ? 'border-[#4a4338] bg-[#212121] text-[#d8c8ad]' : 'border-[#d6c6ad] bg-[#fffdfa] text-[#4e4333]'}`}>I</button>
            <button type="button" onClick={() => insertAtCursor('\n# Überschrift\n', { inline: false })} className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${isDark ? 'border-[#4a4338] bg-[#212121] text-[#d8c8ad]' : 'border-[#d6c6ad] bg-[#fffdfa] text-[#4e4333]'}`}>H1</button>
            <button type="button" onClick={() => insertAtCursor('\n## Unterüberschrift\n', { inline: false })} className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${isDark ? 'border-[#4a4338] bg-[#212121] text-[#d8c8ad]' : 'border-[#d6c6ad] bg-[#fffdfa] text-[#4e4333]'}`}>H2</button>
            <button type="button" onClick={() => insertAtCursor('\n- Listenpunkt\n', { inline: false })} className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${isDark ? 'border-[#4a4338] bg-[#212121] text-[#d8c8ad]' : 'border-[#d6c6ad] bg-[#fffdfa] text-[#4e4333]'}`}>UL</button>
            <button type="button" onClick={() => insertAtCursor('\n1. Punkt\n', { inline: false })} className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${isDark ? 'border-[#4a4338] bg-[#212121] text-[#d8c8ad]' : 'border-[#d6c6ad] bg-[#fffdfa] text-[#4e4333]'}`}>OL</button>
            <button type="button" onClick={() => wrapSelection('[', '](https://)')} className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${isDark ? 'border-[#4a4338] bg-[#212121] text-[#d8c8ad]' : 'border-[#d6c6ad] bg-[#fffdfa] text-[#4e4333]'}`}>Link</button>
            <button type="button" onClick={() => openImagePicker('insert')} className="rounded-full border border-[#c7ae84] bg-[#e9d8bb] px-2 py-1 text-[11px] font-semibold text-[#3d2f1d]">ZenImage</button>
          </div>
        </div>
      ) : null}

      {!metaOpen && !previewOpen && !imagePickerOpen && editorMode === 'editorjs' ? (
        <div className={`fixed bottom-[86px] left-2 right-2 z-[31] mx-auto w-full max-w-[390px] rounded-[8px] border p-2 shadow-[0_8px_20px_rgba(0,0,0,0.12)] backdrop-blur ${isDark ? 'border-[#3a352f] bg-[#171717]/98' : 'border-[#dfd3bf] bg-[#f7f2e8]/98'}`}>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => transformCurrentEditorBlock('header', { level: 1 })} className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${isDark ? 'border-[#4a4338] bg-[#212121] text-[#d8c8ad]' : 'border-[#d6c6ad] bg-[#fffdfa] text-[#4e4333]'}`}>H1</button>
            <button type="button" onClick={() => transformCurrentEditorBlock('header', { level: 2 })} className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${isDark ? 'border-[#4a4338] bg-[#212121] text-[#d8c8ad]' : 'border-[#d6c6ad] bg-[#fffdfa] text-[#4e4333]'}`}>H2</button>
            <button type="button" onClick={() => transformCurrentEditorBlock('paragraph')} className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${isDark ? 'border-[#4a4338] bg-[#212121] text-[#d8c8ad]' : 'border-[#d6c6ad] bg-[#fffdfa] text-[#4e4333]'}`}>Text</button>
            <button type="button" onClick={() => transformCurrentEditorBlock('list', { data: { style: 'unordered' } })} className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${isDark ? 'border-[#4a4338] bg-[#212121] text-[#d8c8ad]' : 'border-[#d6c6ad] bg-[#fffdfa] text-[#4e4333]'}`}>UL</button>
            <button type="button" onClick={() => transformCurrentEditorBlock('list', { data: { style: 'ordered' } })} className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${isDark ? 'border-[#4a4338] bg-[#212121] text-[#d8c8ad]' : 'border-[#d6c6ad] bg-[#fffdfa] text-[#4e4333]'}`}>OL</button>
            <button type="button" onClick={() => transformCurrentEditorBlock('quote')} className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${isDark ? 'border-[#4a4338] bg-[#212121] text-[#d8c8ad]' : 'border-[#d6c6ad] bg-[#fffdfa] text-[#4e4333]'}`}>Quote</button>
            <button type="button" onClick={() => insertEditorBlock('delimiter', {})} className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${isDark ? 'border-[#4a4338] bg-[#212121] text-[#d8c8ad]' : 'border-[#d6c6ad] bg-[#fffdfa] text-[#4e4333]'}`}>—</button>
            <button type="button" onClick={() => openImagePicker('insert')} className="rounded-full border border-[#c7ae84] bg-[#e9d8bb] px-2 py-1 text-[11px] font-semibold text-[#3d2f1d]">ZenImage</button>
          </div>
        </div>
      ) : null}

      <div className={`fixed inset-0 z-40 transition ${metaOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <button type="button" onClick={() => setMetaOpen(false)} className={`absolute inset-0 bg-black/35 transition-opacity ${metaOpen ? 'opacity-100' : 'opacity-0'}`} aria-label="Sheet schließen" />
        <section className={`absolute bottom-0 left-0 right-0 mx-auto w-full max-w-[390px] rounded-t-[20px] border px-4 pb-6 pt-4 shadow-[0_-10px_28px_rgba(0,0,0,0.18)] transition-transform duration-200 ${isDark ? 'border-[#3a352f] bg-[#171717]' : 'border-[#e8dece] bg-[#f7f2e8]'} ${metaOpen ? 'translate-y-0' : 'translate-y-full'}`}>
          <SheetHeader title="Post Meta" onClose={() => setMetaOpen(false)} closeLabel="Post Setup schließen" isDark={isDark} />

          <div className="mt-3 flex gap-2">
            {[
              ['basics', 'Basics'],
              ['seo', 'SEO'],
              ['media', 'Media'],
              ['distribution', 'SocialMedia'],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setMetaTab(key)}
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${metaTab === key ? 'border-[#b99a69] bg-[#e8d6b9] text-[#3d2f1d]' : isDark ? 'border-[#3a352f] bg-[#1f1f1f] text-[#b8ae9f]' : 'border-[#e0d4c1] bg-[#fbf8f3] text-[#6b6255]'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {metaTab === 'basics' ? (
            <div className="mt-4">
              <label htmlFor="subtitleInput" className={`mt-4 block text-[12px] font-semibold ${isDark ? 'text-[#a1988a]' : 'text-[#8f846f]'}`}>Untertitel</label>
              <input id="subtitleInput" value={subTitle} onChange={(e) => setSubTitle(e.target.value)} className={`mt-2 w-full rounded-[12px] border px-3 py-2 text-[13px] outline-none ${isDark ? 'border-[#3a352f] bg-[#1f1f1f] text-[#ece7df] focus:border-[#5a5246]' : 'border-[#e0d4c1] bg-[#fbf8f3] focus:border-[#cdb18a]'}`} />
              <label htmlFor="publishDateInput" className={`mt-3 block text-[12px] font-semibold ${isDark ? 'text-[#a1988a]' : 'text-[#8f846f]'}`}>Datum</label>
              <input id="publishDateInput" type="date" value={publishDate} onChange={(e) => setPublishDate(e.target.value)} className={`mt-2 w-full rounded-[12px] border px-3 py-2 text-[13px] outline-none ${isDark ? 'border-[#3a352f] bg-[#1f1f1f] text-[#ece7df] focus:border-[#5a5246]' : 'border-[#e0d4c1] bg-[#fbf8f3] focus:border-[#cdb18a]'}`} />
            </div>
          ) : null}

          {metaTab === 'seo' ? (
            <div className="mt-4">
              <label htmlFor="tagsInput" className="block text-[12px] font-semibold text-[#8f846f]">Tags/Keywords</label>
              <input id="tagsInput" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="ai, marketing, creator" className="mt-2 w-full rounded-[12px] border border-[#e0d4c1] bg-[#fbf8f3] px-3 py-2 text-[13px] outline-none focus:border-[#cdb18a]" />
              <label htmlFor="slugInput" className="mt-3 block text-[12px] font-semibold text-[#8f846f]">Slug</label>
              <input id="slugInput" value={slug} onChange={(e) => setSlug(e.target.value)} className="mt-2 w-full rounded-[12px] border border-[#e0d4c1] bg-[#fbf8f3] px-3 py-2 text-[13px] outline-none focus:border-[#cdb18a]" />
              <label htmlFor="excerptInput" className="mt-3 block text-[12px] font-semibold text-[#8f846f]">Excerpt</label>
              <textarea id="excerptInput" rows="2" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} className="mt-2 w-full resize-none rounded-[12px] border border-[#e0d4c1] bg-[#fbf8f3] px-3 py-2 text-[13px] outline-none focus:border-[#cdb18a]" />
              <label htmlFor="ogTitleInput" className="mt-3 block text-[12px] font-semibold text-[#8f846f]">OG Titel</label>
              <input id="ogTitleInput" value={ogTitle} onChange={(e) => setOgTitle(e.target.value)} className="mt-2 w-full rounded-[12px] border border-[#e0d4c1] bg-[#fbf8f3] px-3 py-2 text-[13px] outline-none focus:border-[#cdb18a]" />
              <label htmlFor="ogImageInput" className="mt-3 block text-[12px] font-semibold text-[#8f846f]">OG Bild-URL</label>
              <input id="ogImageInput" value={ogImageUrl} onChange={(e) => setOgImageUrl(e.target.value)} className="mt-2 w-full rounded-[12px] border border-[#e0d4c1] bg-[#fbf8f3] px-3 py-2 text-[13px] outline-none focus:border-[#cdb18a]" />
              <label htmlFor="canonicalInput" className="mt-3 block text-[12px] font-semibold text-[#8f846f]">Canonical URL</label>
              <input id="canonicalInput" value={canonicalUrl} onChange={(e) => setCanonicalUrl(e.target.value)} className="mt-2 w-full rounded-[12px] border border-[#e0d4c1] bg-[#fbf8f3] px-3 py-2 text-[13px] outline-none focus:border-[#cdb18a]" />
            </div>
          ) : null}

          {metaTab === 'media' ? (
            <div className="mt-4">
              <p className="mb-2 text-[12px] font-semibold text-[#8f846f]">Visual Modus</p>
              <div className="flex flex-wrap gap-2.5">
                {[
                  ['bild_url', 'Bild URL'],
                  ['placeholder', 'Placeholder'],
                ].map(([value, label]) => (
                  <button key={value} onClick={() => setVisualMode(value)} className={`rounded-full border px-4 py-2 text-[11px] font-semibold ${visualMode === value ? 'border-[#b99a69] bg-[#e8d6b9] text-[#3d2f1d]' : 'border-[#e0d4c1] bg-[#fbf8f3] text-[#3a3936]'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <label htmlFor="coverImageInput" className="mt-4 block text-[12px] font-semibold text-[#8f846f]">Bild-URL</label>
              <input id="coverImageInput" value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} placeholder="https://..." className="mt-2 w-full rounded-[12px] border border-[#e0d4c1] bg-[#fbf8f3] px-3 py-2 text-[13px] outline-none focus:border-[#cdb18a]" />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={openImagePicker}
                  className="rounded-full border border-[#d6c6ad] bg-[#f3ecdf] px-3 py-1.5 text-[11px] font-semibold text-[#5d4a33]"
                >
                  Aus ZenImage wählen
                </button>
              </div>
              <label htmlFor="coverAltInput" className="mt-3 block text-[12px] font-semibold text-[#8f846f]">Bild-Titel / Alt</label>
              <input id="coverAltInput" value={coverImageAlt} onChange={(e) => setCoverImageAlt(e.target.value)} className="mt-2 w-full rounded-[12px] border border-[#e0d4c1] bg-[#fbf8f3] px-3 py-2 text-[13px] outline-none focus:border-[#cdb18a]" />
            </div>
          ) : null}

          {metaTab === 'distribution' ? (
            <div className="mt-4">
              <p className="mb-2 text-[12px] font-semibold text-[#8f846f]">Kanal</p>
              <div className="flex flex-wrap gap-2.5">
                {getDistributionChannels().map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setChannel(item.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-[11px] font-semibold ${
                      channel === item.id ? 'border-[#b99a69] bg-[#e8d6b9] text-[#3d2f1d]' : 'border-[#e0d4c1] bg-[#fbf8f3] text-[#3a3936]'
                    }`}
                    title={item.label}
                  >
                    <FontAwesomeIcon icon={getChannelIcon(item.id)} style={{ color: channel === item.id ? '#3d2f1d' : item.color || '#3a3936' }} />
                    {item.label}
                  </button>
                ))}
              </div>
              <label htmlFor="planDateInput" className={`mt-4 block text-[12px] font-semibold ${isDark ? 'text-[#a1988a]' : 'text-[#8f846f]'}`}>Plan-Datum (Kalender)</label>
              <input
                id="planDateInput"
                type="date"
                value={planDate}
                onChange={(e) => setPlanDate(e.target.value)}
                className={`mt-2 w-full rounded-[12px] border px-3 py-2 text-[13px] outline-none ${isDark ? 'border-[#3a352f] bg-[#1f1f1f] text-[#ece7df] focus:border-[#5a5246]' : 'border-[#e0d4c1] bg-[#fbf8f3] focus:border-[#cdb18a]'}`}
              />
              <label htmlFor="planTimeInput" className={`mt-3 block text-[12px] font-semibold ${isDark ? 'text-[#a1988a]' : 'text-[#8f846f]'}`}>Plan-Uhrzeit</label>
              <input
                id="planTimeInput"
                type="time"
                value={planTime}
                onChange={(e) => setPlanTime(e.target.value)}
                className={`mt-2 w-full rounded-[12px] border px-3 py-2 text-[13px] outline-none ${isDark ? 'border-[#3a352f] bg-[#1f1f1f] text-[#ece7df] focus:border-[#5a5246]' : 'border-[#e0d4c1] bg-[#fbf8f3] focus:border-[#cdb18a]'}`}
              />
            </div>
          ) : null}

          {metaTab === 'basics' ? (
            <div className="mt-4">
              <label htmlFor="audienceInput" className="block text-[12px] font-semibold text-[#8f846f]">Zielgruppe</label>
              <textarea id="audienceInput" rows="3" value={audience} onChange={(e) => setAudience(e.target.value)} className="mt-2 w-full resize-none rounded-[8px] border border-[#e0d4c1] bg-[#fbf8f3] px-4 py-3 text-[13px] font-medium text-[#3a3329] outline-none focus:border-[#cdb18a]" />
            </div>
          ) : null}
        </section>
      </div>

      <div className={`fixed inset-0 z-50 transition ${previewOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <button type="button" onClick={() => setPreviewOpen(false)} className={`absolute inset-0 bg-black/45 transition-opacity ${previewOpen ? 'opacity-100' : 'opacity-0'}`} aria-label="Preview schließen" />
        <section className={`absolute bottom-0 left-0 right-0 mx-auto w-full max-w-[390px] rounded-t-[20px] border px-4 pb-6 pt-4 shadow-[0_-10px_28px_rgba(0,0,0,0.22)] transition-transform duration-200 ${isDark ? 'border-[#3a352f] bg-[#171717]' : 'border-[#e8dece] bg-[#fbf8f3]'} ${previewOpen ? 'translate-y-0' : 'translate-y-full'}`}>
          <SheetHeader title="Preview" onClose={() => setPreviewOpen(false)} closeLabel="Preview schließen" isDark={isDark} />
          <h4 className={`mt-4 text-[18px] font-bold ${isDark ? 'text-[#f0ebe3]' : 'text-[#1d1b18]'}`}>{topic || 'Ohne Titel'}</h4>
          <p className={`mt-2 text-[11px] ${isDark ? 'text-[#a1988a]' : 'text-[#8a8174]'}`}>Zielgruppe: {audience || '-'}</p>
          <article className={`mt-3 max-h-[40vh] overflow-auto whitespace-pre-wrap rounded-[12px] border px-3 py-3 text-[13px] leading-[1.45] ${isDark ? 'border-[#3a352f] bg-[#0f0f0f] text-[#e8e1d6]' : 'border-[#e8dece] bg-white text-[#2a2722]'}`}>
            {editorMode === 'editorjs'
              ? (editorBlocks?.blocks || []).map((b, i) => renderEditorBlock(b, i))
              : (renderMarkdownContent(content, 'sheet-preview') || 'Noch kein Inhalt vorhanden.')}
          </article>
        </section>
      </div>

      <div className={`fixed inset-0 z-[60] transition ${imagePickerOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <button type="button" onClick={() => setImagePickerOpen(false)} className={`absolute inset-0 bg-black/45 transition-opacity ${imagePickerOpen ? 'opacity-100' : 'opacity-0'}`} aria-label="Bildauswahl schließen" />
        <section className={`absolute bottom-0 left-0 right-0 mx-auto w-full max-w-[390px] rounded-t-[20px] border px-4 pb-6 pt-4 shadow-[0_-10px_28px_rgba(0,0,0,0.22)] transition-transform duration-200 ${isDark ? 'border-[#3a352f] bg-[#171717]' : 'border-[#e8dece] bg-[#fbf8f3]'} ${imagePickerOpen ? 'translate-y-0' : 'translate-y-full'}`}>
          <SheetHeader title="ZenImage wählen" onClose={() => setImagePickerOpen(false)} closeLabel="Bildauswahl schließen" isDark={isDark} />
          <div className="mt-3 max-h-[52dvh] overflow-auto">
            {loadingImages ? (
              <p className={`text-[12px] ${isDark ? 'text-[#a1988a]' : 'text-[#8a8174]'}`}>Bilder werden geladen …</p>
            ) : imageList.length === 0 ? (
              <p className={`text-[12px] ${isDark ? 'text-[#a1988a]' : 'text-[#8a8174]'}`}>Keine Bilder in ZenImage gefunden.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {imageList.slice(0, 40).map((img) => (
                  <article key={img.id} className={`overflow-hidden rounded-[12px] border ${isDark ? 'border-[#3a352f] bg-[#0f0f0f]' : 'border-[#e8dece] bg-white'}`}>
                    <button type="button" onClick={() => applyImageToMeta(img)} className="block w-full text-left">
                      <div className="aspect-[4/3] bg-[#efebe3]">
                        {img.url ? <img src={img.url} alt={img.fileName} className="h-full w-full object-cover" /> : null}
                      </div>
                    </button>
                    <div className="px-2 py-2">
                      <p className={`truncate text-[11px] font-semibold ${isDark ? 'text-[#d8c8ad]' : 'text-[#3f3b35]'}`}>{img.fileName}</p>
                      <div className="mt-1.5 flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (imagePickerTarget === 'editorjs' && zenImagePickCallbackRef.current) {
                              zenImagePickCallbackRef.current(img);
                              zenImagePickCallbackRef.current = null;
                              setImagePickerOpen(false);
                              return;
                            }
                            if (imagePickerTarget === 'insert') {
                              insertImageIntoDraft(img);
                              return;
                            }
                            applyImageToMeta(img);
                          }}
                          className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${isDark ? 'border-[#4a4338] bg-[#212121] text-[#d8c8ad]' : 'border-[#d6c6ad] bg-[#f3ecdf] text-[#5d4a33]'}`}
                        >
                          {imagePickerTarget === 'meta' ? 'URL' : 'Einfügen'}
                        </button>
                        <button type="button" onClick={() => insertImageIntoDraft(img)} className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${isDark ? 'border-[#4a4338] bg-[#2a2722] text-[#d8c8ad]' : 'border-[#d6c6ad] bg-[#101113] text-[#f2ede5]'}`}>Direkt</button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
