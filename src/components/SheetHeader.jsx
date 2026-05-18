export default function SheetHeader({ title, onClose, closeLabel, isDark = false }) {
  return (
    <>
      <button
        type="button"
        onClick={onClose}
        className="mx-auto flex h-8 w-[88px] items-center justify-center rounded-full border border-[#ccb181] bg-[#e9d8bb] text-[#6f552e]"
        aria-label={closeLabel || `${title} schließen`}
      >
        <span className="text-[20px] leading-none">•</span>
      </button>
      <div className="mt-3 flex items-center justify-between">
        <h3 className={`text-[14px] font-bold ${isDark ? 'text-[#f0ebe3]' : 'text-[#1f1d1a]'}`}>{title}</h3>
      </div>
    </>
  );
}
