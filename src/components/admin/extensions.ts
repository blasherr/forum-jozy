import { Extension, Mark, Node, mergeAttributes } from '@tiptap/core';
import Image from '@tiptap/extension-image';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    alignment: {
      setAlignment: (align: string) => ReturnType;
    };
  }
}

/**
 * Marques à classes : l'éditeur ne produit jamais d'attribut `style`. Tout passe par des clés
 * validées côté serveur, ce qui permet de garder une CSP sans `unsafe-inline`, panel compris.
 */
function classMark(name: string, attr: string, prefix: string, tag = 'span') {
  return Mark.create({
    name,
    addAttributes() {
      return {
        [attr]: {
          default: null,
          parseHTML: (element: HTMLElement) => {
            const found = [...element.classList].find((c) => c.startsWith(prefix));
            return found ? found.slice(prefix.length) : null;
          },
          renderHTML: (attributes: Record<string, string | null>) =>
            attributes[attr] ? { class: `${prefix}${attributes[attr]}` } : {},
        },
      };
    },
    parseHTML() {
      return [{ tag: `${tag}[class*="${prefix}"]` }];
    },
    renderHTML({ HTMLAttributes }) {
      return [tag, HTMLAttributes, 0];
    },
  });
}

export const InkColor = classMark('inkColor', 'color', 'rt-ink-');
export const HighlightColor = classMark('highlightColor', 'color', 'rt-hl-', 'mark');
export const FontChoice = classMark('fontChoice', 'font', 'rt-font-');
export const SizeChoice = classMark('sizeChoice', 'size', 'rt-size-');

export const Alignment = Extension.create({
  name: 'alignment',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          textAlign: {
            default: null,
            parseHTML: (element: HTMLElement) => {
              const found = [...element.classList].find((c) => c.startsWith('rt-align-'));
              return found ? found.slice('rt-align-'.length) : null;
            },
            renderHTML: (attributes: Record<string, string | null>) =>
              attributes.textAlign ? { class: `rt-align-${attributes.textAlign}` } : {},
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setAlignment:
        (align: string) =>
        ({ commands }) => {
          const value = align === 'left' ? null : align;
          return ['paragraph', 'heading'].some((type) => commands.updateAttributes(type, { textAlign: value }));
        },
    };
  },
});

export const SizedImage = Image.extend({
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: '' },
      size: {
        default: 'large',
        parseHTML: (element: HTMLElement) =>
          [...element.classList].find((c) => c.startsWith('rt-img-'))?.slice('rt-img-'.length) ?? 'large',
        renderHTML: (attributes: Record<string, string>) => ({ class: `rt-img-${attributes.size}` }),
      },
    };
  },
});

const CALLOUT_LABELS: Record<string, string> = {
  note: 'Note',
  warning: 'Attention',
  danger: 'Important',
  success: 'Terminé',
};

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      variant: {
        default: 'note',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-variant') ?? 'note',
        renderHTML: (attributes: Record<string, string>) => ({
          'data-variant': attributes.variant,
          'data-label': CALLOUT_LABELS[attributes.variant ?? 'note'] ?? 'Note',
          class: `rt-callout rt-callout-${attributes.variant}`,
        }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'aside[data-variant]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['aside', mergeAttributes(HTMLAttributes), 0];
  },
});
