import type { Alignment, CalloutKey, FontKey, HighlightKey, ImageSize, InkKey, SizeKey } from './palette';

export type Mark =
  | { type: 'bold' | 'italic' | 'underline' | 'strike' | 'code' }
  | { type: 'link'; attrs: { href: string } }
  | { type: 'inkColor'; attrs: { color: InkKey } }
  | { type: 'highlightColor'; attrs: { color: HighlightKey } }
  | { type: 'fontChoice'; attrs: { font: FontKey } }
  | { type: 'sizeChoice'; attrs: { size: SizeKey } };

export interface TextNode {
  type: 'text';
  text: string;
  marks?: Mark[];
}

export interface HardBreak {
  type: 'hardBreak';
}

export type Inline = TextNode | HardBreak;

export interface Paragraph {
  type: 'paragraph';
  attrs?: { textAlign?: Alignment };
  content?: Inline[];
}

export interface Heading {
  type: 'heading';
  attrs: { level: 2 | 3 | 4; textAlign?: Alignment };
  content?: Inline[];
}

export interface CodeBlock {
  type: 'codeBlock';
  content?: TextNode[];
}

export interface Rule {
  type: 'horizontalRule';
}

export interface ImageNode {
  type: 'image';
  attrs: { src: string; alt: string; size: ImageSize };
}

export interface ListItem {
  type: 'listItem';
  content: Block[];
}

export interface BulletList {
  type: 'bulletList';
  content: ListItem[];
}

export interface OrderedList {
  type: 'orderedList';
  attrs?: { start?: number };
  content: ListItem[];
}

export interface Blockquote {
  type: 'blockquote';
  content: Block[];
}

export interface Callout {
  type: 'callout';
  attrs: { variant: CalloutKey };
  content: Block[];
}

export interface TableCell {
  type: 'tableCell' | 'tableHeader';
  attrs?: { colspan?: number; rowspan?: number };
  content: Block[];
}

export interface TableRow {
  type: 'tableRow';
  content: TableCell[];
}

export interface Table {
  type: 'table';
  content: TableRow[];
}

export type Block =
  | Paragraph
  | Heading
  | CodeBlock
  | Rule
  | ImageNode
  | BulletList
  | OrderedList
  | Blockquote
  | Callout
  | Table;

export interface RichDoc {
  type: 'doc';
  content: Block[];
}

export const EMPTY_DOC: RichDoc = { type: 'doc', content: [{ type: 'paragraph' }] };
