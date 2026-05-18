import { useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCloud, faRightFromBracket, faArrowRightToBracket } from '@fortawesome/free-solid-svg-icons';
import AppHeader from './AppHeader.jsx';
import ZenDropdownField from './ZenDropdownField.jsx';
import ZenAccordion from './ZenAccordion.jsx';
import ZenAvatarSettings from './ZenAvatarSettings.jsx';
import {
  clearCloudSession,
  getCloudSession,
  loadProjectsForSession,
  loginWithEmailPassword,
  registerWithEmailPassword,
  seedProjectForSession,
  saveCloudSession,
} from '../services/cloudAuthService';
import { DEFAULT_BASE_URL } from '../services/zenStudioSettings';
import { getThemeMode, subscribeThemeMode } from '../services/themeService';

export default function ZenSettingsScreen({ onBack, avatarUrl, onAvatarChange, themeMode, onThemeChange, asSheet = false }) {
  const PENDING_SSO_KEY = 'zenpost_pending_sso_session_key';
  const [session, setSession] = useState(() => getCloudSession());
  const [email, setEmail] = useState(session.userEmail || '');
  const [password, setPassword] = useState('');
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState(session.projectId ? String(session.projectId) : '');
  const [status, setStatus] = useState('');
  const [debugInfo, setDebugInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [openSection, setOpenSection] = useState('cloud');
  const [liveThemeMode, setLiveThemeMode] = useState(() => getThemeMode());
  const ssoPollingRef = useRef(null);

  const isLoggedIn = useMemo(() => !!session.token, [session]);
  const isDark = liveThemeMode === 'dark';
  const projectOptions = useMemo(
    () => projects.map((p) => ({ value: String(p.id), label: p.name })),
    [projects]
  );

  const handleSelectProject = () => {
    const selected = projects.find((p) => String(p.id) === projectId) || null;
    saveCloudSession({
      baseUrl: session.baseUrl,
      token: session.token,
      userEmail: session.userEmail,
      projectId: projectId ? Number(projectId) : null,
      projectName: selected?.name || null,
    });
    setSession(getCloudSession());
    setStatus('Projekt gespeichert.');
  };

  const handleLogout = () => {
    clearCloudSession();
    setSession(getCloudSession());
    setPassword('');
    setProjectId('');
    setProjects([]);
    setStatus('Logout erfolgreich.');
  };

  const startSsoPolling = (sessionKey, silent = false) => {
    if (ssoPollingRef.current) {
      clearInterval(ssoPollingRef.current);
      ssoPollingRef.current = null;
    }
    let attempts = 0;
    ssoPollingRef.current = setInterval(async () => {
      attempts += 1;
      if (attempts > 150) {
        clearInterval(ssoPollingRef.current);
        ssoPollingRef.current = null;
        if (!silent) setStatus('Google Login Timeout. Bitte erneut versuchen.');
        return;
      }
      try {
        const origin = (session.baseUrl || '').replace(/\/+$/, '');
        const res = await fetch(`${origin}/oauth_poll_session.php?session_key=${encodeURIComponent(sessionKey)}`);
        const json = await res.json().catch(() => null);
        if (json?.success && json?.token) {
          clearInterval(ssoPollingRef.current);
          ssoPollingRef.current = null;
          saveCloudSession({
            baseUrl: session.baseUrl,
            token: json.token,
            userEmail: json.email || null,
            projectId: null,
            projectName: null,
          });
          const next = getCloudSession();
          setSession(next);
          if (json.email) setEmail(json.email);
          const seeded = await seedProjectForSession();
          const loaded = await loadProjectsForSession();
          setProjects(loaded);
          const first = seeded || loaded[0] || null;
          if (first) {
            setProjectId(String(first.id));
            saveCloudSession({
              baseUrl: next.baseUrl,
              token: next.token,
              userEmail: next.userEmail,
              projectId: first.id,
              projectName: first.name,
            });
            setSession(getCloudSession());
          }
          setStatus('Google Login erfolgreich.');
          localStorage.removeItem(PENDING_SSO_KEY);
          const url = new URL(window.location.href);
          url.searchParams.delete('sso_session_key');
          window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
        }
      } catch {
        // ignore polling errors
      }
    }, 2000);
  };

  const handleGoogleLogin = () => {
    try {
      const origin = DEFAULT_BASE_URL.replace(/\/+$/, '');
      if (!origin) {
        setStatus('ZenCloud URL fehlt.');
        return;
      }
      const sessionKey = createSessionKey();
      localStorage.setItem(PENDING_SSO_KEY, sessionKey);
      const returnTo = `${window.location.origin}/?screen=settings&sso_session_key=${encodeURIComponent(sessionKey)}`;
      const ssoUrl = `${origin}/oauth_google_start.php?session_key=${encodeURIComponent(sessionKey)}&target=pocket&return_to=${encodeURIComponent(returnTo)}&return_url=${encodeURIComponent(returnTo)}`;
      setStatus('Google Login gestartet …');
      setDebugInfo(`SSO URL: ${ssoUrl}`);
      window.location.href = ssoUrl;
    } catch (err) {
      setStatus('Google Login konnte nicht gestartet werden.');
      setDebugInfo(String(err));
    }
  };

  useEffect(() => {
    const url = new URL(window.location.href);
    const key = url.searchParams.get('sso_session_key');
    const pending = localStorage.getItem(PENDING_SSO_KEY);
    const activeKey = key || pending;
    if (activeKey) {
      setStatus('Warte auf Google Login Abschluss …');
      startSsoPolling(activeKey, true);
    }
    return () => {
      if (ssoPollingRef.current) clearInterval(ssoPollingRef.current);
    };
  }, []);

  useEffect(() => {
    const unsub = subscribeThemeMode((mode) => setLiveThemeMode(mode));
    return () => unsub();
  }, []);

  const handleLogin = async () => {
    setBusy(true);
    setStatus('');
    setDebugInfo('');
    const result = await loginWithEmailPassword(email.trim(), password);
    setBusy(false);
    if (!result.success) {
      setStatus(result.message || 'Login fehlgeschlagen.');
      setDebugInfo(result.debug || '');
      return;
    }
    const next = getCloudSession();
    setSession(next);
    const seeded = await seedProjectForSession();
    const loaded = await loadProjectsForSession();
    setProjects(loaded);
    const first = seeded || loaded[0] || null;
    if (first) {
      setProjectId(String(first.id));
      saveCloudSession({
        baseUrl: next.baseUrl,
        token: next.token,
        userEmail: next.userEmail,
        projectId: first.id,
        projectName: first.name,
      });
      setSession(getCloudSession());
    }
    setStatus(result.message || 'Login erfolgreich.');
  };

  const handleRegister = async () => {
    setBusy(true);
    setStatus('');
    setDebugInfo('');
    const result = await registerWithEmailPassword(email.trim(), password);
    setBusy(false);
    if (!result.success) {
      setStatus(result.message || 'Registrierung fehlgeschlagen.');
      setDebugInfo(result.debug || '');
      return;
    }
    const next = getCloudSession();
    setSession(next);
    const seeded = await seedProjectForSession();
    const loaded = await loadProjectsForSession();
    setProjects(loaded);
    const first = seeded || loaded[0] || null;
    if (first) {
      setProjectId(String(first.id));
      saveCloudSession({
        baseUrl: next.baseUrl,
        token: next.token,
        userEmail: next.userEmail,
        projectId: first.id,
        projectName: first.name,
      });
      setSession(getCloudSession());
    }
    setStatus(result.message || 'Konto erstellt und eingeloggt.');
  };

  return (
    <div className={`${asSheet ? 'w-full' : 'min-h-screen w-full'} ${isDark ? 'bg-[#121212] text-[#ece7df]' : 'bg-[#f5f1ea] text-[#171717]'}`}>
      <section className={`${asSheet ? 'w-full px-4 pb-6 pt-3' : 'mx-auto w-full max-w-[390px] px-4 pb-28 pt-4'}`}>
        <AppHeader
          unbalanced={asSheet}
          sticky
          stickyClassName={isDark ? 'bg-[#121212]/95' : 'bg-[#f5f1ea]/95'}
          title="Zen Settings"
          subtitle={isLoggedIn ? `Profil aktiv // ${session.userEmail || 'ZenCloud'}` : 'Profil & Darstellung'}
          titleAlign="left"
          titleClassName={isDark ? 'text-[#f0ebe3]' : 'text-[#191919]'}
          subtitleClassName={isDark ? 'text-[#a1988a]' : 'text-[#8a8174]'}
        />


        <div className="mt-5 grid gap-3">
          <ZenAccordion
            title="ZenCloud"
            subtitle={isLoggedIn ? 'Verbunden und bereit' : 'Login für Cloud-Sync'}
            open={openSection === 'cloud'}
            onToggle={() => setOpenSection((v) => (v === 'cloud' ? '' : 'cloud'))}
          >
            {isLoggedIn ? (
              <div>
                <p className="text-[11px] font-semibold tracking-[0.08em] text-[#b0956b]">ZENCLOUD</p>
                <p className="mt-2 text-[14px] font-semibold text-[#23211d]">
                  Eingeloggt {session.userEmail ? `als ${session.userEmail}` : ''}
                </p>
                <p className="mt-1 text-[12px] text-[#7f7768]">
                  Aktives Projekt: {session.projectName || `#${session.projectId || '-'}`}
                </p>

                <div className="mt-4 grid gap-2.5">
                  <button
                    onClick={async () => setProjects(await loadProjectsForSession())}
                    className="inline-flex w-fit items-center rounded-full border border-[#d6c6ad] bg-[#f3ecdf] px-3 py-1.5 text-[11px] font-semibold text-[#5d4a33]"
                  >
                    Projekte laden
                  </button>
                  <ZenDropdownField
                    id="znSettingsProject"
                    label="Projekt wählen"
                    value={projectId}
                    onChange={setProjectId}
                    options={projectOptions}
                    placeholder="Projekt wählen"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleSelectProject}
                      className="rounded-full border border-[#d6c6ad] bg-[#f3ecdf] px-3 py-1.5 text-[11px] font-semibold text-[#5d4a33]"
                    >
                      Speichern
                    </button>
                    <button
                      onClick={handleLogout}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#ecd6d6] bg-[#f8ecec] px-3 py-1.5 text-[11px] font-semibold text-[#8b5858]"
                    >
                      <FontAwesomeIcon icon={faRightFromBracket} /> Logout
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-[11px] font-semibold tracking-[0.08em] text-[#b0956b]">ZENCLOUD LOGIN</p>
                <p className="mt-2 text-[12px] text-[#7f7768]">Login nur für ZenCloud-Verbindung.</p>
                <div className="mt-3 grid gap-2">
                  <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-Mail" className="w-full rounded-[10px] border border-[#AC8E66] bg-white px-3 py-2 text-[12px] outline-none focus:border-[#AC8E66] focus:ring-1 focus:ring-[#AC8E66]" />
                  <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Passwort" className="w-full rounded-[10px] border border-[#AC8E66] bg-white px-3 py-2 text-[12px] outline-none focus:border-[#AC8E66] focus:ring-1 focus:ring-[#AC8E66]" />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={handleLogin} disabled={busy} className="inline-flex items-center gap-1.5 rounded-full border border-[#d6c6ad] bg-[#f3ecdf] px-3 py-1.5 text-[11px] font-semibold text-[#5d4a33] disabled:opacity-50">
                    <FontAwesomeIcon icon={faArrowRightToBracket} /> Login
                  </button>
                  <button onClick={handleRegister} disabled={busy} className="inline-flex items-center gap-1.5 rounded-full border border-[#d6c6ad] bg-[#f8f2e9] px-3 py-1.5 text-[11px] font-semibold text-[#5d4a33] disabled:opacity-50">
                    Konto erstellen
                  </button>
                  <button onClick={handleGoogleLogin} className="inline-flex items-center gap-1.5 rounded-full border border-[#e0d8cb] bg-[#faf7f1] px-3 py-1.5 text-[11px] font-semibold text-[#4f4940]">
                    <FontAwesomeIcon icon={faCloud} /> Mit Google anmelden
                  </button>
                </div>
              </div>
            )}
          </ZenAccordion>

          <ZenAccordion
            title="Profil & Darstellung"
            subtitle="Vorlage für weitere Settings-Bereiche"
            open={openSection === 'profile'}
            onToggle={() => setOpenSection((v) => (v === 'profile' ? '' : 'profile'))}
          >
            <div className="grid gap-4">
              <ZenAvatarSettings avatarUrl={avatarUrl} onAvatarChange={onAvatarChange} />
              <div>
                <p className="text-[12px] font-semibold text-[#23211d]">Theme</p>
                <div className="mt-2 inline-flex rounded-full border border-[#e3d8c5] bg-[#f5efe3] p-1">
                  <button
                    type="button"
                    onClick={async () => {
                      await onThemeChange('light');
                    }}
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                      themeMode === 'light' ? 'bg-[#fff] text-[#2c261f] shadow-sm' : 'text-[#7a6f60]'
                    }`}
                  >
                    Light
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await onThemeChange('dark');
                    }}
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                      themeMode === 'dark' ? 'bg-[#1a1a1a] text-[#f1eadf]' : 'text-[#7a6f60]'
                    }`}
                  >
                    Dark
                  </button>
                </div>
              </div>
            </div>
          </ZenAccordion>
        </div>

        {status ? <p className="mt-3 text-[11px] text-[#7a6f60]">{status}</p> : null}
        {debugInfo ? <pre className="mt-2 max-h-28 overflow-auto rounded-[8px] border border-[#eadfce] bg-[#f7f2ea] p-2 text-[10px] text-[#6f6557]">{debugInfo}</pre> : null}
      </section>
    </div>
  );
}
  const createSessionKey = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `sso_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  };
