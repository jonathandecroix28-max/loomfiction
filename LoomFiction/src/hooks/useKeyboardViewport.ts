import { useEffect, useState, type RefObject } from 'react';

const KEYBOARD_MIN_PX = 120;


export function useKeyboardViewport(ref: RefObject<HTMLElement | null>, enabled = true): boolean {
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    const element = ref.current;
    if (!enabled || !viewport || !element) return;

    const reset = () => {
      for (const property of ['position', 'top', 'left', 'right', 'height', 'transform', 'z-index']) {
        element.style.removeProperty(property);
      }
    };

    const update = () => {
      const keyboardHeight = window.innerHeight - viewport.height - viewport.offsetTop;
      const open = keyboardHeight > KEYBOARD_MIN_PX && viewport.scale <= 1.01;

      if (open) {
        element.style.setProperty('position', 'fixed');
        element.style.setProperty('top', '0');
        element.style.setProperty('left', '0');
        element.style.setProperty('right', '0');
        element.style.setProperty('height', `${viewport.height}px`);
        element.style.setProperty('transform', `translateY(${viewport.offsetTop}px)`);
        element.style.setProperty('z-index', '50');
      } else {
        reset();
      }
      setKeyboardOpen(open);
    };

    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);

    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      reset();
      setKeyboardOpen(false);
    };
  }, [ref, enabled]);

  return keyboardOpen;
}