import { delegate, type Instance, type Props } from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import { ReactRenderer, type Editor } from '@tiptap/react';
import { SheetPopover } from '../components/SheetPopover';

type CustomTippyInstance = Instance<Props> & {
  _reactRenderer?: ReactRenderer;
};

const isMobileViewport = () =>
  typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches;

const positionMobilePopover = (instance: Instance<Props>) => {
  if (!isMobileViewport()) return;

  Object.assign(instance.popper.style, {
    position: 'fixed',
    top: 'auto',
    right: '12px',
    bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
    left: '12px',
    width: 'auto',
    maxWidth: 'none',
    transform: 'none',
    zIndex: '9999',
  });
};

export function setupMentionPopovers(
  container: HTMLElement,
  onNavigate: (path: string) => void,
  editor?: Editor | null
) {
  const mobile = isMobileViewport();

  return delegate(container, {
    target: '[data-type="mention"]',
    interactive: true,
    appendTo: () => document.body,
    placement: mobile ? 'bottom' : 'top-start',
    trigger: mobile ? 'click' : 'mouseenter focus',
    hideOnClick: mobile,
    delay: mobile ? 0 : [180, 120],
    theme: 'transparent mention-mobile',
    onShow(instance) {
      if (instance.reference.closest('.hide-worldbuilding-links')) return false;
    },
    onMount(instance) {
      positionMobilePopover(instance);
    },
    onCreate(instance) {
      const idAttr = instance.reference.getAttribute('data-id');
      if (!idAttr) return;

      const component = new ReactRenderer(SheetPopover, {
        editor: editor as Editor,
        props: {
          sheetId: Number(idAttr),
          onNavigate: (path: string) => {
            instance.hide();
            onNavigate(path);
          },
        },
      });

      instance.setContent(component.element);
      (instance as unknown as CustomTippyInstance)._reactRenderer = component;
      positionMobilePopover(instance);
    },
    onDestroy(instance) {
      const customInstance = instance as unknown as CustomTippyInstance;
      customInstance._reactRenderer?.destroy();
    },
  });
}
