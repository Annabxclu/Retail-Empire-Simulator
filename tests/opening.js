// Plays the new opening by hand through the engine: order -> check in -> unpack -> carry -> open.
require(require('path').join(__dirname, '..', 'src', 'engine.js'));
const R = globalThis.RE; let fail = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fail = 1; };
const S = R.newGame({}); const b = S.branches[0];
check(b.status === 'closed' && Object.keys(b.listed).length === 0 && b.cases.length === 0, 'new store is closed, with empty shelves and stockroom');
check(!R.openStore(S, b.id).ok, 'cannot open with empty shelves');
check(R.stockCap(b) === 24, `stockroom has ${R.stockCap(b)} box spaces`);
// order 2 boxes each of 10 everyday products
const pick = ['g-milk','g-eggs','g-sourdough','g-banana','g-spaghetti','g-water','g-chips','g-cereal','g-apple','g-cheddar'];
const r = R.placeOrder(S, b.id, 'freshway', pick.map(sku => ({ sku, cases: 2 })));
check(r.ok, 'placed first order ' + (r.ok ? `${r.po.id} ${R.money(r.po.total)}, ${r.po.lines.reduce((a, l) => a + l.qty, 0)} units` : r.err));
for (let i = 0; i < 1440 && r.po.status === 'transit'; i++) R.step(S);
check(r.po.status === 'arrived', `delivery arrived at ${R.fmtTime(r.po.arrivedAt)}`);
const acc = R.acceptDelivery(S, r.po.id);
check(acc.ok && R.atDock(b).length === acc.boxes, `checked in: ${acc.boxes} boxes at the back door, credit ${R.money(acc.credit || 0)}`);
check(R.itShelf(b.items['g-milk']) === 0, 'nothing on shelves until carried');
// unpack two boxes, carry two directly
const dock = R.atDock(b);
check(R.putCase(S, b, dock[0].id).ok && R.putCase(S, b, dock[1].id, 'S2-5').ok, 'unpacked boxes onto racks (auto + chosen space)');
check(!R.putCase(S, b, dock[2].id, 'S2-5').ok, 'cannot put two boxes in one rack space');
const t1 = R.takeCase(S, b, dock[2].id), t2 = R.takeCase(S, b, dock[3].id), t3 = R.takeCase(S, b, dock[4].id);
check(t1.ok && t2.ok && !t3.ok, 'can carry 2 boxes, third refused: ' + t3.err);
const sku = R.caseOf(b, dock[2].id).sku;
const st1 = R.stockCase(S, b, dock[2].id);
check(st1.ok && b.listed[b.items[sku].pid] && R.itShelf(b.items[sku]) === st1.moved, `stocked ${st1.moved} of ${sku}, product now on display`);
// keep stocking everything
let guard = 0;
while (b.cases.length && guard++ < 200) {
  for (const c of R.inHands(b)) { const x = R.stockCase(S, b, c.id); if (!x.ok) R.putCase(S, b, c.id); }
  const next = b.cases.filter(c => c.loc !== 'hands' && R.itShelf(b.items[c.sku]) < R.shelfMaxOf(b, R.prodOf(b, b.items[c.sku])));
  if (!next.length) break;
  for (const c of next.slice(0, R.handsCap(b))) R.takeCase(S, b, c.id);
}
const onShelf = Object.values(b.items).filter(it => R.itShelf(it) > 0).length;
const delivered = new Set(r.po.lines.filter(l => l.delivered - l.dmg > 0).map(l => l.sku)).size;
check(onShelf === delivered, `${onShelf} of ${delivered} delivered products on the shelves; ${b.cases.length} boxes left in the stockroom (${R.stockUsed(b)} rack spaces used)`);
check(R.openStore(S, b.id).ok && b.status === 'open', 'store opened');
const comb = R.combineCases(S, b); check(comb.ok, `combine part-full boxes freed ${comb.freed} spaces`);
const before = S.cash; const d = R.discardCase(S, b, b.cases[0].id); check(d.ok, `threw out a box worth ${R.money(d.value)}`);
for (let i = 0; i < 1440 * 2; i++) { R.step(S); const iss = R.audit(S); if (iss.length) { check(false, iss.join('; ')); break; } }
check(R.audit(S).length === 0, 'two days of trading with no integrity problems; queue ' + b.queue.length);
process.exit(fail);
