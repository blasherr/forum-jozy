import { randomBytes } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';

beforeAll(() => {
  process.env.APP_ORIGIN = 'http://localhost:3000';
  process.env.SESSION_SECRET = randomBytes(32).toString('base64');
  process.env.PASSWORD_PEPPER = randomBytes(32).toString('base64');
  process.env.ENCRYPTION_KEY = randomBytes(32).toString('base64');
});

describe('TOTP (vecteurs RFC 6238 / RFC 4226)', () => {
  it('HOTP conforme à la RFC 4226', async () => {
    const { hotp } = await import('@/lib/security/totp');
    const secret = Buffer.from('12345678901234567890');
    const expected = ['755224', '287082', '359152', '969429', '338314', '254676', '287922', '162583', '399871', '520489'];
    expected.forEach((code, i) => expect(hotp(secret, i)).toBe(code));
  });

  it('base32 aller-retour', async () => {
    const { base32Decode, base32Encode } = await import('@/lib/security/totp');
    const data = randomBytes(20);
    expect(base32Decode(base32Encode(data)).equals(data)).toBe(true);
  });

  it('un code déjà utilisé ne se rejoue pas', async () => {
    const { base32Encode, currentStep, hotp, verifyTotp } = await import('@/lib/security/totp');
    const raw = randomBytes(20);
    const secret = base32Encode(raw);
    const now = Date.now();
    const step = currentStep(now);
    const code = hotp(raw, step);
    expect(verifyTotp(secret, code, 0, now)).toBe(step);
    expect(verifyTotp(secret, code, step, now)).toBeNull();
  });

  it('un code trop ancien est refusé', async () => {
    const { base32Encode, currentStep, hotp, verifyTotp } = await import('@/lib/security/totp');
    const raw = randomBytes(20);
    const now = Date.now();
    expect(verifyTotp(base32Encode(raw), hotp(raw, currentStep(now) - 3), 0, now)).toBeNull();
  });

  it.each(['', '12345', '1234567', 'abcdef', "' OR 1"])('format refusé : %j', async (code) => {
    const { newTotpSecret, verifyTotp } = await import('@/lib/security/totp');
    expect(verifyTotp(newTotpSecret(), code, 0)).toBeNull();
  });
});

describe('Chiffrement', () => {
  it('aller-retour et liaison au propriétaire', async () => {
    const { decrypt, encrypt } = await import('@/lib/security/crypto');
    const box = encrypt('secret', 'user-a');
    expect(decrypt(box, 'user-a')).toBe('secret');
    expect(() => decrypt(box, 'user-b')).toThrow();
  });

  it('toute altération est détectée', async () => {
    const { decrypt, encrypt } = await import('@/lib/security/crypto');
    const box = encrypt('secret', 'a');
    const parts = box.split('.');
    parts[3] = Buffer.from('falsifié').toString('base64url');
    expect(() => decrypt(parts.join('.'), 'a')).toThrow();
  });

  it('deux chiffrés du même texte diffèrent', async () => {
    const { encrypt } = await import('@/lib/security/crypto');
    expect(encrypt('x', 'a')).not.toBe(encrypt('x', 'a'));
  });
});

describe('Comparaisons et jetons', () => {
  it('safeEqual', async () => {
    const { safeEqual } = await import('@/lib/security/crypto');
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });

  it('un HMAC de CSRF ne vaut pas pour un autre usage', async () => {
    const { hmac } = await import('@/lib/security/crypto');
    expect(hmac('csrf', 'x')).not.toBe(hmac('recovery', 'x'));
  });
});

describe('Clé de limitation par IP', () => {
  it('garde une IPv4 entière', async () => {
    const { limitKey } = await import('@/lib/security/ip');
    expect(limitKey('203.0.113.7')).toBe('203.0.113.7');
    expect(limitKey('::ffff:203.0.113.7')).toBe('203.0.113.7');
    expect(limitKey('direct')).toBe('direct');
  });

  it('regroupe toute une IPv6 /64', async () => {
    const { limitKey } = await import('@/lib/security/ip');
    const key = limitKey('2001:db8:1:2:aaaa:bbbb:cccc:dddd');
    expect(limitKey('2001:db8:1:2:1:2:3:4')).toBe(key);
    expect(limitKey('2001:0db8:0001:0002::9')).toBe(key);
    expect(limitKey('2001:DB8:1:2::1')).toBe(key);
    expect(limitKey('2001:db8:1:3::1')).not.toBe(key);
  });
});

describe('Politique de mot de passe', () => {
  it('refuse les mots de passe faibles', async () => {
    const { checkPassword } = await import('@/lib/security/password-policy');
    for (const bad of ['court', 'motdepasse123', 'azertyuiop12', 'aaaaaaaaaaaaaaaa', 'newfrontier2026']) {
      expect(checkPassword(bad)).not.toBeNull();
    }
    expect(checkPassword('jean.dupont-1847!', ['jean.dupont@mail.fr'])).not.toBeNull();
    expect(checkPassword('a'.repeat(300))).not.toBeNull();
  });

  it('accepte un bon mot de passe et une longue phrase', async () => {
    const { checkPassword } = await import('@/lib/security/password-policy');
    expect(checkPassword('Tr0ub4dor&3-Cheval!')).toBeNull();
    expect(checkPassword('le vieux cheval boit dans le bayou')).toBeNull();
  });
});

describe('Recherche', () => {
  it('ne plante pas sur une saisie hostile', async () => {
    const { searchEntries } = await import('@/lib/content/search');
    const entry = {
      id: '1',
      title: 't',
      body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Mort RP' }] }] },
    } as never;
    expect(searchEntries([entry], '(a+)+$')).toEqual([]);
    expect(searchEntries([entry], "' OR 1=1 --")).toEqual([]);
    expect(searchEntries([entry], 'mort rp')).toHaveLength(1);
  });
});
