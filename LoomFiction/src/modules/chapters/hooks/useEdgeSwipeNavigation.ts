import { useEffect, useRef, useState } from 'react';

export type EdgePull = { direction: 'prev' | 'next'; progress: number } | null;

const THRESHOLD = 110; 

type Options = { onPrev?: () => void; onNext?: () => void; enabled?: boolean };

export function useEdgeSwipeNavigation({ onPrev, onNext, enabled = true }: Options): EdgePull {
  const [pull, setPull] = useState<EdgePull>(null);

  const handlers = useRef({ onPrev, onNext });
  useEffect(() => {
    handlers.current = { onPrev, onNext };
  });

  useEffect(() => {
    if (!enabled) return;

    const html = document.documentElement;
    const previousOverscroll = html.style.overscrollBehaviorY;
    html.style.overscrollBehaviorY = 'contain';

    const root = () => document.scrollingElement ?? html;
    const atTop = () => root().scrollTop <= 0;
    const atBottom = () => root().scrollTop + window.innerHeight >= root().scrollHeight - 2;

    let tracking = false;
    let lastY = 0;
    let anchorX = 0;
    let anchorY: number | null = null;
    let direction: 'prev' | 'next' | null = null;
    let distance = 0;

    const reset = () => {
      anchorY = null;
      direction = null;
      distance = 0;
      setPull(null);
    };

    const onStart = (event: TouchEvent) => {
      tracking = event.touches.length === 1;
      if (tracking) lastY = event.touches[0].clientY;
      reset();
    };

    const onMove = (event: TouchEvent) => {
      if (!tracking || event.touches.length !== 1) return;
      const { clientX: x, clientY: y } = event.touches[0];

      if (anchorY === null) {
        if (y < lastY && atBottom() && handlers.current.onNext) {
          direction = 'next';
          anchorY = lastY;
          anchorX = x;
        } else if (y > lastY && atTop() && handlers.current.onPrev) {
          direction = 'prev';
          anchorY = lastY;
          anchorX = x;
        }
        lastY = y;
      }
      if (anchorY === null || direction === null) return;

      distance = direction === 'next' ? anchorY - y : y - anchorY;

      if (Math.abs(x - anchorX) > Math.max(distance, 24)) {
        tracking = false;
        reset();
        return;
      }
      if (distance <= 0) {
        reset();
        return;
      }

      setPull({ direction, progress: Math.min(1, Math.round((distance / THRESHOLD) * 20) / 20) });
    };

    const onEnd = () => {
      const validated = direction !== null && distance >= THRESHOLD;
      const finished = direction;
      tracking = false;
      reset();
      if (!validated) return;
      if (finished === 'next') handlers.current.onNext?.();
      else handlers.current.onPrev?.();
    };

    const onCancel = () => {
      tracking = false;
      reset();
    };

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    window.addEventListener('touchcancel', onCancel, { passive: true });

    return () => {
      html.style.overscrollBehaviorY = previousOverscroll;
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onCancel);
    };
  }, [enabled]);

  return pull;
}