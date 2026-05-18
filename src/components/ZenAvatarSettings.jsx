import { useEffect, useState } from 'react';
import { DEFAULT_AVATAR_URL, saveProfileToServer } from '../services/profileService';
import { getThemeMode, subscribeThemeMode } from '../services/themeService';

export default function ZenAvatarSettings({ avatarUrl, onAvatarChange }) {
  const [input, setInput] = useState(avatarUrl || DEFAULT_AVATAR_URL);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [themeMode, setThemeMode] = useState(() => getThemeMode());
  const isDark = themeMode === 'dark';

  useEffect(() => {
    const unsub = subscribeThemeMode((mode) => setThemeMode(mode));
    return () => unsub();
  }, []);

  const handleSave = async () => {
    const nextUrl = (input || '').trim() || DEFAULT_AVATAR_URL;
    setBusy(true);
    const result = await saveProfileToServer({ avatarUrl: nextUrl });
    setBusy(false);
    onAvatarChange?.(result.profile.avatarUrl);
    setStatus(result.synced ? 'Avatar gespeichert und mit Cloud synchronisiert.' : 'Avatar lokal gespeichert (Cloud später).');
  };

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-3">
        <div className="h-14 w-14 overflow-hidden rounded-full border-2 border-[#AC8E66] bg-[#f0ece5]">
          <img src={input || DEFAULT_AVATAR_URL} alt="Avatar Vorschau" className="h-full w-full object-cover" />
        </div>
        <div>
          <p className={`text-[12px] font-semibold ${isDark ? 'text-[#ece7df]' : 'text-[#23211d]'}`}>Profilbild</p>
          <p className={`text-[11px] ${isDark ? 'text-[#a1988a]' : 'text-[#7f7768]'}`}>URL eintragen, speichern, fertig.</p>
        </div>
      </div>

      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="https://…/avatar.webp"
        className={`w-full rounded-[10px] border px-3 py-2 text-[12px] ${
          isDark ? 'border-[#3d3b37] bg-[#1f1f1e] text-[#ece7df]' : 'border-[#AC8E66] bg-white text-[#23211d]'
        }`}
      />

      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleSave}
          disabled={busy}
          className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50 ${
            isDark ? 'border-[#6b604f] bg-[#2a2824] text-[#e6dccd]' : 'border-[#d6c6ad] bg-[#f3ecdf] text-[#5d4a33]'
          }`}
        >
          Speichern
        </button>
        <button
          onClick={() => setInput(DEFAULT_AVATAR_URL)}
          className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
            isDark ? 'border-[#4e473c] bg-[#1c1b19] text-[#d8d0c3]' : 'border-[#e0d8cb] bg-[#faf7f1] text-[#4f4940]'
          }`}
        >
          Standard
        </button>
      </div>

      {status ? <p className={`text-[11px] ${isDark ? 'text-[#a1988a]' : 'text-[#7a6f60]'}`}>{status}</p> : null}
    </div>
  );
}
