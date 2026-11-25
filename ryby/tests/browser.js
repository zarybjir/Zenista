'use strict';
// Test v prohlížeči: node ryby/tests/browser.js  (potřebuje Playwright s Chromiem)
// Načte hru, odehraje úroveň myší, projde výsledek a restart, hlídá chyby v konzoli.
// Snímky ukládá do ryby/tests/out/ – po změně vykreslování se na ně podívej.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const { ROOT } = require('./lib.js');
const OUT = path.join(__dirname, 'out');
const MIME = { '.html': 'text/html', '.js': 'text/javascript' };

const ok = (c, msg) => { if (!c) throw new Error(msg); };

(async () => {
  const srv = http.createServer((q, r) => {
    const f = path.join(ROOT, q.url === '/' ? 'index.html' : decodeURIComponent(q.url.split('?')[0]));
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
    r.end(fs.readFileSync(f));
  }).listen(0);
  const url = 'http://127.0.0.1:' + srv.address().port + '/';
  const br = await chromium.launch();
  const errs = [];
  let fail = 0;
  try {
    fs.mkdirSync(OUT, { recursive: true });
    for (const [name, vp] of [['sirokouhly', { width: 1280, height: 720 }], ['uzky', { width: 800, height: 600 }]]) {
      const pg = await br.newPage({ viewport: vp, deviceScaleFactor: 1 });
      pg.on('pageerror', e => errs.push(name + ': ' + e.message));
      pg.on('console', m => { if (m.type() === 'error') errs.push(name + ': ' + m.text()); });
      await pg.goto(url);
      await pg.waitForFunction('typeof App !== "undefined" && App.game');
      const st = () => pg.evaluate('App.game.state');
      // bod světa → pixel
      const px = (x, y) => pg.evaluate(`({ x: (${x} - R.cam.x) * R.s, y: R.H - (${y} + VIEW.ground) * R.s })`);
      // výstřel tahem myši podle úhlu a síly
      const shoot = async (a, p) => {
        const d = await pg.evaluate('SLING.max') * p, r = a * Math.PI / 180;
        const from = await px(0, await pg.evaluate('SLING.y')), to = await px(-Math.cos(r) * d, await pg.evaluate('SLING.y') - Math.sin(r) * d);
        await pg.mouse.move(from.x, from.y); await pg.mouse.down();
        await pg.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2); await pg.mouse.move(to.x, to.y);
        return async () => { await pg.mouse.up(); };
      };
      ok(await st() === 'aim', 'hra nezačala mířením');
      await pg.waitForFunction('Math.abs(R.cam.x - VIEW.minX) < 0.01'); // úvodní přejezd kamery
      await pg.screenshot({ path: path.join(OUT, name + '-1-start.png') });

      const sol = await pg.evaluate('LEVELS[0].sol[0]');
      const rel = await shoot(sol[0], sol[1]);
      ok(await pg.evaluate('App.game.aiming'), 'tah myší nezačal míření');
      await pg.screenshot({ path: path.join(OUT, name + '-2-mireni.png') });
      await rel();
      ok(await st() === 'fly', 'po puštění ryba neletí');
      await pg.waitForFunction('App.game.t > 50');
      await pg.screenshot({ path: path.join(OUT, name + '-3-let.png') });
      await pg.waitForFunction('["aim","won","lost"].includes(App.game.state)', null, { timeout: 30000 });
      await pg.waitForTimeout(300);
      await pg.screenshot({ path: path.join(OUT, name + '-4-po-vystrelu.png') });

      // dohrát do konce (výhra nebo prohra), pak tlačítka
      for (let i = 0; i < 5 && await st() === 'aim'; i++) {
        await (await shoot(170, 1))();
        await pg.waitForFunction('["aim","won","lost"].includes(App.game.state)', null, { timeout: 30000 });
      }
      const end = await st();
      ok(end === 'won' || end === 'lost', 'úroveň neskončila: ' + end);
      await pg.waitForTimeout(100);
      await pg.screenshot({ path: path.join(OUT, name + '-5-vysledek.png') });
      const btn = id => pg.evaluate(`(() => { const b = UI.btns.filter(b => b.id === '${id}').pop(); return b && { x: b.x + b.w / 2, y: b.y + b.h / 2 }; })()`);
      if (end === 'won') {
        const b = await btn('next');
        ok(b, 'chybí tlačítko Další');
        await pg.mouse.click(b.x, b.y);
        ok(await pg.evaluate('App.li') === 1 && await st() === 'aim', 'Další nenačetlo druhou úroveň');
        await pg.screenshot({ path: path.join(OUT, name + '-6-uroven2.png') });
      }
      const b = await btn('restart');
      await pg.mouse.click(b.x, b.y);
      ok(await st() === 'aim' && await pg.evaluate('App.game.score') === 0, 'restart nevrátil úroveň na začátek');
      await pg.keyboard.press('r');
      ok(await st() === 'aim', 'klávesa R');
      await pg.close();
      console.log('ok   ' + name);
    }
    ok(!errs.length, 'chyby v konzoli:\n' + errs.join('\n'));
  } catch (e) { fail = 1; console.log('FAIL ' + e.message); }
  await br.close();
  srv.close();
  console.log(fail ? 'test v prohlížeči selhal' : 'test v prohlížeči prošel, snímky: ' + OUT);
  process.exit(fail);
})();
