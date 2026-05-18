import { useEffect, useMemo, useRef, useState } from 'react';
import { getThemeMode, subscribeThemeMode } from '../services/themeService';

export default function ZenDropdownField({
  id,
  label,
  value,
  onChange,
  options = [],
  placeholder = 'Auswählen',
  disabled = false,
}) {
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [themeMode, setThemeMode] = useState(() => getThemeMode());
  const isDark = themeMode === 'dark';

  const normalized = useMemo(
    () => options.map((opt) => (typeof opt === 'string' ? { value: opt, label: opt } : opt)),
    [options]
  );

  const selected = useMemo(
    () => normalized.find((opt) => opt.value === value) || null,
    [normalized, value]
  );

  useEffect(() => {
    const idx = normalized.findIndex((opt) => opt.value === value);
    setActiveIndex(idx >= 0 ? idx : 0);
  }, [normalized, value]);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => Math.min(normalized.length - 1, prev + 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(0, prev - 1));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const next = normalized[activeIndex];
        if (next) {
          onChange(next.value);
          setOpen(false);
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, normalized, activeIndex, onChange]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector(`[data-idx="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  useEffect(() => {
    const unsub = subscribeThemeMode((mode) => setThemeMode(mode));
    return () => unsub();
  }, []);

  return (
    <div ref={rootRef}>
      <label htmlFor={id} className="block text-[11px] font-semibold text-[#a09a8f]">{label}</label>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={`mt-1.5 flex h-[42px] w-full items-center justify-between rounded-[12px] border px-3 text-[12px] font-medium outline-none disabled:opacity-50 ${
          isDark
            ? 'border-[#3d3b37] bg-[#20201f] text-[#ece7df] focus:border-[#5c5448]'
            : 'border-[#efe9df] bg-[#fbf8f3] text-[#222] focus:border-[#ddd4c7]'
        }`}
      >
        <span className="truncate text-left">{selected?.label || placeholder}</span>
        <span className={`ml-2 text-[11px] ${isDark ? 'text-[#a8a093]' : 'text-[#8f877b]'}`}>▾</span>
      </button>

      {open ? (
        <div className="relative">
          <div className={`absolute z-30 mt-1.5 w-full overflow-hidden rounded-[12px] border shadow-[0_10px_26px_rgba(0,0,0,0.25)] ${
            isDark ? 'border-[#4b4337] bg-[#141414]' : 'border-[#dac8aa] bg-[#191919]'
          }`}>
            <div ref={listRef} className="max-h-[220px] overflow-y-auto py-1">
              <button
                type="button"
                data-idx={-1}
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
                className="block w-full border-l-[6px] border-l-transparent px-3 py-1.5 text-left text-[11px] text-[#d0cbb8] hover:bg-[#d0cbb8] hover:text-[#1a1a1a]"
              >
                {placeholder}
              </button>
              {normalized.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    data-idx={idx}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className={`block w-full border-l-[6px] px-3 py-1.5 text-left text-[11px] ${
                      isSelected ? 'border-l-[#ac8e66]' : 'border-l-transparent'
                    } ${
                      isActive ? 'bg-[#d0cbb8] text-[#1a1a1a]' : 'text-[#d0cbb8]'
                    }`}
                  >
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
