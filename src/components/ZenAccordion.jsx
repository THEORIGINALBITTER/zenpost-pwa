import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { getThemeMode, subscribeThemeMode } from '../services/themeService';
import { useEffect, useState } from 'react';

export default function ZenAccordion({
  title,
  subtitle = '',
  open = false,
  onToggle,
  children,
}) {
  const [themeMode, setThemeMode] = useState(() => getThemeMode());
  const isDark = themeMode === 'dark';

  useEffect(() => {
    const unsub = subscribeThemeMode((mode) => setThemeMode(mode));
    return () => unsub();
  }, []);

  return (
    <section className={`rounded-[14px] border ${isDark ? 'border-[#3d3b37] bg-[#1b1b1a]' : 'border-[#e6dbc8] bg-[#fbf8f3]'}`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <h3 className={`text-[14px] font-semibold ${isDark ? 'text-[#ece7df]' : 'text-[#201f1c]'}`}>{title}</h3>
          {subtitle ? <p className={`mt-0.5 text-[11px] ${isDark ? 'text-[#a1988a]' : 'text-[#8b8377]'}`}>{subtitle}</p> : null}
        </div>
        <FontAwesomeIcon
          icon={faChevronDown}
          className={`text-[12px] transition-transform ${isDark ? 'text-[#a1988a]' : 'text-[#8b8377]'} ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? <div className={`border-t px-4 py-4 ${isDark ? 'border-[#343331]' : 'border-[#AC8E66]'}`}>{children}</div> : null}
    </section>
  );
}
