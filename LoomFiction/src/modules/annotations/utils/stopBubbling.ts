import type { SyntheticEvent } from 'react';

const stop = (event: SyntheticEvent) => event.stopPropagation();

export const stopBubbling = {
  onClick: stop,
  onKeyDown: stop,
  onPointerDown: stop,
  onTouchStart: stop,
  onTouchEnd: stop,
} as const;