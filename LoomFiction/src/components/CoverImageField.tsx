import { useRef, useState } from 'react';
import { COVER_IMAGE, compressImage, isDataImageUrl } from '../utils/imageProcessing';

interface CoverImageFieldProps {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
}

export function CoverImageField({ value, onChange, error }: CoverImageFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [showUrl, setShowUrl] = useState(false);
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null);

  const hasImage = value.trim() !== '';
  const isLocal = isDataImageUrl(value);
  const urlVisible = !isLocal && (showUrl || hasImage);
  const message = error || fileError;

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setBusy(true);
    setFileError(null);
    try {
      onChange(await compressImage(file, COVER_IMAGE));
      setShowUrl(false);
    } catch (e) {
      setFileError(e instanceof Error ? e.message : 'Impossible de charger cette image.');
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    setFileError(null);
    setShowUrl(false);
    onChange('');
  };

  const ghost =
    'px-3.5 py-2 rounded-xl text-xs font-medium border border-amber-900/30 bg-neutral-900 hover:bg-neutral-800 text-amber-200 transition cursor-pointer disabled:opacity-50';

  return (
    <div>
      <label className="block text-xs font-serif uppercase tracking-wider text-amber-200/60 mb-1">
        Image de couverture
      </label>

      <div className="flex gap-4 items-start">
        <div className="w-24 h-32 shrink-0 rounded-xl overflow-hidden border border-amber-900/30 bg-neutral-900 flex items-center justify-center">
          {hasImage && brokenSrc !== value ? (
            <img
              src={value}
              alt="Aperçu de la couverture"
              className="w-full h-full object-cover"
              onError={() => setBrokenSrc(value)}
            />
          ) : (
            <span className="px-2 text-center text-[11px] font-serif italic text-amber-200/40">
              {hasImage ? 'Image introuvable' : 'Aucune image'}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className={ghost}>
              {busy ? 'Traitement…' : hasImage ? 'Changer l’image' : 'Choisir une image'}
            </button>
            {hasImage && (
              <button type="button" onClick={remove} className={ghost}>
                Retirer
              </button>
            )}
            {!isLocal && !urlVisible && (
              <button type="button" onClick={() => setShowUrl(true)} className={ghost}>
                Utiliser une adresse web
              </button>
            )}
          </div>

          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

          {urlVisible && (
            <input
              type="url"
              value={value}
              onChange={(e) => {
                setFileError(null);
                onChange(e.target.value);
              }}
              placeholder="https://..."
              className={`w-full bg-neutral-900 border rounded-xl px-4 py-2.5 text-amber-100 placeholder:text-amber-200/30 focus:outline-none font-sans text-sm ${
                message ? 'border-red-500 ring-1 ring-red-500' : 'border-amber-900/40 focus:ring-1 focus:ring-amber-500'
              }`}
            />
          )}

          <p className="text-[11px] text-amber-200/40 font-sans">
            {isLocal
              ? 'Image enregistrée sur cet appareil, réduite automatiquement.'
              : 'JPEG, PNG, WebP ou GIF. L’image est réduite et enregistrée sur cet appareil.'}
          </p>
        </div>
      </div>

      {message && <p className="text-red-400 text-xs mt-1.5 font-sans">{message}</p>}
    </div>
  );
}