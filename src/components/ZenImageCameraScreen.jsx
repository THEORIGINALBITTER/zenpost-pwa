import { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCloudArrowUp, faImage } from '@fortawesome/free-solid-svg-icons';
import { getCloudSession } from '../services/cloudAuthService';
import { listZenCloudImages, uploadImageFileToZenCloud } from '../services/zenCloudService';
import { getThemeMode, subscribeThemeMode } from '../services/themeService';
import AppHeader from './AppHeader.jsx';

export default function ZenImageCameraScreen({ onBack, onOpenSettings, onFooterActionChange, avatarUrl }) {
  const [session, setSession] = useState(() => getCloudSession());
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loadingImages, setLoadingImages] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [themeMode, setThemeMode] = useState(() => getThemeMode());
  const isDark = themeMode === 'dark';

  const isConfigured = useMemo(() => !!session.token && !!session.projectId && !!session.baseUrl, [session]);
  const projectLabel = useMemo(() => {
    if (session.projectName) return session.projectName;
    if (session.projectId) return `#${session.projectId}`;
    return '-';
  }, [session.projectId, session.projectName]);

  const refresh = async () => {
    setLoadingImages(true);
    const list = await listZenCloudImages();
    setImages(list);
    setLoadingImages(false);
  };

  useEffect(() => {
    if (isConfigured) {
      void refresh();
    }
  }, [isConfigured]);

  useEffect(() => {
    const unsub = subscribeThemeMode((mode) => setThemeMode(mode));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!onFooterActionChange) return undefined;
    onFooterActionChange({
      plusLabel: 'Foto aufnehmen',
      items: [
        { key: 'zi-home', tabKey: 'HomeDashboard', label: 'Home', type: 'tab' },
        { key: 'zi-refresh', label: 'Reload', type: 'action', actionKey: 'refresh' },
        { key: 'zi-plus', label: '+', type: 'plus' },
        { key: 'zi-gallery', label: 'Galerie', type: 'action', actionKey: 'gallery' },
        { key: 'zi-dashboard', tabKey: 'Dashboard', label: 'Aktionen', type: 'tab' },
      ],
      actions: {
        refresh: () => void refresh(),
        gallery: () => {
          const el = document.getElementById('zenimage-gallery');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        },
      },
      onPlus: () => {
        const input = document.getElementById('zenimage-capture-input');
        input?.click();
      },
    });
    return () => onFooterActionChange(null);
  }, [onFooterActionChange, isConfigured, loadingImages, images.length]);

  const handleCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    await uploadImageFileToZenCloud(file);
    setUploading(false);
    await refresh();
    e.target.value = '';
  };

  return (
    <div className={`min-h-screen w-full ${isDark ? 'bg-[#121212] text-[#ece7df]' : 'bg-[#f5f1ea] text-[#171717]'}`}>
      <section className="mx-auto w-full max-w-[390px] px-4 pb-10 pt-4">
        <AppHeader
          sticky
          stickyClassName={isDark ? 'bg-[#121212]/95' : 'bg-[#f5f1ea]/95'}
          title="ZenImage"
          subtitle={isConfigured ? `Cloud Sync aktiv // ${projectLabel}` : 'ZenImage benötigt ZenCloud Login + Projekt.'}
          titleAlign="left"
          titleClassName={isDark ? 'text-[#f0ebe3]' : 'text-[#191919]'}
          subtitleClassName={isDark ? 'text-[#a1988a]' : 'text-[#8a8174]'}
          right={
            <button onClick={onOpenSettings} aria-label="Profil öffnen" className="mt-0 h-10 w-10 overflow-hidden rounded-full border-[0.5px] border-[#AC8E66]">
              <img src={avatarUrl} alt="Profilbild" className="h-full w-full object-cover" />
            </button>
          }
        />

        {!isConfigured ? (
          <div className={`mt-5 rounded-[14px] border p-3 ${isDark ? 'border-[#3d3b37] bg-[#1b1b1a]' : 'border-[#ece3d4] bg-[#fbf8f3]'}`}>
            <p className={`text-[12px] ${isDark ? 'text-[#a1988a]' : 'text-[#7f7768]'}`}>Nicht eingeloggt. Bitte ZenCloud in Profil verbinden.</p>
            <button onClick={onOpenSettings} className={`mt-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${isDark ? 'border-[#6b604f] bg-[#2a2824] text-[#e6dccd]' : 'border-[#d6c6ad] bg-[#f3ecdf] text-[#5d4a33]'}`}>ZenSettings öffnen</button>
          </div>
        ) : null}

        <input id="zenimage-capture-input" type="file" accept="image/*" capture="environment" onChange={handleCapture} className="hidden" disabled={!isConfigured || uploading} />

        <div id="zenimage-gallery" className="mt-7">
          <h3 className={`inline-flex items-center gap-2 text-[12px] font-bold tracking-[-0.02em] ${isDark ? 'text-[#d8c8ad]' : 'text-[#6d665b]'}`}><FontAwesomeIcon icon={faImage} /> ZenImage Galerie</h3>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {images.length === 0 ? (
              <p className={`col-span-2 rounded-[12px] border px-3 py-2 text-[11px] ${
                isDark ? 'border-[#3d3b37] bg-[#1f1f1e] text-[#a1988a]' : 'border-[#efe9df] bg-[#fbf8f3] text-[#8f877b]'
              }`}>Keine Bilder vorhanden.</p>
            ) : (
              images.slice(0, 24).map((img) => (
                <article key={img.id} className={`overflow-hidden rounded-[12px] border ${isDark ? 'border-[#3d3b37] bg-[#1f1f1e]' : 'border-[#efe9df] bg-[#fbf8f3]'}`}>
                  <div className={`aspect-[4/3] ${isDark ? 'bg-[#232320]' : 'bg-[#efebe3]'}`}>
                    {img.url ? (
                      <button
                        type="button"
                        onClick={() => setPreviewImage(img)}
                        className="block h-full w-full"
                        aria-label={`${img.fileName} vergrößern`}
                      >
                        <img src={img.url} alt={img.fileName} className="h-full w-full object-cover" />
                      </button>
                    ) : null}
                  </div>
                  <div className="px-2.5 py-2">
                    <p className={`truncate text-[10px] font-semibold ${isDark ? 'text-[#e6dccd]' : 'text-[#3f3b35]'}`}>{img.fileName}</p>
                    <p className={`mt-0.5 text-[10px] ${isDark ? 'text-[#a1988a]' : 'text-[#8a8174]'}`}>#{img.id}</p>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>

        {!isConfigured ? (
          <p className={`mt-5 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] ${
            isDark ? 'border-[#4f4638] bg-[#2a2824] text-[#cdbda4]' : 'border-[#ecdcc8] bg-[#f8f1e7] text-[#7e6950]'
          }`}>
            <FontAwesomeIcon icon={faCloudArrowUp} />
            Bitte Token + Project ID speichern, um Upload zu aktivieren.
          </p>
        ) : null}
      </section>

      {previewImage?.url ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative w-full max-w-[920px]" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute right-2 top-2 z-10 rounded-full bg-black/65 px-3 py-1 text-[12px] font-semibold text-white"
            >
              Schließen
            </button>
            <img
              src={previewImage.url}
              alt={previewImage.fileName}
              className="max-h-[85vh] w-full rounded-[12px] object-contain"
            />
            <div className="mt-2 rounded-[10px] bg-black/65 px-3 py-2 text-[12px] text-[#f5f5f5]">
              {previewImage.fileName} #{previewImage.id}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
