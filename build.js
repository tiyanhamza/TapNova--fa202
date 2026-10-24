// Range les fichiers à plat dans l'arborescence attendue par Netlify (exécuté automatiquement au déploiement)
const fs = require('fs'), p = require('path');
const put = (src, dst) => { fs.mkdirSync(p.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); };
['index.html', 'admin.html', '404.html', 'style.css'].forEach(f => put(f, 'public/' + f));
['admin.js', 'c.js', 'contact.js'].forEach(f => put(f, 'netlify/functions/' + f));
put('util.js', 'lib/util.js');
console.log('Structure TapNova créée.');
