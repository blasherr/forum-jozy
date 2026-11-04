import { describe, expect, it } from 'vitest';
import { extractHeadings } from '@/lib/richtext/headings';
import { safeHref, safeImageSrc } from '@/lib/richtext/url';
import { RichTextError, sanitizeDoc } from '@/lib/richtext/validate';

const para = (content: unknown[]) => ({ type: 'doc', content: [{ type: 'paragraph', content }] });

describe('safeHref : charges connues', () => {
  const refused = [
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    ' javascript:alert(1)',
    'java\tscript:alert(1)',
    'java\nscript:alert(1)',
    '\u0001javascript:alert(1)',
    'vbscript:msgbox(1)',
    'data:text/html;base64,PHNjcmlwdD4=',
    'data:image/svg+xml,<svg onload=alert(1)>',
    'file:///etc/passwd',
    'blob:https://x/y',
    '//evil.com',
    '/\\evil.com',
    '\\\\evil.com',
    'https://user:pass@evil.com',
    'https://evil.com\\@good.com',
    'feed:javascript:alert(1)',
    'view-source:https://x',
    'redm://connect/evil:30120',
    'ts3server://evil?nickname=x&addbookmark=1',
    `https://x/${'a'.repeat(3000)}`,
  ];
  it.each(refused)('refuse %j', (value) => {
    expect(safeHref(value)).toBeNull();
  });

  const accepted = [
    'https://top-serveurs.net/rdr/vote/new-frontier-rp',
    'https://discord.gg/RDvuC277pz',
    'mailto:contact@example.com',
    '/reglement',
    '/guide/connexion#adresse',
    '#section',
  ];
  it.each(accepted)('accepte %s', (value) => {
    expect(safeHref(value)).toBe(value);
  });

  it('non-chaîne refusée', () => {
    expect(safeHref({ toString: () => 'https://x' })).toBeNull();
    expect(safeHref(['https://x'])).toBeNull();
  });
});

describe('safeImageSrc', () => {
  it('uniquement la médiathèque interne', () => {
    expect(safeImageSrc('/media/00000000-0000-4000-8000-000000000001')).not.toBeNull();
    for (const bad of [
      'https://evil.com/x.png',
      '/media/../secret',
      '/media/00000000-0000-4000-8000-000000000001/../../x',
      'data:image/png;base64,AAAA',
      '/media/<script>',
      '//evil.com/x.png',
    ]) {
      expect(safeImageSrc(bad)).toBeNull();
    }
  });
});

describe('sanitizeDoc', () => {
  it('garde un document normal', () => {
    const doc = para([{ type: 'text', text: 'Bonjour', marks: [{ type: 'bold' }] }]);
    expect(sanitizeDoc(doc)).toEqual(doc);
  });

  it('un texte contenant du HTML reste du texte', () => {
    const out = sanitizeDoc(para([{ type: 'text', text: '<img src=x onerror=alert(1)>' }]));
    expect(JSON.stringify(out)).toContain('<img src=x onerror=alert(1)>');
    const node = out.content[0] as { content: { text: string; marks?: unknown }[] };
    expect(node.content[0]?.marks).toBeUndefined();
  });

  it.each(['script', 'iframe', 'svg', 'html', 'style', 'object', 'embed', 'custom'])('refuse le bloc %s', (type) => {
    expect(() => sanitizeDoc({ type: 'doc', content: [{ type }] })).toThrow(RichTextError);
  });

  it('refuse une marque inconnue', () => {
    expect(() => sanitizeDoc(para([{ type: 'text', text: 'x', marks: [{ type: 'onclick' }] }]))).toThrow(RichTextError);
  });

  it('retire un lien dangereux sans perdre le texte', () => {
    const out = sanitizeDoc(
      para([{ type: 'text', text: 'clic', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }]),
    );
    expect(JSON.stringify(out)).not.toContain('javascript');
    expect(JSON.stringify(out)).toContain('clic');
  });

  it('ignore tous les attributs non prévus', () => {
    const out = sanitizeDoc({
      type: 'doc',
      onload: 'alert(1)',
      content: [
        {
          type: 'paragraph',
          attrs: { style: 'background:url(javascript:alert(1))', class: 'x', onclick: 'y', textAlign: 'center' },
          content: [{ type: 'text', text: 'x', evil: true }],
        },
      ],
    });
    const json = JSON.stringify(out);
    for (const word of ['style', 'onclick', 'onload', 'evil', 'javascript']) expect(json).not.toContain(word);
    expect(json).toContain('center');
  });

  it('refuse les valeurs hors liste pour couleurs, polices et tailles', () => {
    const out = sanitizeDoc(
      para([
        {
          type: 'text',
          text: 'x',
          marks: [
            { type: 'inkColor', attrs: { color: 'red;background:url(x)' } },
            { type: 'fontChoice', attrs: { font: 'Arial}body{display:none' } },
            { type: 'sizeChoice', attrs: { size: '999px' } },
            { type: 'highlightColor', attrs: { color: 'expression(alert(1))' } },
          ],
        },
      ]),
    );
    expect(JSON.stringify(out)).not.toContain('marks');
  });

  it('retire une image externe', () => {
    const out = sanitizeDoc({
      type: 'doc',
      content: [{ type: 'image', attrs: { src: 'https://evil.com/track.gif', alt: 'x' } }],
    });
    expect(JSON.stringify(out)).not.toContain('evil');
  });

  it('résiste à la pollution de prototype', () => {
    const payload = JSON.parse('{"type":"doc","__proto__":{"polluted":true},"content":[{"type":"paragraph","constructor":{"prototype":{"polluted":true}}}]}');
    const out = sanitizeDoc(payload);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(JSON.stringify(out)).not.toContain('polluted');
  });

  it('refuse les documents trop imbriqués (déni de service)', () => {
    let node: Record<string, unknown> = { type: 'paragraph' };
    for (let i = 0; i < 40; i += 1) node = { type: 'blockquote', content: [node] };
    expect(() => sanitizeDoc({ type: 'doc', content: [node] })).toThrow(RichTextError);
  });

  it('refuse les documents géants', () => {
    const content = Array.from({ length: 70_000 }, () => ({ type: 'horizontalRule' }));
    expect(() => sanitizeDoc({ type: 'doc', content })).toThrow(RichTextError);
  });

  it('soumet les blocs de code aux mêmes budgets', () => {
    const code = (text: string) => ({ type: 'doc', content: [{ type: 'codeBlock', content: [{ type: 'text', text }] }] });
    expect(() => sanitizeDoc(code(''))).toThrow(RichTextError);
    expect(() => sanitizeDoc(code('x'.repeat(500_000)))).toThrow(RichTextError);
    const many = Array.from({ length: 30_000 }, () => ({ type: 'text', text: 'x' }));
    expect(() => sanitizeDoc({ type: 'doc', content: [{ type: 'codeBlock', content: many }] })).toThrow(RichTextError);
    expect(sanitizeDoc(code('connect https://newfrontier.glife.fr/')).content).toHaveLength(1);
  });

  it('refuse les types inattendus', () => {
    for (const bad of [null, 1, 'doc', [], { type: 'text' }, { type: 'doc', content: 'x' }]) {
      expect(() => sanitizeDoc(bad)).toThrow(RichTextError);
    }
  });
});

describe('ancres de titres', () => {
  it('dédoublonne', () => {
    const h = (text: string) => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] });
    const doc = sanitizeDoc({ type: 'doc', content: [h('Règles générales'), h('Règles générales')] });
    expect(extractHeadings(doc).map((x) => x.id)).toEqual(['regles-generales', 'regles-generales-2']);
  });
});
