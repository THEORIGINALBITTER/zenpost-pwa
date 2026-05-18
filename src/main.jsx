import React, { useEffect, useState } from 'react';
import ZenNoteQuickScreen from './components/ZenNoteQuickScreen.jsx';
import { createRoot } from 'react-dom/client';
import ArticleWriterScreen from './components/ArticleWriterScreen.jsx';
import ZenImageCameraScreen from './components/ZenImageCameraScreen.jsx';
import ZenSettingsScreen from './components/ZenSettingsScreen.jsx';
import CloudDashboardScreen from './components/CloudDashboardScreen.jsx';
import PlannerScreen from './components/PlannerScreen.jsx';
import AppFooter from './components/AppFooter.jsx';
import { resolveFooterAction } from './services/appShellConfig';
import { DEFAULT_AVATAR_URL, DEFAULT_THEME_MODE, loadLocalProfile, loadProfileFromServer } from './services/profileService';
import { applyThemeMode, getThemeMode, setThemeMode, subscribeThemeMode } from './services/themeService';

function QuickCard({ title, desc, icon, onClick, isDark }) {
  return (
    <article
      onClick={onClick}
      className={`min-h-[128px] cursor-pointer rounded-[16px] border p-3 transition active:scale-[0.99] ${
        isDark ? 'border-[#3a352f] bg-[rgba(216,200,173,0.12)]' : 'border-[#eee8de] bg-[#faf7f1]'
      }`}
    >
      <svg className={`h-[20px] w-[20px] ${isDark ? 'text-[#d8c8ad]' : 'text-[#4f4a43]'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        {icon}
      </svg>
      <h4 className={`mt-2 text-[14px] font-semibold leading-[1.04] tracking-[-0.01em] ${isDark ? 'text-[#f0ebe3]' : 'text-[#171717]'}`}>{title}</h4>
      <p className={`mt-1 text-[10px] leading-[1.28] ${isDark ? 'text-[#b2a99b]' : 'text-[#8f877b]'}`} dangerouslySetInnerHTML={{ __html: desc }} />
    </article>
  );
}

function HomeScreen({ onOpenWriter, onOpenZenNote, onOpenZenImage, onOpenSettings, onOpenDashboard, onOpenPlanner, avatarUrl, isDark }) {
  return (
    <>
      <main className="mx-auto w-full max-w-[390px] px-4 pb-28 pt-4">
        <section className="mt-4 flex items-start justify-between">
          <div>
            <h1 className={`font-logo text-[30px] font-semibold leading-[0.78] tracking-[-0.012em] ${isDark ? 'text-[#f0ebe3]' : 'text-[#1a1a1a]'}`}>ZenPost Studio</h1>
            <p className={`mt-[3px] text-[8px] font-semibold tracking-[0.22em] ${isDark ? 'text-[#d8c8ad]' : 'text-[#b1a691]'}`}>POCKET</p>
          </div>
          <button onClick={onOpenSettings} aria-label="Profil öffnen" className="mt-0 h-10 w-10 overflow-hidden rounded-full border-[0.5px] border-[#AC8E66]">
            <img src={avatarUrl || DEFAULT_AVATAR_URL} alt="Profilbild" className="h-full w-full object-cover" />
          </button>
        </section>

        <section className="mt-7">
          
          <div className="mt-3.5 grid grid-cols-2 gap-[10px]">
            <QuickCard
              title="Dashboard"
              desc="ZenCloud Doks,<br />Projektmappe"
              onClick={onOpenDashboard}
              isDark={isDark}
              icon={<><rect x="3.5" y="4.5" width="17" height="15" rx="2.2" /><path d="M8.5 9.5h7M8.5 13h7" /><path d="M6 9.5h.01M6 13h.01" /></>}
            />
            <QuickCard
              title="ZenSetting"
              desc="ZenCloud,<br />System &amp; mehr"
              onClick={onOpenSettings}
              isDark={isDark}
              icon={<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1.5 1.5 0 0 1 0 2.1 1.5 1.5 0 0 1-2.1 0l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V19a1.5 1.5 0 0 1-3 0v-.1a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a1.5 1.5 0 0 1-2.1 0 1.5 1.5 0 0 1 0-2.1l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H5a1.5 1.5 0 0 1 0-3h.1a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a1.5 1.5 0 0 1 0-2.1 1.5 1.5 0 0 1 2.1 0l.1.1a1 1 0 0 0 1.1.2h.1a1 1 0 0 0 .6-.9V5a1.5 1.5 0 0 1 3 0v.1a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a1.5 1.5 0 0 1 2.1 0 1.5 1.5 0 0 1 0 2.1l-.1.1a1 1 0 0 0-.2 1.1v.1a1 1 0 0 0 .9.6H19a1.5 1.5 0 0 1 0 3h-.1a1 1 0 0 0-.9.6z" /></>}
            />

            <QuickCard
              title="ZenPost"
              desc="Artikel schreiben,<br />Threads &amp; mehr"
              onClick={onOpenWriter}
              isDark={isDark}
              icon={<><path d="M3 21h5l11-11a2.1 2.1 0 0 0-3-3L5 18v3z" /><path d="M13 7l4 4" /></>}
            />
            <QuickCard
              title="ZenImage"
              desc="Foto aufnehmen<br />& ZenImage Sync"
              onClick={onOpenZenImage}
              isDark={isDark}
              icon={<><path d="M8 8c0-1.7 1.3-3 3-3h2a3 3 0 1 1 0 6h-2a3 3 0 1 0 0 6h2a3 3 0 1 0 0-6" /><path d="M7 12h10" /></>}
            />
            <QuickCard
              title="Planen"
              desc="Kalender, Planung,<br />Veröffentlichung"
              onClick={onOpenPlanner}
              isDark={isDark}
              icon={<><rect x="3.5" y="4.5" width="17" height="16" rx="2.5" /><path d="M7.5 2.8v3.4M16.5 2.8v3.4M3.5 9.5h17" /></>}
            />
            <QuickCard
              title="ZenNote"
              desc="Ideen, Gedanken,<br />Sammlungen"
              onClick={onOpenZenNote}
              isDark={isDark}
              icon={<><rect x="5" y="4" width="14" height="16" rx="2" /><path d="M8.5 8h7M8.5 12h7M8.5 16h4" /></>}
            />
          </div>
        </section>
      </main>
    </>
  );
}

function App() {
  const defaultTabForScreen = (nextScreen) => {
    if (nextScreen === 'zenimage') return 'Studio';
    if (nextScreen === 'planner') return 'Planen';
    if (nextScreen === 'settings') return 'Profil';
    return 'Home';
  };

  const [screen, setScreen] = useState(() => {
    const url = new URL(window.location.href);
    const urlScreen = url.searchParams.get('screen');
    const saved = sessionStorage.getItem('zenpost_screen');
    return urlScreen || saved || 'home';
  });
  const [activeTab, setActiveTab] = useState(() => {
    const url = new URL(window.location.href);
    const urlScreen = url.searchParams.get('screen');
    if (urlScreen === 'settings') return 'Profil';
    return 'Home';
  });
  const [settingsReturnScreen, setSettingsReturnScreen] = useState('home');
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [footerAction, setFooterAction] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(() => loadLocalProfile().avatarUrl);
  const [themeMode, setThemeModeState] = useState(() => getThemeMode() || DEFAULT_THEME_MODE);

  useEffect(() => {
    const root = document.documentElement;
    const vv = window.visualViewport;
    const isTextInput = (el) =>
      !!el &&
      (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
    const updateKeyboardState = () => {
      const focused = isTextInput(document.activeElement);
      const ratio = vv ? vv.height / window.innerHeight : 1;
      const open = focused && ratio < 0.82;
      root.classList.toggle('keyboard-open', open);
    };
    updateKeyboardState();
    vv?.addEventListener('resize', updateKeyboardState);
    window.addEventListener('focusin', updateKeyboardState);
    window.addEventListener('focusout', updateKeyboardState);
    return () => {
      vv?.removeEventListener('resize', updateKeyboardState);
      window.removeEventListener('focusin', updateKeyboardState);
      window.removeEventListener('focusout', updateKeyboardState);
      root.classList.remove('keyboard-open');
    };
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const ssoKey = url.searchParams.get('sso_session_key');
    if (ssoKey) {
      setSettingsReturnScreen(screen);
      setProfileSheetOpen(true);
      setActiveTab('Profil');
    }
  }, []);

  useEffect(() => {
    if (screen === 'settings') {
      setSettingsReturnScreen('home');
      setScreen('home');
      setActiveTab('Profil');
      setProfileSheetOpen(true);
    }
  }, [screen]);

  useEffect(() => {
    sessionStorage.setItem('zenpost_screen', screen);
    const url = new URL(window.location.href);
    url.searchParams.set('screen', screen);
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }, [screen]);

  useEffect(() => {
    if (screen !== 'zennote' && screen !== 'zenimage' && screen !== 'article' && screen !== 'dashboard' && screen !== 'planner') setFooterAction(null);
  }, [screen]);

  useEffect(() => {
    let mounted = true;
    loadProfileFromServer().then((result) => {
      if (!mounted) return;
      setAvatarUrl(result.profile.avatarUrl || DEFAULT_AVATAR_URL);
      const nextTheme = result.profile.themeMode || DEFAULT_THEME_MODE;
      applyThemeMode(nextTheme);
      setThemeModeState(nextTheme);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    applyThemeMode(themeMode);
    const unsub = subscribeThemeMode((mode) => setThemeModeState(mode));
    return () => unsub();
  }, [themeMode]);

  const handleTabChange = (item) => {
    if (item !== 'Profil') {
      setProfileSheetOpen(false);
    }
    setActiveTab(item);
    if (item === 'HomeDashboard') {
      setActiveTab('Home');
      setScreen('home');
      return;
    }
    if (item === 'Dashboard') {
      setActiveTab('Home');
      setScreen('dashboard');
      return;
    }
    if (item === 'Home') {
      setScreen('article');
      return;
    }
    if (item === 'Studio') {
      setScreen('zenimage');
      return;
    }
    if (item === 'Profil') {
      setSettingsReturnScreen(screen);
      setProfileSheetOpen(true);
      return;
    }
    if (item === 'Planen') {
      setScreen('planner');
      return;
    }
  };

  const resolvedFooterAction = resolveFooterAction(footerAction);

  const handlePlus = () => {
    if (resolvedFooterAction.onPlus) {
      resolvedFooterAction.onPlus();
      return;
    }
    if (screen === 'home') {
      setActiveTab('Home');
      setScreen('zennote');
      return;
    }
    setActiveTab('Home');
    setScreen('home');
  };

  const handleFooterAction = (actionKey) => {
    const actions = footerAction?.actions || {};
    const action = actions[actionKey];
    if (typeof action === 'function') action();
  };

  let content = null;
  if (screen === 'article') {
    content = (
      <ArticleWriterScreen
        onBack={() => setScreen('home')}
        onFooterActionChange={setFooterAction}
        themeMode={themeMode}
        avatarUrl={avatarUrl}
        onOpenSettings={() => {
          setSettingsReturnScreen('article');
          setActiveTab('Profil');
          setProfileSheetOpen(true);
        }}
      />
    );
  } else if (screen === 'zennote') {
    content = (
      <ZenNoteQuickScreen
        onBack={() => setScreen('home')}
        onOpenSettings={() => {
          setSettingsReturnScreen('zennote');
          setProfileSheetOpen(true);
          setActiveTab('Profil');
        }}
        avatarUrl={avatarUrl}
        onFooterActionChange={setFooterAction}
      />
    );
  } else if (screen === 'zenimage') {
    content = (
      <ZenImageCameraScreen
        onBack={() => setScreen('home')}
        onOpenSettings={() => {
          setSettingsReturnScreen('zenimage');
          setProfileSheetOpen(true);
          setActiveTab('Profil');
        }}
        avatarUrl={avatarUrl}
        onFooterActionChange={setFooterAction}
      />
    );
  } else if (screen === 'dashboard') {
    content = (
      <CloudDashboardScreen
        onOpenSettings={() => {
          setSettingsReturnScreen('dashboard');
          setProfileSheetOpen(true);
          setActiveTab('Profil');
        }}
        avatarUrl={avatarUrl}
        onOpenArticleDraft={() => {
          setActiveTab('Home');
          setScreen('article');
        }}
        onFooterActionChange={setFooterAction}
      />
    );
  } else if (screen === 'planner') {
    content = (
      <PlannerScreen
        onOpenSettings={() => {
          setSettingsReturnScreen('planner');
          setProfileSheetOpen(true);
          setActiveTab('Profil');
        }}
        avatarUrl={avatarUrl}
        onFooterActionChange={setFooterAction}
        onOpenArticleDraft={() => {
          setActiveTab('Home');
          setScreen('article');
        }}
      />
    );
  } else {
    content = (
      <HomeScreen
        onOpenWriter={() => {
          setActiveTab('Home');
          setScreen('article');
        }}
        onOpenZenNote={() => {
          setActiveTab('Home');
          setScreen('zennote');
        }}
        onOpenZenImage={() => {
          setActiveTab('Studio');
          setScreen('zenimage');
        }}
        onOpenSettings={() => {
          setSettingsReturnScreen('home');
          setActiveTab('Profil');
          setProfileSheetOpen(true);
        }}
        onOpenDashboard={() => {
          setActiveTab('Home');
          setScreen('dashboard');
        }}
        onOpenPlanner={() => {
          setActiveTab('Planen');
          setScreen('planner');
        }}
        avatarUrl={avatarUrl}
        isDark={themeMode === 'dark'}
      />
    );
  }

  return (
    <>
      {content}
      {profileSheetOpen && (
        <div className="fixed inset-0 z-40">
          <button
            aria-label="Profil schließen"
            onClick={() => {
              setProfileSheetOpen(false);
              setActiveTab(defaultTabForScreen(screen));
            }}
            className="absolute inset-0 bg-black/35"
          />
          <section className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-[390px] rounded-t-[22px] border border-[#d8c8ad] bg-[#f5f1ea] shadow-[0_-12px_28px_rgba(0,0,0,0.18)]">
            <button
              aria-label="Profil schließen"
              onClick={() => {
                setProfileSheetOpen(false);
                setActiveTab(defaultTabForScreen(screen));
              }}
              className="mx-auto mt-2 block h-7 w-[74px] rounded-full border border-[#c8ad7a] bg-[#ecd8b2] text-[11px] font-semibold tracking-[0.06em] text-[#5d4523] shadow-[0_2px_8px_rgba(0,0,0,0.1)]"
            >
              ●
            </button>
            <ZenSettingsScreen
              asSheet
              onBack={() => {
                setProfileSheetOpen(false);
                setActiveTab(defaultTabForScreen(screen));
              }}
              avatarUrl={avatarUrl}
              onAvatarChange={(next) => setAvatarUrl(next || DEFAULT_AVATAR_URL)}
              themeMode={themeMode}
              onThemeChange={setThemeMode}
            />
          </section>
        </div>
      )}
      <AppFooter
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onPlus={handlePlus}
        plusLabel={resolvedFooterAction.plusLabel}
        plusSymbol={resolvedFooterAction.plusSymbol}
        items={footerAction?.items}
        onAction={handleFooterAction}
      />
    </>
  );
}

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.filter((k) => k.startsWith('zenpost-pwa')).map((k) => caches.delete(k)));
      }
    } catch {
      // ignore cleanup issues
    }
  });
}

createRoot(document.getElementById('root')).render(<App />);
