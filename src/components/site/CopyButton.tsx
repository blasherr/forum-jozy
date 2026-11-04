'use client';

import { useState } from 'react';

export function CopyButton({ text, label = 'Copier' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      window.setTimeout(() => setDone(false), 1800);
    } catch {
      setDone(false);
    }
  }

  return (
    <button type="button" className="copy" onClick={copy} aria-live="polite">
      {done ? 'Copié ✓' : label}
    </button>
  );
}
