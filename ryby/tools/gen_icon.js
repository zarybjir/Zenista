'use strict';
// Rastruje gfx/icon.svg do ikon Android aplikace: node ryby/tools/gen_icon.js (potřebuje Playwright).
// Ikonu samotnou kreslí tools/gen_gfx.js.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..'), RES = path.join(ROOT, '..', 'rybyapp/src/main/res');
const SIZES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };

(async () => {
  const svg = fs.readFileSync(path.join(ROOT, 'gfx/icon.svg'), 'utf8');
  const br = await chromium.launch();
  for (const [d, px] of Object.entries(SIZES)) {
    const pg = await br.newPage({ viewport: { width: px, height: px }, deviceScaleFactor: 1 });
    await pg.setContent(`<body style="margin:0">${svg.replace('width="512" height="512"', `width="${px}" height="${px}"`)}`);
    fs.mkdirSync(path.join(RES, 'mipmap-' + d), { recursive: true });
    await pg.screenshot({ path: path.join(RES, 'mipmap-' + d, 'ic_launcher.png'), omitBackground: true });
    await pg.close();
  }
  await br.close();
  console.log('ikony zapsány do ' + RES);
})();
