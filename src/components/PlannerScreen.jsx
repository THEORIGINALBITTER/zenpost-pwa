import { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarDays, faRotate, faClock, faHashtag, faListUl } from '@fortawesome/free-solid-svg-icons';
import AppHeader from './AppHeader.jsx';
import ZenDropdownField from './ZenDropdownField.jsx';
import { getThemeMode, subscribeThemeMode } from '../services/themeService';
import { getCloudSession } from '../services/cloudAuthService';
import { loadZenCloudPlanner, loadZenCloudSchedule, saveZenCloudPlanner } from '../services/zenCloudService';
import { getChannelInfo } from '../services/distributionChannelsService';

const DEFAULT_TIME = '12:00';
const WEEKDAY_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTH_NAMES = ['Januar', 'Februar', 'Maerz', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

function normalizeDocTitle(value) {
  const text = String(value || '').trim();
  if (!text) return 'Ohne Titel';
  return text.length > 64 ? `${text.slice(0, 64)}...` : text;
}

function parseDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(raw)) {
    const [d, m, y] = raw.split('.').map(Number);
    return new Date(y, m - 1, d);
  }
  const dt = new Date(raw);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function formatDateLabel(value) {
  const parsed = parseDate(value);
  if (!parsed) return String(value || '-');
  return parsed.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseMinuteOfDay(value) {
  const raw = String(value || '').trim() || DEFAULT_TIME;
  const m = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return 12 * 60;
  const hh = Math.min(23, Math.max(0, Number(m[1])));
  const mm = Math.min(59, Math.max(0, Number(m[2])));
  return hh * 60 + mm;
}

function scheduleEntries(planner) {
  const posts = Array.isArray(planner?.manualPosts) ? planner.manualPosts : [];
  const schedules = planner?.schedules && typeof planner.schedules === 'object' ? planner.schedules : {};
  return posts
    .map((post) => {
      const id = String(post?.id || '');
      const schedule = schedules[id] || {};
      if (!schedule.date) return null;
      const parsedDate = parseDate(schedule.date);
      return {
        id,
        articleDocId: post?.articleDocId || null,
        title: normalizeDocTitle(post?.title),
        subtitle: String(post?.subtitle || '').trim(),
        tags: Array.isArray(post?.tags)
          ? post.tags.map((t) => String(t || '').trim()).filter(Boolean)
          : String(post?.tags || '')
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean),
        channel: String(post?.platform || 'all'),
        date: String(schedule.date),
        time: String(schedule.time || DEFAULT_TIME),
        parsedDate,
        content: String(post?.content || ''),
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const aDate = a.parsedDate ? a.parsedDate.getTime() : 0;
      const bDate = b.parsedDate ? b.parsedDate.getTime() : 0;
      if (aDate !== bDate) return aDate - bDate;
      return parseMinuteOfDay(a.time) - parseMinuteOfDay(b.time);
    });
}

function buildMonthCells(viewDate) {
  const y = viewDate.getFullYear();
  const m = viewDate.getMonth();
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  const firstWeekday = (first.getDay() + 6) % 7;
  const days = [];
  for (let i = 0; i < firstWeekday; i += 1) days.push(null);
  for (let d = 1; d <= last.getDate(); d += 1) days.push(new Date(y, m, d));
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

function toArticleDraft(row) {
  return {
    type: 'article-draft',
    title: row.title,
    contentType: 'markdown',
    content: row.content || '',
    meta: {},
    postMeta: {
      subTitle: row.subtitle || '',
      channel: row.channel || 'blog',
      planDate: row.date,
      planTime: row.time || DEFAULT_TIME,
      publishDate: row.date,
    },
  };
}

export default function PlannerScreen({ onOpenSettings, avatarUrl, onFooterActionChange, onOpenArticleDraft }) {
  const [themeMode, setThemeMode] = useState(() => getThemeMode());
  const [session, setSession] = useState(() => getCloudSession());
  const [planner, setPlanner] = useState(null);
  const [scheduledPosts, setScheduledPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('uebersicht');
  const [selectedEntryId, setSelectedEntryId] = useState('');
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [planSheetOpen, setPlanSheetOpen] = useState(false);
  const [planCreateMode, setPlanCreateMode] = useState(false);
  const [planDateInput, setPlanDateInput] = useState('');
  const [planTimeInput, setPlanTimeInput] = useState(DEFAULT_TIME);
  const [planChannelInput, setPlanChannelInput] = useState('linkedin');
  const [planTitleInput, setPlanTitleInput] = useState('');
  const [planSubtitleInput, setPlanSubtitleInput] = useState('');
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [editNameInput, setEditNameInput] = useState('');
  const [editTagsInput, setEditTagsInput] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [overviewFilter, setOverviewFilter] = useState('future');
  const [monthCursor, setMonthCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [selectedDayKey, setSelectedDayKey] = useState(() => formatDayKey(new Date()));
  const isDark = themeMode === 'dark';
  const isConfigured = useMemo(() => !!session.token && !!session.projectId && !!session.baseUrl, [session]);

  const refresh = async () => {
    if (!isConfigured) {
      setPlanner(null);
      return;
    }
    setLoading(true);
    const [nextPlanner, nextSchedule] = await Promise.all([
      loadZenCloudPlanner(),
      loadZenCloudSchedule(),
    ]);
    setPlanner(nextPlanner);
    setScheduledPosts(Array.isArray(nextSchedule) ? nextSchedule : []);
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
    void refresh();
  }, [isConfigured]);

  const rows = useMemo(() => {
    const fromPlanner = scheduleEntries(planner);
    const ids = new Set(fromPlanner.map((r) => r.id));
    const fromSchedule = (Array.isArray(scheduledPosts) ? scheduledPosts : [])
      .map((p) => {
        const id = String(p?.id || '');
        if (!id) return null;
        const dateRaw = p?.scheduledDate ? String(p.scheduledDate).split('T')[0] : '';
        if (!dateRaw) return null;
        const parsedDate = parseDate(dateRaw);
        return {
          id,
          articleDocId: null,
          title: normalizeDocTitle(p?.title || 'Ohne Titel'),
          subtitle: String(p?.subtitle || '').trim(),
          tags: [],
          channel: String(p?.platform || 'all'),
          date: dateRaw,
          time: String(p?.scheduledTime || DEFAULT_TIME),
          parsedDate,
          content: String(p?.content || ''),
        };
      })
      .filter(Boolean)
      .filter((r) => !ids.has(r.id));
    return [...fromPlanner, ...fromSchedule].sort((a, b) => {
      const aDate = a.parsedDate ? a.parsedDate.getTime() : 0;
      const bDate = b.parsedDate ? b.parsedDate.getTime() : 0;
      if (aDate !== bDate) return aDate - bDate;
      return parseMinuteOfDay(a.time) - parseMinuteOfDay(b.time);
    });
  }, [planner, scheduledPosts]);
  const plannedCount = rows.length;
  const totalPosts = Array.isArray(planner?.manualPosts) ? planner.manualPosts.length : 0;
  const dayCounts = useMemo(() => {
    const map = {};
    rows.forEach((r) => {
      if (!r.parsedDate) return;
      const key = formatDayKey(r.parsedDate);
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [rows]);
  const dayChannels = useMemo(() => {
    const map = {};
    rows.forEach((r) => {
      if (!r.parsedDate) return;
      const key = formatDayKey(r.parsedDate);
      const channelId = String(r.channel || 'blog').toLowerCase();
      if (!map[key]) map[key] = new Set();
      map[key].add(channelId);
    });
    return map;
  }, [rows]);
  const monthCells = useMemo(() => buildMonthCells(monthCursor), [monthCursor]);
  const selectedDayRows = useMemo(() => rows.filter((r) => r.parsedDate && formatDayKey(r.parsedDate) === selectedDayKey), [rows, selectedDayKey]);
  const todayKey = formatDayKey(new Date());
  const overdueCount = rows.filter((r) => r.parsedDate && formatDayKey(r.parsedDate) < todayKey).length;
  const todayCount = rows.filter((r) => r.parsedDate && formatDayKey(r.parsedDate) === todayKey).length;
  const futureRows = useMemo(() => rows.filter((r) => r.parsedDate && formatDayKey(r.parsedDate) > todayKey), [rows, todayKey]);
  const futureCount = futureRows.length;

  const overviewRows = useMemo(() => {
    if (overviewFilter === 'today') {
      return rows.filter((r) => r.parsedDate && formatDayKey(r.parsedDate) === todayKey);
    }
    if (overviewFilter === 'overdue') {
      return rows.filter((r) => r.parsedDate && formatDayKey(r.parsedDate) < todayKey);
    }
    if (overviewFilter === 'future') {
      return futureRows;
    }
    return rows;
  }, [rows, futureRows, overviewFilter, todayKey]);

  const overviewLabel = overviewFilter === 'today'
    ? 'Heute'
    : overviewFilter === 'overdue'
      ? 'Ueberfaellige Eintraege'
      : overviewFilter === 'future'
        ? 'In Zukunft'
        : 'Geplante Eintraege';
  const selectedRow = useMemo(() => rows.find((r) => String(r.id) === String(selectedEntryId)) || null, [rows, selectedEntryId]);

  const openArticleFromPlan = (row) => {
    try {
      sessionStorage.setItem('zenpost_open_article_draft', JSON.stringify(toArticleDraft(row)));
      onOpenArticleDraft?.();
    } catch {
      // ignore storage issue
    }
  };

  const deleteSelectedEntry = async () => {
    if (!selectedRow?.id) return;
    const current = await loadZenCloudPlanner();
    if (!current) return;
    const nextManualPosts = (Array.isArray(current.manualPosts) ? current.manualPosts : []).filter((p) => String(p?.id) !== String(selectedRow.id));
    const nextSchedules = { ...(current.schedules || {}) };
    delete nextSchedules[selectedRow.id];
    await saveZenCloudPlanner({ ...current, manualPosts: nextManualPosts, schedules: nextSchedules });
    setSelectedEntryId('');
    await refresh();
  };

  const openPlanSheet = (mode = 'edit') => {
    if (mode === 'create') {
      const now = new Date();
      setPlanCreateMode(true);
      setPlanDateInput(formatDayKey(now));
      setPlanTimeInput(DEFAULT_TIME);
      setPlanChannelInput('linkedin');
      setPlanTitleInput('');
      setPlanSubtitleInput('');
      setPlanSheetOpen(true);
      return;
    }
    if (!selectedRow) return;
    setPlanCreateMode(false);
    setPlanDateInput(String(selectedRow.date || ''));
    setPlanTimeInput(String(selectedRow.time || DEFAULT_TIME));
    setPlanChannelInput(String(selectedRow.channel || 'linkedin'));
    setPlanTitleInput(String(selectedRow.title || ''));
    setPlanSubtitleInput(String(selectedRow.subtitle || ''));
    setPlanSheetOpen(true);
  };

  const saveReschedule = async () => {
    const date = String(planDateInput || '').trim();
    const time = String(planTimeInput || DEFAULT_TIME).trim() || DEFAULT_TIME;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    const current = await loadZenCloudPlanner();
    if (!current) return;
    if (planCreateMode) {
      const newId = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const nextManualPosts = [
        ...(Array.isArray(current.manualPosts) ? current.manualPosts : []),
        {
          id: newId,
          title: String(planTitleInput || '').trim() || 'Neuer geplanter Post',
          subtitle: String(planSubtitleInput || '').trim(),
          platform: String(planChannelInput || 'linkedin').toLowerCase(),
          tags: [],
          content: '',
          articleDocId: null,
        },
      ];
      const nextSchedules = { ...(current.schedules || {}) };
      nextSchedules[newId] = { date, time };
      await saveZenCloudPlanner({ ...current, manualPosts: nextManualPosts, schedules: nextSchedules });
      setSelectedEntryId(newId);
      setPlanSheetOpen(false);
      setPlanCreateMode(false);
      await refresh();
      return;
    }
    if (!selectedRow?.id) return;
    const nextManualPosts = (Array.isArray(current.manualPosts) ? current.manualPosts : []).map((p) => {
      if (String(p?.id) !== String(selectedRow.id)) return p;
      return {
        ...p,
        platform: String(planChannelInput || p?.platform || 'linkedin').toLowerCase(),
      };
    });
    const nextSchedules = { ...(current.schedules || {}) };
    nextSchedules[selectedRow.id] = { date, time };
    await saveZenCloudPlanner({ ...current, manualPosts: nextManualPosts, schedules: nextSchedules });
    setPlanSheetOpen(false);
    setPlanCreateMode(false);
    await refresh();
  };

  const openEditSheet = () => {
    if (!selectedRow?.id) return;
    const post = (Array.isArray(planner?.manualPosts) ? planner.manualPosts : []).find((p) => String(p?.id) === String(selectedRow.id));
    const tags = Array.isArray(post?.tags)
      ? post.tags
      : String(post?.tags || '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
    setEditNameInput(String(post?.title || selectedRow.title || ''));
    setEditTagsInput(tags.join(', '));
    setEditSheetOpen(true);
  };

  const saveEditMeta = async () => {
    if (!selectedRow?.id) return;
    const current = await loadZenCloudPlanner();
    if (!current) return;
    const nextManualPosts = (Array.isArray(current.manualPosts) ? current.manualPosts : []).map((p) => {
      if (String(p?.id) !== String(selectedRow.id)) return p;
      return {
        ...p,
        title: String(editNameInput || '').trim() || String(p?.title || 'Ohne Titel'),
        tags: String(editTagsInput || '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      };
    });
    await saveZenCloudPlanner({ ...current, manualPosts: nextManualPosts });
    setEditSheetOpen(false);
    await refresh();
  };

  const openActionSheet = () => {
    if (!selectedRow) return;
    setActionSheetOpen(true);
  };

  useEffect(() => {
    if (!selectedEntryId && rows.length) setSelectedEntryId(rows[0].id);
  }, [rows, selectedEntryId]);

  useEffect(() => {
    if (!onFooterActionChange) return undefined;
    onFooterActionChange({
      plusLabel: 'Neuen Termin planen',
      onPlus: () => {
        openPlanSheet('create');
      },
      items: [
        { key: 'pl-home', tabKey: 'HomeDashboard', label: 'Home', type: 'tab' },
        {
          key: 'pl-list',
          label: activeTab === 'uebersicht' ? '● Übersicht' : 'Übersicht',
          type: 'action',
          actionKey: 'show_list',
          icon: faListUl,
        },
        { key: 'pl-plus', label: '+', type: 'plus' },
        {
          key: 'pl-calendar',
          label: activeTab === 'kalender' ? '● Kalender' : 'Kalender',
          type: 'action',
          actionKey: 'show_cal',
          icon: faCalendarDays,
        },
        { key: 'pl-actions', label: 'Aktionen', type: 'action', actionKey: 'open_actions', icon: faListUl },
      ],
      actions: {
        show_list: () => setActiveTab('uebersicht'),
        show_cal: () => setActiveTab('kalender'),
        open_actions: () => {
          if (!selectedRow) return;
          setActionSheetOpen(true);
        },
      },
    });
    return () => onFooterActionChange(null);
  }, [onFooterActionChange, activeTab, selectedRow]);

  const entryCard = (row) => (
    <article
      key={`${row.id}-${row.date}-${row.time}`}
      onClick={() => {
        setSelectedEntryId(row.id);
        if (activeTab === 'uebersicht') setActionSheetOpen(true);
      }}
      className={`cursor-pointer rounded-[14px] border p-3 ${
        String(selectedEntryId) === String(row.id)
          ? (isDark ? 'border-[#b39160] bg-[rgba(216,200,173,0.18)]' : 'border-[#c8ad7a] bg-[#f6efe3]')
          : (isDark ? 'border-[#3a352f] bg-[rgba(216,200,173,0.1)]' : 'border-[#eadfce] bg-[#fbf8f3]')
      }`}
    >
      <div className="flex items-start gap-2">
        <div className={`mt-[2px] grid h-8 w-8 place-items-center rounded-[9px] ${isDark ? 'bg-[#282522] text-[#d8c8ad]' : 'bg-[#efe7d9] text-[#6f593a]'}`}>
          <FontAwesomeIcon icon={faCalendarDays} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`truncate text-[14px] font-semibold ${isDark ? 'text-[#f0ebe3]' : 'text-[#232323]'}`}>{row.title}</p>
          <div className={`mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] ${isDark ? 'text-[#b2a99b]' : 'text-[#847b6e]'}`}>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: getChannelInfo(String(row.channel || 'blog').toLowerCase()).color }} />
              <FontAwesomeIcon icon={faHashtag} />
              {getChannelInfo(String(row.channel || 'blog').toLowerCase()).label}
            </span>
            <span>•</span>
            <span>{formatDateLabel(row.date)}</span>
            <span>•</span>
            <span className="inline-flex items-center gap-1"><FontAwesomeIcon icon={faClock} />{row.time}</span>
          </div>
          {Array.isArray(row.tags) && row.tags.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {row.tags.slice(0, 4).map((tag) => (
                <span
                  key={`${row.id}-${tag}`}
                  className={`rounded-full border px-2 py-[2px] text-[10px] ${
                    isDark ? 'border-[#595244] bg-[#26221d] text-[#d3c6b2]' : 'border-[#dccdb3] bg-[#f6efe2] text-[#6f5b3f]'
                  }`}
                >
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}
          {row.subtitle ? <p className={`mt-1 truncate text-[11px] ${isDark ? 'text-[#a1988a]' : 'text-[#938a7d]'}`}>{row.subtitle}</p> : null}
        </div>
      </div>
    </article>
  );

  return (
    <div className={`min-h-screen w-full ${isDark ? 'bg-[#121212] text-[#ece7df]' : 'bg-[#f5f1ea] text-[#171717]'}`}>
      <section className="mx-auto w-full max-w-[390px] px-4 pb-28 pt-4">
        <AppHeader
          sticky
          stickyClassName={isDark ? 'bg-[#121212]/95' : 'bg-[#f5f1ea]/95'}
          title="Zenpost Planer"
          subtitle={isConfigured ? `Geplant: ${plannedCount} // Posts: ${totalPosts}` : 'Cloud Login + Projekt waehlen'}
          titleAlign="left"
          titleClassName={isDark ? 'text-[#f0ebe3]' : 'text-[#191919]'}
          subtitleClassName={isDark ? 'text-[#a1988a]' : 'text-[#8a8174]'}
          right={(
            <button onClick={onOpenSettings} aria-label="Profil oeffnen" className="mt-0 h-10 w-10 overflow-hidden rounded-full border-[0.5px] border-[#AC8E66]">
              <img src={avatarUrl} alt="Profilbild" className="h-full w-full object-cover" />
            </button>
          )}
        />

        {!isConfigured ? (
          <div className={`mt-5 rounded-[14px] border p-3 ${isDark ? 'border-[#3d3b37] bg-[#1b1b1a]' : 'border-[#ece3d4] bg-[#fbf8f3]'}`}>
            <p className={`text-[12px] ${isDark ? 'text-[#a1988a]' : 'text-[#7f7768]'}`}>Nicht eingeloggt. Bitte ZenCloud in Profil verbinden.</p>
          </div>
        ) : (
          <>
         

            {activeTab === 'kalender' ? (
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                    className={`rounded-full border px-2 py-1 text-[11px] ${isDark ? 'border-[#5b5245] text-[#d4c8b5]' : 'border-[#d7c8ad] text-[#6d5a42]'}`}
                  >
                    Zurueck
                  </button>
                  <p className={`text-[12px] font-semibold ${isDark ? 'text-[#e8ddcc]' : 'text-[#3d342a]'}`}>
                    {MONTH_NAMES[monthCursor.getMonth()]} {monthCursor.getFullYear()}
                  </p>
                  <button
                    onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                    className={`rounded-full border px-2 py-1 text-[11px] ${isDark ? 'border-[#5b5245] text-[#d4c8b5]' : 'border-[#d7c8ad] text-[#6d5a42]'}`}
                  >
                    Weiter
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const now = new Date();
                      setMonthCursor(new Date(now.getFullYear(), now.getMonth(), 1));
                      setSelectedDayKey(formatDayKey(now));
                    }}
                    className={`rounded-full border px-2 py-1 text-[11px] ${isDark ? 'border-[#5b5245] text-[#d4c8b5]' : 'border-[#d7c8ad] text-[#6d5a42]'}`}
                  >
                    Heute
                  </button>
                  <button
                    onClick={() => setMonthCursor((prev) => {
                      const d = new Date(prev);
                      d.setDate(d.getDate() - 7);
                      return new Date(d.getFullYear(), d.getMonth(), 1);
                    })}
                    className={`rounded-full border px-2 py-1 text-[11px] ${isDark ? 'border-[#5b5245] text-[#d4c8b5]' : 'border-[#d7c8ad] text-[#6d5a42]'}`}
                  >
                    Woche -
                  </button>
                  <button
                    onClick={() => setMonthCursor((prev) => {
                      const d = new Date(prev);
                      d.setDate(d.getDate() + 7);
                      return new Date(d.getFullYear(), d.getMonth(), 1);
                    })}
                    className={`rounded-full border px-2 py-1 text-[11px] ${isDark ? 'border-[#5b5245] text-[#d4c8b5]' : 'border-[#d7c8ad] text-[#6d5a42]'}`}
                  >
                    Woche +
                  </button>
                </div>

                <div className={`rounded-[14px] border p-2 ${isDark ? 'border-[#3b3935] bg-[#1b1b1a]' : 'border-[#eadfce] bg-[#fbf8f3]'}`}>
                  <div className="mb-1 grid grid-cols-7 gap-1">
                    {WEEKDAY_SHORT.map((d) => (
                      <div key={d} className={`py-1 text-center text-[10px] font-semibold ${isDark ? 'text-[#ab9f8c]' : 'text-[#8f8476]'}`}>{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {monthCells.map((day, idx) => {
                      if (!day) return <div key={`empty-${idx}`} className="h-10 rounded-[8px]" />;
                      const key = formatDayKey(day);
                      const count = dayCounts[key] || 0;
                      const channels = Array.from(dayChannels[key] || []).slice(0, 3);
                      const isSel = key === selectedDayKey;
                      const isToday = key === todayKey;
                      return (
                        <button
                          key={key}
                          onClick={() => setSelectedDayKey(key)}
                          className={`h-10 rounded-[8px] border text-[11px] ${
                            isSel
                              ? (isDark ? 'border-[#b39160] bg-[#2f2820] text-[#f4e6d0]' : 'border-[#c8ad7a] bg-[#efe3cf] text-[#4b3c2a]')
                              : (isDark ? 'border-[#413b31] bg-[#201d19] text-[#d8ccba]' : 'border-[#e7dccd] bg-white text-[#5c5145]')
                          }`}
                        >
                          <div className="flex items-center justify-center gap-1">
                            <span>{day.getDate()}</span>
                            {count > 0 ? <span className={`inline-block h-1.5 w-1.5 rounded-full ${isToday ? 'bg-[#AC8E66]' : 'bg-[#8f7d63]'}`} /> : null}
                          </div>
                          {channels.length ? (
                            <div className="mt-[2px] flex justify-center gap-[2px]">
                              {channels.map((c) => (
                                <span key={`${key}-${c}`} className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: getChannelInfo(c).color }} />
                              ))}
                            </div>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className={`text-[11px] font-semibold ${isDark ? 'text-[#baaE9b]' : 'text-[#7d7366]'}`}>Eintraege am {selectedDayKey} ({selectedDayRows.length})</p>
                  {selectedDayRows.length ? selectedDayRows.map((r) => entryCard(r)) : (
                    <div className={`rounded-[14px] border p-3 text-[12px] ${isDark ? 'border-[#3b3935] bg-[#1b1b1a] text-[#a99f90]' : 'border-[#e7ddcd] bg-[#fbf8f3] text-[#7d7468]'}`}>
                      Keine Eintraege fuer diesen Tag.
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {activeTab === 'uebersicht' ? (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setOverviewFilter('future')}
                    className={`rounded-[14px] border p-3 text-left ${
                      overviewFilter === 'future'
                        ? (isDark ? 'border-[#b39160] bg-[rgba(216,200,173,0.18)]' : 'border-[#c8ad7a] bg-[#f6efe3]')
                        : (isDark ? 'border-[#3a352f] bg-[rgba(216,200,173,0.1)]' : 'border-[#eadfce] bg-[#fbf8f3]')
                    }`}
                  >
                    <p className={`text-[10px] uppercase tracking-[0.08em] ${isDark ? 'text-[#aa9e8b]' : 'text-[#8a7f73]'}`}>In Zukunft</p>
                    <p className={`mt-1 text-[22px] font-semibold ${isDark ? 'text-[#f4eadb]' : 'text-[#2a241d]'}`}>{futureCount}</p>
                  </button>
                  <button
                    onClick={() => setOverviewFilter('today')}
                    className={`rounded-[14px] border p-3 text-left ${
                      overviewFilter === 'today'
                        ? (isDark ? 'border-[#b39160] bg-[rgba(216,200,173,0.18)]' : 'border-[#c8ad7a] bg-[#f6efe3]')
                        : (isDark ? 'border-[#3a352f] bg-[rgba(216,200,173,0.1)]' : 'border-[#eadfce] bg-[#fbf8f3]')
                    }`}
                  >
                    <p className={`text-[10px] uppercase tracking-[0.08em] ${isDark ? 'text-[#aa9e8b]' : 'text-[#8a7f73]'}`}>Heute</p>
                    <p className={`mt-1 text-[22px] font-semibold ${isDark ? 'text-[#f4eadb]' : 'text-[#2a241d]'}`}>{todayCount}</p>
                  </button>
                  <button
                    onClick={() => setOverviewFilter('overdue')}
                    className={`rounded-[14px] border p-3 text-left ${
                      overviewFilter === 'overdue'
                        ? (isDark ? 'border-[#b39160] bg-[rgba(216,200,173,0.18)]' : 'border-[#c8ad7a] bg-[#f6efe3]')
                        : (isDark ? 'border-[#3a352f] bg-[rgba(216,200,173,0.1)]' : 'border-[#eadfce] bg-[#fbf8f3]')
                    }`}
                  >
                    <p className={`text-[10px] uppercase tracking-[0.08em] ${isDark ? 'text-[#aa9e8b]' : 'text-[#8a7f73]'}`}>Ueberfaellig</p>
                    <p className={`mt-1 text-[22px] font-semibold ${isDark ? 'text-[#f4eadb]' : 'text-[#2a241d]'}`}>{overdueCount}</p>
                  </button>
                  <button
                    onClick={() => setOverviewFilter('planned')}
                    className={`rounded-[14px] border p-3 text-left ${
                      overviewFilter === 'planned'
                        ? (isDark ? 'border-[#b39160] bg-[rgba(216,200,173,0.18)]' : 'border-[#c8ad7a] bg-[#f6efe3]')
                        : (isDark ? 'border-[#3a352f] bg-[rgba(216,200,173,0.1)]' : 'border-[#eadfce] bg-[#fbf8f3]')
                    }`}
                  >
                    <p className={`text-[10px] uppercase tracking-[0.08em] ${isDark ? 'text-[#aa9e8b]' : 'text-[#8a7f73]'}`}>Geplant</p>
                    <p className={`mt-1 text-[22px] font-semibold ${isDark ? 'text-[#f4eadb]' : 'text-[#2a241d]'}`}>{plannedCount}</p>
                  </button>
                </div>
                <div className="space-y-2">
                  <p className={`text-[11px] font-semibold ${isDark ? 'text-[#baaE9b]' : 'text-[#7d7366]'}`}>{overviewLabel} ({overviewRows.length})</p>
                  {overviewRows.length === 0 ? (
                    <div className={`rounded-[14px] border p-3 text-[12px] ${isDark ? 'border-[#3b3935] bg-[#1b1b1a] text-[#a99f90]' : 'border-[#e7ddcd] bg-[#fbf8f3] text-[#7d7468]'}`}>
                      Keine geplanten Eintraege gefunden.
                    </div>
                  ) : overviewRows.map((r) => entryCard(r))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>

      {actionSheetOpen && selectedRow ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center">
          <button
            aria-label="Aktionen schliessen"
            onClick={() => setActionSheetOpen(false)}
            className="absolute inset-0 bg-black/45"
          />
          <div className={`relative z-10 w-full max-w-[390px] rounded-t-[22px] border p-4 ${
            isDark ? 'border-[#4e4539] bg-[#171614]' : 'border-[#d8c7ab] bg-[#f5f1e9]'
          }`}>
            <p className={`mb-3 truncate text-[13px] font-semibold ${isDark ? 'text-[#eadfce]' : 'text-[#2f271f]'}`}>
              {normalizeDocTitle(selectedRow.title)}
            </p>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => {
                  setActionSheetOpen(false);
                  openArticleFromPlan(selectedRow);
                }}
                className={`rounded-[12px] border px-3 py-2 text-left text-[12px] font-semibold ${isDark ? 'border-[#5f5547] bg-[#26221d] text-[#eadfce]' : 'border-[#d8c7ab] bg-white text-[#2c251d]'}`}
              >
                Oeffnen
              </button>
              <button
                onClick={() => {
                  setActionSheetOpen(false);
                  openPlanSheet('edit');
                }}
                className={`rounded-[12px] border px-3 py-2 text-left text-[12px] font-semibold ${isDark ? 'border-[#5f5547] bg-[#26221d] text-[#eadfce]' : 'border-[#d8c7ab] bg-white text-[#2c251d]'}`}
              >
                Neu planen
              </button>
              <button
                onClick={() => {
                  setActionSheetOpen(false);
                  openEditSheet();
                }}
                className={`rounded-[12px] border px-3 py-2 text-left text-[12px] font-semibold ${isDark ? 'border-[#5f5547] bg-[#26221d] text-[#eadfce]' : 'border-[#d8c7ab] bg-white text-[#2c251d]'}`}
              >
                Bearbeiten
              </button>
              <button
                onClick={() => {
                  setActionSheetOpen(false);
                  setDeleteConfirmOpen(true);
                }}
                className={`rounded-[12px] border px-3 py-2 text-left text-[12px] font-semibold ${isDark ? 'border-[#7a4a43] bg-[#2c1d1b] text-[#f1d4cf]' : 'border-[#dfb3aa] bg-[#fff7f6] text-[#8d3c2f]'}`}
              >
                Loeschen
              </button>
              <button
                onClick={() => setActionSheetOpen(false)}
                className={`rounded-[12px] border px-3 py-2 text-left text-[12px] ${isDark ? 'border-[#4f473b] text-[#bcae99]' : 'border-[#d8c7ab] text-[#705d45]'}`}
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {planSheetOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <button
            aria-label="Planung schliessen"
            onClick={() => {
              setPlanSheetOpen(false);
              setPlanCreateMode(false);
            }}
            className="absolute inset-0 bg-black/45"
          />
          <div className={`relative z-10 w-full max-w-[390px] rounded-t-[22px] border p-4 ${
            isDark ? 'border-[#4e4539] bg-[#171614]' : 'border-[#d8c7ab] bg-[#f5f1e9]'
          }`}>
            <p className={`mb-3 truncate text-[13px] font-semibold ${isDark ? 'text-[#eadfce]' : 'text-[#2f271f]'}`}>
              {planCreateMode ? 'Neuen Post planen' : `Neu planen: ${normalizeDocTitle(selectedRow?.title)}`}
            </p>
            <div className="space-y-2">
              <ZenDropdownField
                label="Kanal"
                value={planChannelInput}
                onChange={setPlanChannelInput}
                placeholder="Kanal auswaehlen"
                options={['linkedin', 'x', 'blog', 'github', 'reddit', 'devto', 'medium', 'hashnode'].map((k) => ({
                  value: k,
                  label: getChannelInfo(k).label,
                }))}
              />
              {planCreateMode ? (
                <>
                  <div>
                    <label className={`mb-1 block text-[11px] ${isDark ? 'text-[#bcae99]' : 'text-[#7b6b54]'}`}>Titel</label>
                    <input
                      type="text"
                      value={planTitleInput}
                      onChange={(e) => setPlanTitleInput(e.target.value)}
                      placeholder="Dein Titel hier"
                      className={`w-full rounded-[10px] border px-3 py-2 text-[12px] outline-none ${isDark ? 'border-[#5f5547] bg-[#26221d] text-[#eadfce]' : 'border-[#d8c7ab] bg-white text-[#2c251d]'}`}
                    />
                  </div>
                  <div>
                    <label className={`mb-1 block text-[11px] ${isDark ? 'text-[#bcae99]' : 'text-[#7b6b54]'}`}>Untertitel</label>
                    <input
                      type="text"
                      value={planSubtitleInput}
                      onChange={(e) => setPlanSubtitleInput(e.target.value)}
                      placeholder="Kurzbeschreibung"
                      className={`w-full rounded-[10px] border px-3 py-2 text-[12px] outline-none ${isDark ? 'border-[#5f5547] bg-[#26221d] text-[#eadfce]' : 'border-[#d8c7ab] bg-white text-[#2c251d]'}`}
                    />
                  </div>
                </>
              ) : null}
              <div>
                <label className={`mb-1 block text-[11px] ${isDark ? 'text-[#bcae99]' : 'text-[#7b6b54]'}`}>Datum</label>
                <input
                  type="date"
                  value={planDateInput}
                  onChange={(e) => setPlanDateInput(e.target.value)}
                  className={`w-full rounded-[10px] border px-3 py-2 text-[12px] outline-none ${isDark ? 'border-[#5f5547] bg-[#26221d] text-[#eadfce]' : 'border-[#d8c7ab] bg-white text-[#2c251d]'}`}
                />
              </div>
              <div>
                <label className={`mb-1 block text-[11px] ${isDark ? 'text-[#bcae99]' : 'text-[#7b6b54]'}`}>Uhrzeit</label>
                <input
                  type="time"
                  value={planTimeInput}
                  onChange={(e) => setPlanTimeInput(e.target.value)}
                  className={`w-full rounded-[10px] border px-3 py-2 text-[12px] outline-none ${isDark ? 'border-[#5f5547] bg-[#26221d] text-[#eadfce]' : 'border-[#d8c7ab] bg-white text-[#2c251d]'}`}
                />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setPlanSheetOpen(false);
                  setPlanCreateMode(false);
                }}
                className={`rounded-[12px] border px-3 py-2 text-[12px] ${isDark ? 'border-[#4f473b] text-[#bcae99]' : 'border-[#d8c7ab] text-[#705d45]'}`}
              >
                Abbrechen
              </button>
              <button
                onClick={() => void saveReschedule()}
                className={`rounded-[12px] border px-3 py-2 text-[12px] font-semibold ${isDark ? 'border-[#5f5547] bg-[#26221d] text-[#eadfce]' : 'border-[#d8c7ab] bg-white text-[#2c251d]'}`}
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editSheetOpen && selectedRow ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <button
            aria-label="Bearbeiten schliessen"
            onClick={() => setEditSheetOpen(false)}
            className="absolute inset-0 bg-black/45"
          />
          <div className={`relative z-10 w-full max-w-[390px] rounded-t-[22px] border p-4 ${
            isDark ? 'border-[#4e4539] bg-[#171614]' : 'border-[#d8c7ab] bg-[#f5f1e9]'
          }`}>
            <p className={`mb-3 truncate text-[13px] font-semibold ${isDark ? 'text-[#eadfce]' : 'text-[#2f271f]'}`}>
              Bearbeiten: {normalizeDocTitle(selectedRow.title)}
            </p>
            <div className="space-y-2">
              <div>
                <label className={`mb-1 block text-[11px] ${isDark ? 'text-[#bcae99]' : 'text-[#7b6b54]'}`}>Name</label>
                <input
                  type="text"
                  value={editNameInput}
                  onChange={(e) => setEditNameInput(e.target.value)}
                  placeholder="Titel"
                  className={`w-full rounded-[10px] border px-3 py-2 text-[12px] outline-none ${isDark ? 'border-[#5f5547] bg-[#26221d] text-[#eadfce]' : 'border-[#d8c7ab] bg-white text-[#2c251d]'}`}
                />
              </div>
              <div>
                <label className={`mb-1 block text-[11px] ${isDark ? 'text-[#bcae99]' : 'text-[#7b6b54]'}`}>Tags</label>
                <input
                  type="text"
                  value={editTagsInput}
                  onChange={(e) => setEditTagsInput(e.target.value)}
                  placeholder="z. B. marketing, linkedin"
                  className={`w-full rounded-[10px] border px-3 py-2 text-[12px] outline-none ${isDark ? 'border-[#5f5547] bg-[#26221d] text-[#eadfce]' : 'border-[#d8c7ab] bg-white text-[#2c251d]'}`}
                />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => setEditSheetOpen(false)}
                className={`rounded-[12px] border px-3 py-2 text-[12px] ${isDark ? 'border-[#4f473b] text-[#bcae99]' : 'border-[#d8c7ab] text-[#705d45]'}`}
              >
                Abbrechen
              </button>
              <button
                onClick={() => void saveEditMeta()}
                className={`rounded-[12px] border px-3 py-2 text-[12px] font-semibold ${isDark ? 'border-[#5f5547] bg-[#26221d] text-[#eadfce]' : 'border-[#d8c7ab] bg-white text-[#2c251d]'}`}
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteConfirmOpen && selectedRow ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <button
            aria-label="Loeschen abbrechen"
            onClick={() => setDeleteConfirmOpen(false)}
            className="absolute inset-0 bg-black/55"
          />
          <div className={`relative z-10 w-full max-w-[360px] rounded-[16px] border p-4 ${
            isDark ? 'border-[#6b4a46] bg-[#1f1615]' : 'border-[#dfb3aa] bg-[#fff7f6]'
          }`}>
            <p className={`text-[14px] font-semibold ${isDark ? 'text-[#f3ddd7]' : 'text-[#7d2f24]'}`}>Eintrag wirklich loeschen?</p>
            <p className={`mt-1 truncate text-[12px] ${isDark ? 'text-[#d2b7b2]' : 'text-[#8c4a41]'}`}>{normalizeDocTitle(selectedRow.title)}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                className={`rounded-[10px] border px-3 py-2 text-[12px] ${isDark ? 'border-[#7a5751] text-[#d7c0bc]' : 'border-[#dfb3aa] text-[#8d3c2f]'}`}
              >
                Abbrechen
              </button>
              <button
                onClick={async () => {
                  setDeleteConfirmOpen(false);
                  await deleteSelectedEntry();
                }}
                className={`rounded-[10px] border px-3 py-2 text-[12px] font-semibold ${isDark ? 'border-[#9a5a53] bg-[#3b211e] text-[#ffd7d2]' : 'border-[#d98f84] bg-[#fdeceb] text-[#8d2f24]'}`}
              >
                Loeschen
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
