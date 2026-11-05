import { redirect } from 'next/navigation';
import { isDesign, startDesignPreview, stopDesignPreview } from '@/lib/content/design-preview';
import { getAuth } from '@/lib/security/session';

/**
 * Compare les designs sur le vrai site sans rien publier : l'aperçu ne concerne que ce navigateur.
 * Réservé aux comptes connectés, pour qu'un lien extérieur ne puisse pas changer l'apparence chez un visiteur.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const reset = name === 'reset';
  if (!reset && !isDesign(name)) return new Response('Introuvable', { status: 404 });
  if (!(await getAuth())) redirect('/connexion');
  if (reset) await stopDesignPreview();
  else await startDesignPreview(name);
  redirect('/');
}
