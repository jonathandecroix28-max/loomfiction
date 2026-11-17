import { useEffect, useState, type RefObject } from 'react';
import { anchorFor, normalizeQuote, rangeToOffsets } from '../utils/anchors';

export interface TextSelection {
  start: number;
  end: number;
  exact: string;
  prefix: string;
  suffix: string;
  quote: string;
  x: number;
  y: number;
  placement: 'above' | 'below';
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function useTextSelection(rootRef: RefObject<HTMLElement | null>): TextSelection | null {
  const [selection, setSelection] = useState<TextSelection | null>(null);

  useEffect(() => {
    let timer = 0;
    let frame = 0;
    let mouseIsDown = false;

    const read = () => {
      const root = rootRef.current;
      const current = window.getSelection();

      if (!root || !current || current.rangeCount === 0 || current.isCollapsed) {
        setSelection(null);
        return;
      }

      const range = current.getRangeAt(0);
      if (!root.contains(range.commonAncestorContainer)) {
        setSelection(null);
        return;
      }

      const quote = normalizeQuote(current.toString());
      if (quote.length < 2) {
        setSelection(null);
        return;
      }

      const [start, end] = rangeToOffsets(root, range);
      if (end <= start) {
        setSelection(null);
        return;
      }

      const rect = range.getBoundingClientRect();
      const coarse = window.matchMedia('(pointer: coarse)').matches;
      const placement = coarse || rect.top < 72 ? 'below' : 'above';

      setSelection({
        start,
        end,
        quote,
        ...anchorFor(root.textContent ?? '', start, end),
        x: clamp(rect.left + rect.width / 2, 170, Math.max(170, window.innerWidth - 170)),
        y: placement === 'below' ? rect.bottom + 12 : rect.top - 10,
        placement,
      });
    };

    const onSelectionChange = () => {
      window.clearTimeout(timer);
      if (!mouseIsDown) timer = window.setTimeout(read, 140);
    };

    const onScrollOrResize = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        read();
      });
    };

    const onMouseDown = () => {
      mouseIsDown = true;
    };
    const onMouseUp = () => {
      mouseIsDown = false;
      window.clearTimeout(timer);
      timer = window.setTimeout(read, 0);
    };

    document.addEventListener('selectionchange', onSelectionChange);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    window.addEventListener('scroll', onScrollOrResize, { passive: true, capture: true });
    window.addEventListener('resize', onScrollOrResize);

    return () => {
      window.clearTimeout(timer);
      window.cancelAnimationFrame(frame);
      document.removeEventListener('selectionchange', onSelectionChange);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [rootRef]);

  return selection;
}