import { delegate, type Instance } from 'tippy.js';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Editor } from '@tiptap/core';
import { SheetPopover } from '../components/SheetPopover';

const MENTION_SELECTOR = '[data-type="mention"]';

const TOUCH_QUERY = '(hover: none), (pointer: coarse)';

const toArray = (value: Instance | Instance[]): Instance[] => (Array.isArray(value) ? value : [value]);


export function setupMentionPopovers(
  root: HTMLElement,
  navigate: (path: string) => void,
  editor?: Editor | null
) {
  const media = window.matchMedia(TOUCH_QUERY);
  const open = new Map<Instance, Root>();
  let delegated: Instance[] = [];

  const unmountLater = (reactRoot: Root) => setTimeout(() => reactRoot.unmount(), 0);

  const build = () => {
    const touch = media.matches;

    delegated = toArray(
      delegate(root, {
        target: MENTION_SELECTOR,
        // Souris : survol ou focus clavier. Mobile : un toucher ouvre, un toucher ailleurs ferme.
        trigger: touch ? 'click' : 'mouseenter focus',
        placement: touch ? 'bottom' : 'top',
        delay: touch ? 0 : [150, 100],
        interactive: true,
        hideOnClick: true,
        arrow: false,
        offset: [0, 8],
        maxWidth: 'none',
        ignoreAttributes: true,
        appendTo: () => document.body,
        popperOptions: {
          modifiers: [
            { name: 'preventOverflow', options: { padding: 8 } },
            { name: 'flip', options: { padding: 8 } },
          ],
        },

        onShow(instance) {
          const sheetId = Number(instance.reference.getAttribute('data-id'));
          if (!Number.isFinite(sheetId)) return false;

          const previous = open.get(instance);
          if (previous) unmountLater(previous);

          const container = document.createElement('div');
          container.style.width = 'min(18rem, calc(100vw - 1rem))';

          const reactRoot = createRoot(container);
          reactRoot.render(
            createElement(SheetPopover, {
              sheetId,
              onNavigate: (path: string) => {
                instance.hide();
                navigate(path);
              },
              onClose: () => instance.hide(),
            })
          );

          open.set(instance, reactRoot);
          instance.setContent(container);
        },

        onMount(instance) {
          const box = instance.popper.querySelector<HTMLElement>('.tippy-box');
          if (box) {
            box.style.background = 'transparent';
            box.style.boxShadow = 'none';
          }
          const content = instance.popper.querySelector<HTMLElement>('.tippy-content');
          if (content) content.style.padding = '0';
        },

        onHidden(instance) {
          const reactRoot = open.get(instance);
          if (!reactRoot) return;
          open.delete(instance);
          unmountLater(reactRoot);
        },
      })
    );
  };

  const teardown = () => {
    delegated.forEach((instance) => instance.destroy());
    delegated = [];
    open.forEach((reactRoot) => unmountLater(reactRoot));
    open.clear();
  };

  const onMediaChange = () => {
    teardown();
    build();
  };


  const hideOpen = () => open.forEach((_, instance) => instance.hide());

  build();
  media.addEventListener('change', onMediaChange);
  editor?.on('update', hideOpen);

  return {
    destroy() {
      media.removeEventListener('change', onMediaChange);
      editor?.off('update', hideOpen);
      teardown();
    },
  };
}