export default function AppHeader({
  left,
  center,
  right,
  unbalanced = false,
  sticky = false,
  stickyClassName = '',
  className = '',
  centerClassName = '',
  rightClassName = '',
  title,
  subtitle,
  titleAlign = 'left',
  titleClassName = '',
  subtitleClassName = '',
}) {
  const stickyClass = sticky ? `sticky top-0 z-20 backdrop-blur ${stickyClassName || 'bg-[#f5f1ea]/95'}` : '';
  const alignClass =
    titleAlign === 'left' ? 'text-left items-start' : titleAlign === 'center' ? 'text-center items-center' : 'text-right items-end';

  const hasLegacyContent = Boolean(center);
  const hasLeftContent = Boolean(left);
  const contentBlock = title ? (
    <div className={`flex w-full flex-col ${alignClass}`}>
      <div className={`text-[17px] font-bold tracking-[-0.02em] ${titleClassName}`}>{title}</div>
      {subtitle ? (
        <p className={`mt-0.5 w-full whitespace-nowrap overflow-hidden text-ellipsis text-[10px] ${subtitleClassName}`}>
          {subtitle}
        </p>
      ) : null}
    </div>
  ) : null;

  return (
    <header className={`-mx-4 mb-4 flex h-16 items-start justify-between px-4 pt-2 ${stickyClass} ${className}`}>
      <div className={unbalanced || !hasLeftContent ? 'min-w-0' : 'min-w-[76px]'}>{left || null}</div>
      <div className={`flex-1 ${centerClassName}`}>{hasLegacyContent ? center || null : contentBlock}</div>
      <div className={`${unbalanced ? 'min-w-0 w-0 overflow-hidden' : 'min-w-[76px]'} ${rightClassName}`}>
        {right || null}
      </div>
    </header>
  );
}
