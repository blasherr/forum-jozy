import type { ReactNode } from 'react';

/** Recréé à chaque changement de page : c'est lui qui porte la transition d'entrée. */
export default function Template({ children }: { children: ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
