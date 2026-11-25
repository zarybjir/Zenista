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
      ok(await pg.evaluate('Sfx.ac && Sfx.ac.state') === 'running', 'zvuk se prvním dotykem neodemkl');
      await pg.waitForFunction('R.snap > 0', null, { timeout: 2000 }); // prut po výstřelu kmitá
      await pg.waitForFunction('App.game.t > 50');
      await pg.screenshot({ path: path.join(OUT, name + '-3-let.png') });
      // první náraz: částice a otřes
      await pg.waitForFunction('App.game.score > 0 && R.parts.some(p => p.life > 0)', null, { timeout: 30000 });
      ok(await pg.evaluate('R.parts.length') <= await pg.evaluate('FX.max'), 'příliš mnoho částic');
      await pg.screenshot({ path: path.join(OUT, name + '-3b-naraz.png') });
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
      await pg.waitForFunction('UI.btns.length > 2', null, { timeout: 5000 }); // výsledek se ukáže se zpožděním
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
      // zoom kolečkem v mezích
      const z0 = await pg.evaluate('R.z');
      await pg.mouse.wheel(0, 100);
      ok(await pg.evaluate('R.z') < z0, 'kolečko nezměnilo zoom');
      for (let i = 0; i < 30; i++) await pg.mouse.wheel(0, 100);
      ok(Math.abs(await pg.evaluate('R.z') - await pg.evaluate('VIEW.zMin')) < 1e-9, 'zoom mimo meze');
      await pg.waitForTimeout(400);
      await pg.screenshot({ path: path.join(OUT, name + '-7-oddaleno.png') });
      for (let i = 0; i < 40; i++) await pg.mouse.wheel(0, -100);
      ok(Math.abs(await pg.evaluate('R.z') - await pg.evaluate('VIEW.zMax')) < 1e-9, 'zoom mimo meze');
      await pg.evaluate('R.zoom(1 / R.z)');
      await pg.keyboard.press('r');
      ok(await st() === 'aim', 'klávesa R');

      // uložený postup, výběr úrovně
      if (end === 'won') {
        const sv = JSON.parse(await pg.evaluate('localStorage.getItem(Save.KEY)'));
        ok(sv && sv.lv['led-1'] && sv.lv['led-1'].s >= 1 && sv.lv['led-1'].b > 0, 'výhra se neuložila');
        const m = await btn('menu');
        await pg.mouse.click(m.x, m.y);
        ok(await pg.evaluate('App.screen') === 'menu', 'tlačítko výběru úrovně');
        await pg.waitForTimeout(100);
        await pg.screenshot({ path: path.join(OUT, name + '-8-vyber.png') });
        ok(await btn('lvl1') && !(await btn('lvl2')), 'odemčená má být jen první a druhá úroveň');
        await pg.keyboard.press('ArrowLeft'); await pg.keyboard.press('ArrowRight'); await pg.keyboard.press('ArrowRight');
        ok(await pg.evaluate('UI.sel') <= 1, 'výběr klávesami zašel na zamčenou úroveň');
        const t = await btn('lvl0');
        await pg.mouse.click(t.x, t.y);
        ok(await pg.evaluate('App.screen') === 'play' && await pg.evaluate('App.li') === 0, 'dlaždice nespustila úroveň');
        await pg.keyboard.press('Escape');
        ok(await pg.evaluate('App.screen') === 'menu', 'Escape nevede do výběru');
        await pg.reload();
        await pg.waitForFunction('typeof App !== "undefined" && App.game');
        ok(await pg.evaluate('App.screen') === 'menu' && await pg.evaluate('Save.get("led-1").s') >= 1, 'postup po novém načtení chybí');
        await pg.evaluate('Save.open = () => true'); // další kontroly potřebují všechny úrovně
      }

      // schopnost klepnutím za letu, kreslení všech ryb a medvědů
      for (const [id, a, p] of [['sardinky-1', 40, 0.8], ['stika-1', 40, 0.8], ['ctverzubec-1', 40, 0.8], ['uhor-1', 40, 0.8], ['grizzly-1', 40, 0.9]]) {
        await pg.evaluate(`App.start(LEVELS.findIndex(l => l.id === '${id}'))`);
        await pg.waitForFunction('Math.abs(R.cam.x - VIEW.minX) < 0.01');
        if (id === 'grizzly-1') await pg.screenshot({ path: path.join(OUT, name + '-9-' + id + '.png') });
        await (await shoot(a, p))();
        await pg.waitForFunction('App.game.t > 25');
        await pg.mouse.click(vp.width / 2, vp.height / 3);
        const used = await pg.evaluate('App.game.fish && App.game.fish.used');
        ok(id === 'grizzly-1' ? !used : used, id + ': schopnost klepnutím');
        await pg.waitForTimeout(120);
        await pg.screenshot({ path: path.join(OUT, name + '-9-' + id + '-schopnost.png') });
      }
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
