import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faHouse,
  faCamera,
  faCalendarDays,
  faUser,
  faListUl,
  faFloppyDisk,
  faEye,
  faSliders,
  faArrowsRotate,
  faImages,
  faPlus,
} from '@fortawesome/free-solid-svg-icons';

function resolveIcon(item) {
  if (item.icon) return item.icon;
  const key = (item.tabKey || item.key || '').toLowerCase();
  const label = (item.label || '').toLowerCase();
  if (key.includes('home') || label.includes('home') || label.includes('schreiben')) return faHouse;
  if (key.includes('studio') || label.includes('kamera')) return faCamera;
  if (key.includes('plan')) return faCalendarDays;
  if (key.includes('profil') || label.includes('profil')) return faUser;
  if (key.includes('dashboard') || label.includes('dashboard')) return faListUl;
  if (label.includes('liste')) return faListUl;
  if (label.includes('speicher') || key.includes('save')) return faFloppyDisk;
  if (label.includes('preview')) return faEye;
  if (label.includes('meta')) return faSliders;
  if (label.includes('aktualis') || label.includes('reload')) return faArrowsRotate;
  if (label.includes('galerie')) return faImages;
  return faHouse;
}

export default function AppFooter({
  activeTab,
  onTabChange,
  onPlus,
  plusLabel = 'Neu erstellen',
  plusSymbol = '+',
  items,
  onAction,
}) {
  const navItems = items || [
    { key: 'Home', label: 'Home', type: 'tab' },
    { key: 'Studio', label: 'Image', type: 'tab' },
    { key: '+', label: '+', type: 'plus' },
    { key: 'Planen', label: 'Planen', type: 'tab' },
    { key: 'Dashboard', tabKey: 'Dashboard', label: 'Aktionen', type: 'tab' },
  ];

  return (
    <>
      <nav data-app-footer="true" className="fixed bottom-2 left-2 right-2 z-30 mx-auto grid h-[82px] w-full max-w-[390px] grid-cols-5 items-center rounded-[20px] border border-[#d8c8ad] bg-[#f7f4ee]/96 px-2 pt-1 backdrop-blur transition-all duration-150 shadow-[0_8px_24px_rgba(35,28,18,0.08)]" aria-label="Hauptnavigation">
        {navItems.map((item) => {
          if (item.type === 'plus') {
            return (
              <button
                key={item.key}
                onClick={() => {
                  onPlus?.();
                }}
                className="mx-auto mt-[1px] grid h-[50px] w-[50px] place-items-center rounded-full border border-[#d6c6ad] bg-[#111111] text-[#f3ecdf] shadow-[0_4px_14px_rgba(0,0,0,0.18)]"
                aria-label={plusLabel}
                title={plusLabel}
              >
                {plusSymbol === '+' ? <FontAwesomeIcon icon={faPlus} className="text-[18px]" /> : <span className="text-[15px] font-semibold">{plusSymbol}</span>}
              </button>
            );
          }
          const tabIdentity = item.tabKey || item.key;
          const isActive = item.type === 'tab' ? activeTab === tabIdentity : false;
          const icon = resolveIcon(item);
          return (
            <button
              key={item.key}
              onClick={() => {
                if (item.type === 'tab') onTabChange(item.tabKey || item.key);
                if (item.type === 'action') onAction?.(item.actionKey);
              }}
              className={`mx-auto grid h-[64px] w-[56px] justify-items-center rounded-[12px] py-[4px] transition-all ${
                isActive
                  ? 'text-[#AC8E66]'
                  : 'text-[#8f877d] hover:text-[#7e7569]'
              }`}
              aria-current={isActive ? 'page' : undefined}
              aria-label={item.label}
              title={item.label}
            >
              <FontAwesomeIcon icon={icon} className="text-[15px]" />
              <span className={`mt-[2px] text-[10px] leading-none ${isActive ? 'text-[#AC8E66]' : 'text-[#9b9388]'}`}>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
