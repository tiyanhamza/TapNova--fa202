const t = require('node:test'), a = require('node:assert/strict'), u = require('./util');
t('slugify', () => a.equal(u.slugify('Café Étoile & Fils'), 'cafe-etoile-fils'));
t('whatsapp Maroc', () => {
  a.equal(u.whatsapp('0612345678'), '212612345678'); a.equal(u.whatsapp('+212 6 12 34 56 78'), '212612345678');
  a.equal(u.whatsapp('+2120612345678'), '212612345678'); a.equal(u.whatsapp('00212712345678'), '212712345678');
  a.equal(u.whatsapp(''), ''); a.equal(u.whatsapp('abc'), '');
});
t('internationalPhone Maroc', () => {
  a.equal(u.internationalPhone('0612345678'), '+212612345678');
  a.equal(u.internationalPhone('0712345678'), '+212712345678');
  a.equal(u.internationalPhone('+212 6 12 34 56 78'), '+212612345678');
  a.equal(u.internationalPhone('00212712345678'), '+212712345678');
  a.equal(u.internationalPhone('abc'), '');
});
t('buildVcard escapes values and keeps Arabic UTF-8', () => {
  const card = u.buildVcard({
    name: 'مقهى, "الدار"',
    phone: '0612345678',
    email: 'contact@example.ma',
    whatsapp: 'https://wa.me/212712345678',
    website: 'https://example.ma/a,b',
    description: 'قهوة; حلويات\\عائلية\nكل يوم'
  });
  a.match(card, /FN:مقهى\\, "الدار"/);
  a.match(card, /ORG:مقهى\\, "الدار"/);
  a.match(card, /TEL;TYPE=WORK,VOICE:\+212612345678/);
  a.match(card, /TEL;TYPE=CELL,VOICE:\+212712345678/);
  a.match(card, /EMAIL:contact@example\.ma/);
  a.match(card, /URL:https:\/\/example\.ma\/a\\,b/);
  a.match(card, /NOTE:قهوة\\; حلويات\\\\عائلية\\nكل يوم/);
  a.ok(card.endsWith('END:VCARD\r\n'));
});
t('safeUrl', () => {
  a.equal(u.safeUrl('javascript:alert(1)'), ''); a.equal(u.safeUrl('instagram.com/x'), 'https://instagram.com/x'); a.equal(u.safeUrl('nope'), '');
});
t('session', () => {
  const s = u.makeSession('k'); a.ok(u.checkSession(s, 'k')); a.ok(!u.checkSession(s, 'autre'));
  a.ok(!u.checkSession(s.slice(0, -2) + 'xx', 'k')); a.ok(!u.checkSession(u.makeSession('k', -1000), 'k')); a.ok(!u.checkSession('', 'k'));
});
t('safeEq', () => { a.ok(u.safeEq('abc', 'abc')); a.ok(!u.safeEq('abc', 'abd')); });
t('cleanProfile', () => {
  a.ok(u.cleanProfile({ name: ' ' }).error);
  const ok = u.cleanProfile({ name: 'Café', whatsapp: 'https://wa.me/212612345678', instagram: '@shop', links: 'Menu|menu.com/x' });
  a.equal(ok.data.whatsapp, '212612345678'); a.equal(ok.data.instagram, 'https://instagram.com/shop'); a.equal(ok.data.links[0].url, 'https://menu.com/x');
  a.equal(u.cleanProfile({ name: 'A' }).data.facebook, '');
  a.match(u.cleanProfile({ name: 'A', facebook: 'javascript:x' }).error, /Facebook/);
  a.equal(u.cleanProfile({ name: 'A', logo_url: 'https://evil.com/x.png' }).data.logo_url, '');
});
t('profil pro : activité, e-mail, couleur, couverture', () => {
  const d = u.cleanProfile({ name: 'Optic 8000', category: 'Opticienne', email: 'a@b.ma', color: '#FF8A00', cover_url: 'https://res.cloudinary.com/x/y.jpg' }).data;
  a.equal(d.category, 'Opticienne'); a.equal(d.email, 'a@b.ma'); a.equal(d.color, '#FF8A00'); a.ok(d.cover_url);
  a.equal(u.cleanProfile({ name: 'A', color: 'red' }).data.color, '#1F5FFF');
  a.match(u.cleanProfile({ name: 'A', email: 'pas-un-email' }).error, /E-mail/);
});
