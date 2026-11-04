'use client';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="lost">
      <p className="kicker">Incident</p>
      <h1>Le pont s’est effondré</h1>
      <p>Une erreur est survenue de notre côté. Réessayez dans un instant.</p>
      <button type="button" className="btn btn-primary" onClick={reset}>
        Réessayer
      </button>
    </div>
  );
}
