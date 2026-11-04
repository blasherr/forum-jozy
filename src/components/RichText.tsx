import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import { CALLOUTS } from '@/lib/richtext/palette';
import { headingIds } from '@/lib/richtext/headings';
import type { Block, Inline, Mark, RichDoc } from '@/lib/richtext/types';
import { isExternal, safeHref, safeImageSrc } from '@/lib/richtext/url';
import { CopyButton } from './site/CopyButton';

/**
 * Affichage du texte enrichi : chaque nœud devient un élément React.
 * Il n'y a aucun `dangerouslySetInnerHTML` : le texte est échappé par React, toujours.
 */

function markWrap(children: ReactNode, mark: Mark): ReactNode {
  switch (mark.type) {
    case 'bold':
      return <strong>{children}</strong>;
    case 'italic':
      return <em>{children}</em>;
    case 'underline':
      return <u>{children}</u>;
    case 'strike':
      return <s>{children}</s>;
    case 'code':
      return <code className="rt-inline-code">{children}</code>;
    case 'inkColor':
      return <span className={`rt-ink-${mark.attrs.color}`}>{children}</span>;
    case 'highlightColor':
      return <mark className={`rt-hl-${mark.attrs.color}`}>{children}</mark>;
    case 'fontChoice':
      return <span className={`rt-font-${mark.attrs.font}`}>{children}</span>;
    case 'sizeChoice':
      return <span className={`rt-size-${mark.attrs.size}`}>{children}</span>;
    case 'link': {
      const href = safeHref(mark.attrs.href);
      if (!href) return children;
      if (!isExternal(href)) return <Link href={href}>{children}</Link>;
      return (
        <a href={href} target="_blank" rel="noopener noreferrer nofollow">
          {children}
        </a>
      );
    }
  }
}

function renderInline(nodes: Inline[] | undefined): ReactNode {
  return (nodes ?? []).map((node, i) => {
    if (node.type === 'hardBreak') return <br key={i} />;
    // Le lien reste à l'extérieur pour que toute la portion stylée soit cliquable.
    const marks = [...(node.marks ?? [])].sort((a, b) => Number(a.type === 'link') - Number(b.type === 'link'));
    return <Fragment key={i}>{marks.reduce<ReactNode>(markWrap, node.text)}</Fragment>;
  });
}

function alignClass(attrs?: { textAlign?: string }) {
  return attrs?.textAlign ? `rt-align-${attrs.textAlign}` : undefined;
}

function plainText(block: { content?: { text: string }[] }) {
  return (block.content ?? []).map((n) => n.text).join('');
}

function renderBlocks(blocks: Block[]): ReactNode {
  const ids = headingIds(blocks);
  return blocks.map((block, i) => {
    switch (block.type) {
      case 'paragraph':
        return (
          <p key={i} className={alignClass(block.attrs)}>
            {renderInline(block.content)}
          </p>
        );
      case 'heading': {
        const Tag = `h${block.attrs.level}` as 'h2' | 'h3' | 'h4';
        return (
          <Tag key={i} id={ids.get(block)} className={alignClass(block.attrs)}>
            {renderInline(block.content)}
          </Tag>
        );
      }
      case 'bulletList':
        return (
          <ul key={i}>
            {block.content.map((item, j) => (
              <li key={j}>{renderBlocks(item.content)}</li>
            ))}
          </ul>
        );
      case 'orderedList':
        return (
          <ol key={i} start={block.attrs?.start}>
            {block.content.map((item, j) => (
              <li key={j}>{renderBlocks(item.content)}</li>
            ))}
          </ol>
        );
      case 'blockquote':
        return <blockquote key={i}>{renderBlocks(block.content)}</blockquote>;
      case 'horizontalRule':
        return <hr key={i} className="rt-rule" />;
      case 'codeBlock': {
        const text = plainText(block);
        return (
          <div key={i} className="rt-code">
            <pre>
              <code>{text}</code>
            </pre>
            <CopyButton text={text} />
          </div>
        );
      }
      case 'image': {
        const src = safeImageSrc(block.attrs.src);
        if (!src) return null;
        return (
          <figure key={i} className={`rt-figure rt-img-${block.attrs.size}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={block.attrs.alt} loading="lazy" decoding="async" />
          </figure>
        );
      }
      case 'callout': {
        const label = CALLOUTS.find((c) => c.key === block.attrs.variant)?.label ?? 'Note';
        return (
          <aside key={i} className={`rt-callout rt-callout-${block.attrs.variant}`}>
            <span className="rt-callout-label">{label}</span>
            {renderBlocks(block.content)}
          </aside>
        );
      }
      case 'table':
        return (
          <div key={i} className="rt-table-wrap">
            <table className="rt-table">
              <tbody>
                {block.content.map((row, r) => (
                  <tr key={r}>
                    {row.content.map((cell, c) => {
                      const Cell = cell.type === 'tableHeader' ? 'th' : 'td';
                      return (
                        <Cell key={c} colSpan={cell.attrs?.colspan} rowSpan={cell.attrs?.rowspan}>
                          {renderBlocks(cell.content)}
                        </Cell>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
    }
  });
}

export function RichText({ doc, className }: { doc: RichDoc; className?: string }) {
  return <div className={className ? `rich ${className}` : 'rich'}>{renderBlocks(doc.content)}</div>;
}
