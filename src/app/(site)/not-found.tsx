import Link from 'next/link';
import { Ornament } from '@/components/site/parts';

export default function NotFound() {
  return (
    <div className="lost">
      <p className="kicker">Erreur 404</p>
      <h1>Perdu dans le bayou</h1>
      <Ornament />
      <p>Aucune piste ne mène ici. La page a peut-être changé de place.</p>
      <Link href="/" className="btn btn-primary">
        Retrouver le chemin
      </Link>
    </div>
  );
}
