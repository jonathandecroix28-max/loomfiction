import { mergeAttributes } from '@tiptap/core';
import { Mention } from '@tiptap/extension-mention';
import { ReactRenderer } from '@tiptap/react';
import tippy, { type Instance as TippyInstance } from 'tippy.js';
import { MentionList, type MentionListRef } from '../components/MentionList';
import type { SheetResponse } from '../../../types/sheet';

const isMobileViewport = () =>
  typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches;


const positionMobilePopup = (instance: TippyInstance) => {
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

export const createSheetMentionExtension = (getSheets: () => SheetResponse[]) => {
  return Mention.extend({
    renderHTML({ node, HTMLAttributes }) {
      const label = node.attrs.label ?? node.attrs.id;
      return [
        'span',
        mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
          'data-type': 'mention',
          'data-id': node.attrs.id,
          'data-label': label,
        }),
        ['span', { class: 'mention-at' }, '@'],
        label,
      ];
    },
  }).configure({
    HTMLAttributes: {
      class:
        'inline-flex items-center gap-0.5 font-semibold text-amber-300 underline decoration-amber-600/60 decoration-dotted cursor-pointer hover:bg-amber-950/60 px-1 py-0.5 rounded transition-colors mention-item',
    },
    suggestion: {
      items: ({ query }) => {
        const sheets = getSheets();
        if (!query) return sheets.slice(0, 5);
        return sheets
          .filter((sheet) => sheet.name.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 5);
      },
      render: () => {
        let component: ReactRenderer<MentionListRef> | null = null;
        let popup: TippyInstance[] | null = null;

        return {
          onStart: (props) => {
            component = new ReactRenderer(MentionList, {
              props,
              editor: props.editor,
            });

            if (!props.clientRect) return;

            popup = tippy('body', {
              getReferenceClientRect: props.clientRect as () => DOMRect,
              appendTo: () => document.body,
              content: component.element,
              showOnCreate: true,
              interactive: true,
              trigger: 'manual',
              placement: 'bottom-start',
              theme: 'mention-mobile',
              arrow: false,
              maxWidth: 'none',
              onMount(instance) {
                positionMobilePopup(instance);
              },
            });
          },
          onUpdate(props) {
            component?.updateProps(props);
            if (props.clientRect) {
              popup?.[0]?.setProps({
                getReferenceClientRect: props.clientRect as () => DOMRect,
              });
            }
            if (popup?.[0]) positionMobilePopup(popup[0]);
          },
          onKeyDown(props) {
            if (props.event.key === 'Escape') {
              popup?.[0]?.hide();
              return true;
            }
            return component?.ref?.onKeyDown(props) ?? false;
          },
          onExit() {
            popup?.[0]?.destroy();
            popup = null;
            component?.destroy();
            component = null;
          },
        };
      },
    },
  });
};
