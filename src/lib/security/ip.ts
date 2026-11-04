/**
 * Clé de limitation de débit pour une IP. Une IPv4 reste entière ; une IPv6 est réduite à son /64,
 * car un seul abonné dispose de milliards d'adresses dans ce bloc et pourrait en changer à chaque essai.
 */
export function limitKey(ip: string): string {
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  if (mapped?.[1]) return mapped[1];
  if (!ip.includes(':')) return ip;

  const [head = '', tail = ''] = ip.toLowerCase().split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const missing = Math.max(0, 8 - left.length - right.length);
  const groups = ip.includes('::') ? [...left, ...Array<string>(missing).fill('0'), ...right] : left;
  const prefix = groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, ''));
  return `${prefix.join(':')}::/64`;
}
