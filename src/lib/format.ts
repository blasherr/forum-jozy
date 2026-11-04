const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'Europe/Paris' });
const dateTimeFormat = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Paris',
});

export const formatDate = (ms: number | null | undefined): string => (ms ? dateFormat.format(ms) : '');
export const formatDateTime = (ms: number | null | undefined): string => (ms ? dateTimeFormat.format(ms) : '');

export const plural = (n: number, one: string, many: string): string => `${n} ${n > 1 ? many : one}`;

const ROMAN: [number, string][] = [
  [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

export function roman(n: number): string {
  let rest = n;
  let out = '';
  for (const [value, symbol] of ROMAN) {
    while (rest >= value) {
      out += symbol;
      rest -= value;
    }
  }
  return out;
}
