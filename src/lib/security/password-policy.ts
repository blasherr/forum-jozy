const COMMON = [
  'password', 'motdepasse', 'azerty', 'qwerty', 'admin', 'administrateur', 'newfrontier',
  'frontier', 'redm', 'reddead', 'letmein', 'welcome', 'bienvenue', '123456', 'abcdef',
];

/** Renvoie un message d'erreur, ou null si le mot de passe est acceptable. */
export function checkPassword(password: string, context: string[] = []): string | null {
  if (password.length < 12) return 'Le mot de passe doit faire au moins 12 caractères.';
  if (password.length > 256) return 'Le mot de passe est trop long (256 caractères maximum).';

  const lower = password.toLowerCase();
  const compact = lower.replace(/[^a-z0-9]/g, '');
  if (COMMON.some((w) => compact.includes(w) && compact.length - w.length < 8)) {
    return 'Ce mot de passe est trop courant.';
  }
  for (const c of context) {
    const value = c.toLowerCase().split('@')[0] ?? '';
    if (value.length >= 4 && lower.includes(value)) {
      return 'Le mot de passe ne doit pas contenir votre nom ou votre e-mail.';
    }
  }
  if (new Set(password).size < 8) return 'Le mot de passe est trop répétitif.';

  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((r) => r.test(password)).length;
  if (classes < 3 && password.length < 20) {
    return 'Mélangez minuscules, majuscules, chiffres et symboles, ou utilisez une phrase de 20 caractères.';
  }
  return null;
}
