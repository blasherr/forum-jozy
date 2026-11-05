import { DESIGN_INFO } from '@/lib/content/labels';
import { DESIGNS, type Design } from '@/lib/content/schemas';

/** Barre de comparaison, affichée uniquement au compte qui a lancé un aperçu depuis le panel. */
export function DesignBar({ current }: { current: Design }) {
  return (
    <aside className="design-bar" aria-label="Aperçu des designs">
      <span className="design-bar-label">Aperçu</span>
      {DESIGNS.map((key) => (
        <a key={key} href={`/design/${key}`} aria-current={key === current ? 'true' : undefined}>
          {DESIGN_INFO[key].name}
        </a>
      ))}
      <a className="design-bar-exit" href="/design/reset">
        Quitter l’aperçu
      </a>
    </aside>
  );
}
