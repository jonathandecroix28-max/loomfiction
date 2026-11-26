import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'loomfiction-sheet-images';
const CHANGE_EVENT = 'loomfiction-sheet-images-changed';
const AVATAR_SIZE = 160;

function readImages(): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}


export function useSheetImages() {
  const [images, setImages] = useState<Record<string, string>>(readImages);

  useEffect(() => {
    const refresh = () => setImages(readImages());
    window.addEventListener(CHANGE_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(CHANGE_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const setImage = useCallback((sheetId: number, dataUrl: string | null) => {
    try {
      const next = readImages();
      if (dataUrl) next[String(sheetId)] = dataUrl;
      else delete next[String(sheetId)];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
      return true;
    } catch (err) {
      console.error('Impossible d’enregistrer l’image de la fiche :', err);
      return false;
    }
  }, []);

  return { images, setImage };
}

export async function fileToAvatar(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Le fichier choisi n’est pas une image.');

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Image illisible.'));
      element.src = url;
    });

    const side = Math.min(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Impossible de traiter l’image.');
    context.drawImage(
      image,
      (image.naturalWidth - side) / 2,
      (image.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      AVATAR_SIZE,
      AVATAR_SIZE,
    );
    const webp = canvas.toDataURL('image/webp', 0.85);
    return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}