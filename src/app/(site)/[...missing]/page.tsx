import { notFound } from 'next/navigation';

/** Toute adresse inconnue passe par ici pour afficher la page 404 du site, avec son design. */
export default function MissingPage(): never {
  notFound();
}
