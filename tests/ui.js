// Browser walkthrough of a new game using real clicks. Needs Playwright.
const { chromium } = require('playwright');
const path = require('path');
const shot = n => path.join(__dirname, n + '.png');
(async () => {
  const br = await chromium.launch(); const errs = [];
  const mobile = process.argv.includes('--mobile');
  const pg = await br.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1360, height: 900 }, deviceScaleFactor: mobile ? 2 : 1 });
  pg.setDefaultTimeout(5000);
  pg.on('pageerror', e => errs.push('PAGE ' + e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push('CON ' + m.text()); });
  const nav = v => pg.evaluate(v => window.__RE_UI.A.nav({ v }), v);
  const G = f => pg.evaluate(f);
  await pg.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await pg.evaluate(() => localStorage.clear()); await pg.reload();
  await pg.click('[data-a=start]');
  await G(() => { window.__RE_UI.S.speed = 0; });
  // 1. order from the checklist
  await pg.click('.checklist [data-a=order]');
  const inputs = await pg.$$('#modal input[data-c=oq]');
  for (const i of inputs.slice(0, 14)) { await i.fill('2'); await i.dispatchEvent('input'); }
  await pg.screenshot({ path: shot('1-order') });
  await pg.click('[data-a=orderPlace]');
  if (await G(() => window.__RE_UI.S.pos.length) !== 1) errs.push('order not placed');
  // 2. wait for the truck
  await pg.click('.checklist [data-a=waitDelivery]');
  await pg.screenshot({ path: shot('2-checklist') });
  // 3. check in
  await pg.click('.checklist [data-a=nav][data-v=deliveries]');
  await pg.click('[data-a=review]'); await pg.click('#modal [data-a=accept]');
  if (await G(() => window.__RE_UI.UI.view) !== 'stockroom') errs.push('did not land in stockroom');
  // 4. unpack: 3 with Unpack, 1 by choosing a rack space
  for (let i = 0; i < 3; i++) await pg.click('.dbox [data-a=unpack] >> nth=0');
  await pg.click('.dbox .box >> nth=0'); await pg.click('.slot.target >> nth=8');
  await pg.click('.dbox .box >> nth=0');
  await pg.screenshot({ path: shot('3-stockroom') });
  await pg.click('.selbar [data-a=carry]');
  await pg.click('.dbox [data-a=carry] >> nth=0');
  const held = await G(() => RE.inHands(window.__RE_UI.S.branches[0]).length);
  if (held !== 2) errs.push('expected 2 boxes in hands, got ' + held);
  // 5. store floor: put new products on empty spaces
  await nav('floor');
  await pg.screenshot({ path: shot('4-floor-carrying') });
  for (let g = 0; g < 6 && await pg.$('.facing.open [data-a=stockBox], .facing [data-a=stockBox]'); g++) await pg.click('.facing.open [data-a=stockBox], .facing [data-a=stockBox] >> nth=0');
  // carry & stock the rest: unpack everything first, then fetch for each product
  await nav('stockroom');
  for (let g = 0; g < 40 && await pg.$('.dbox [data-a=carry]'); g++) {
    await pg.click('.dbox [data-a=carry] >> nth=0');
    if (await G(() => RE.inHands(window.__RE_UI.S.branches[0]).length) >= 2) { await nav('floor'); for (let g = 0; g < 4 && await pg.$('.hbox [data-a=stockBox]'); g++) await pg.click('.hbox [data-a=stockBox] >> nth=0'); await G(() => { const b = window.__RE_UI.S.branches[0]; for (const c of RE.inHands(b)) if (!RE.putCase(window.__RE_UI.S, b, c.id).ok) RE.putCase(window.__RE_UI.S, b, c.id, 'dock'); }); await nav('stockroom'); }
  }
  await nav('floor'); for (let g = 0; g < 4 && await pg.$('.hbox [data-a=stockBox]'); g++) await pg.click('.hbox [data-a=stockBox] >> nth=0'); await G(() => { const b = window.__RE_UI.S.branches[0]; for (const c of RE.inHands(b)) if (!RE.putCase(window.__RE_UI.S, b, c.id).ok) RE.putCase(window.__RE_UI.S, b, c.id, 'dock'); });
  for (let k = 0; k < 6; k++) { const f = await pg.$('[data-a=fetch]:not([disabled])'); if (!f) break; await f.click(); const s = await pg.$('.facing [data-a=stockBox]'); if (s) await s.click(); }
  await pg.screenshot({ path: shot('5-floor-stocked'), fullPage: !mobile });
  // 6. open
  await nav('overview'); await pg.click('.checklist [data-a=openStore]');
  if (await G(() => window.__RE_UI.S.branches[0].status) !== 'open') errs.push('store did not open');
  // 7. trade, then serve one customer by hand
  await G(() => { const S = window.__RE_UI.S, b = S.branches[0]; let g = 0; while (!b.queue.length && g++ < 1440) RE.step(S); });
  await nav('checkout'); await pg.click('[data-a=serveNext]');
  if (await pg.$('#cashIn')) await pg.click('[data-a=cashQuick] >> nth=-1');
  await pg.click('#modal [data-a=pay]');
  if (!(await G(() => window.__RE_UI.S.ledger.some(l => l.kind === 'Sale')))) errs.push('no sale recorded');
  // 8. let shelves run down, then look
  await G(() => { const S = window.__RE_UI.S, b = S.branches[0]; for (let i = 0; i < 240; i++) { RE.step(S); for (const id of [...b.queue]) { RE.serveStart(S, b.id, id); RE.completeSale(S, b.id, id, { given: b.cust[id].visit.tender }); } } });
  await nav('floor'); await pg.screenshot({ path: shot('6-floor-after-trading') });
  // 9. every screen renders
  for (const v of ['hq','branches','expansion','finance','goals','admin','overview','floor','stockroom','checkout','inventory','products','suppliers','deliveries','customers','employees','equipment','marketing'])
    { await nav(v); if (!(await pg.textContent('main h1'))) errs.push('blank ' + v); if (await pg.$('main .card h2:text("Something went wrong")')) errs.push('crash ' + v); }
  // 10. a second store via the wizard (fully stocked option)
  await G(() => { window.__RE_UI.S.cash += 3e6; window.__RE_UI.A.wizard({ t: 'clothing' }); }); await pg.click('[data-a=wzOpen]');
  await nav('floor'); await pg.screenshot({ path: shot('7-clothing-floor') });
  await nav('stockroom');
  const audit = await G(() => RE.audit(window.__RE_UI.S));
  console.log('errors', errs, 'audit', audit);
  await br.close(); process.exit(errs.length || audit.length ? 1 : 0);
})();
