const { chromium } = require('playwright');
(async () => {
  const br = await chromium.launch(); const pg = await br.newPage({ viewport: { width: 1360, height: 900 } }); pg.setDefaultTimeout(4000);
  const errs = []; pg.on('pageerror', e => errs.push('PAGE ' + e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push('CON ' + m.text()); });
  await pg.goto('file://' + require('path').resolve(__dirname, '..', 'index.html'));
  await pg.click('input[value=sandbox]'); await pg.click('[data-a=start]');
  // fast forward game time via engine
  await pg.evaluate(() => { const S = window.__RE_UI.S; for (let i = 0; i < 200; i++) RE.step(S); });
  const views = ['hq','branches','expansion','finance','goals','admin','overview','checkout','inventory','products','suppliers','deliveries','customers','employees','equipment','marketing'];
  for (const v of views) { await pg.evaluate(v => window.__RE_UI.A.nav({ v }), v); const t = await pg.textContent('main h1'); if (!t) errs.push('no h1 ' + v); }
  // serve a customer manually via UI
  await pg.evaluate(() => window.__RE_UI.A.nav({ v: 'checkout' }));
  await pg.waitForTimeout(300);
  const has = await pg.$('[data-a=serveNext]:not([disabled])');
  if (has) { await has.click(); await pg.waitForTimeout(200);
    const cashBtn = await pg.$('[data-a=payM][data-k=card]'); await cashBtn.click(); await pg.click('#modal [data-a=pay]'); await pg.waitForTimeout(200); }
  else errs.push('no queue to serve');
  // order
  await pg.evaluate(() => window.__RE_UI.A.nav({ v: 'suppliers' }));
  await pg.click('[data-a=order]'); await pg.click('[data-a=orderSuggest]');
  await pg.fill('#modal input.qty >> nth=0', '80'); await pg.dispatchEvent('#modal input.qty >> nth=0', 'input');
  await pg.click('[data-a=orderPlace]'); console.log('after order:', await pg.textContent('#toasts'), 'modal:', await pg.evaluate(()=>window.__RE_UI.UI.modal&&window.__RE_UI.UI.modal.k));
  await pg.evaluate(() => { const S = window.__RE_UI.S; for (let i = 0; i < 300; i++) RE.step(S); window.__RE_UI.A.nav({ v: 'deliveries' }); });
  const rv = await pg.$('[data-a=review]'); if (rv) { await rv.click(); await pg.click('#modal [data-a=accept]'); console.log('accept:', await pg.textContent('#toasts'), await pg.evaluate(()=>window.__RE_UI.UI.modal&&window.__RE_UI.UI.modal.k), await pg.evaluate(()=>document.getElementById('revErr')&&document.getElementById('revErr').textContent)); } else errs.push('no delivery');
  // open a clothing branch through the wizard
  await pg.evaluate(() => window.__RE_UI.A.nav({ v: 'expansion' }));
  await pg.click('[data-a=wizard][data-t=clothing]'); await pg.click('[data-a=wzOpen]');
  for (const v of ['overview','inventory','products','checkout','customers']) await pg.evaluate(v => window.__RE_UI.A.nav({ v }), v);
  await pg.evaluate(() => window.__RE_UI.A.wizard({ t: 'book' })); await pg.click('[data-a=wzOpen]');
  await pg.evaluate(() => window.__RE_UI.A.wizard({ t: 'toy' })); await pg.click('[data-a=wzOpen]');
  await pg.evaluate(() => { const S = window.__RE_UI.S; S.speed = 4; for (let i = 0; i < 1440*2; i++) RE.step(S); window.__RE_UI.A.nav({ v: 'hq' }); });
  await pg.waitForTimeout(1500);
  await pg.screenshot({ path: '' + __dirname + '/hq.png', fullPage: false });
  await pg.evaluate(() => window.__RE_UI.A.nav({ v: 'finance' })); await pg.screenshot({ path: '' + __dirname + '/fin.png' });
  await pg.evaluate(() => { window.__RE_UI.UI.bid = 'b1'; window.__RE_UI.A.nav({ v: 'checkout' }); });
  const s2 = await pg.$('[data-a=serveNext]:not([disabled])'); if (s2) { await s2.click(); const cash = await pg.$('[data-a=payM][data-k=cash]'); await cash.click(); await pg.screenshot({ path: '' + __dirname + '/serve.png' }); await pg.keyboard.press('Escape'); }
  const audit = await pg.evaluate(() => RE.audit(window.__RE_UI.S));
  const m = await br.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  m.on('pageerror', e => errs.push('MOB ' + e.message));
  await m.goto('file://' + require('path').resolve(__dirname, '..', 'index.html')); await m.waitForTimeout(800);
  await m.screenshot({ path: '' + __dirname + '/mob.png' });
  console.log('errors', errs, 'audit', audit);
  await br.close();
})();
