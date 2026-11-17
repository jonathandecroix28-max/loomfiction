import { useEffect } from 'react';

export function useLockDocumentScroll() {
  useEffect(() => {
    const { documentElement, body } = document;
    const previous = {
      html: documentElement.style.overflow,
      body: body.style.overflow,
    };

    documentElement.style.overflow = 'hidden';
    body.style.overflow = 'hidden';

    return () => {
      documentElement.style.overflow = previous.html;
      body.style.overflow = previous.body;
    };
  }, []);
}