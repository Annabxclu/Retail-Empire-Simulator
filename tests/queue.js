// Customers must never give up on the checkout line, and cashiers must clear it even after closing.
require(require('path').join(__dirname, '..', 'src', 'engine.js'));
const R = globalThis.RE; let fail = 0; const { stockAndOpen } = require('./helpers');
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fail = 1; };

// 1. Nobody serves for a whole day: everyone who reached the line is still in it.
let S = R.newGame({ cash: R.C(20000) }), b = S.branches[0]; stockAndOpen(R, S, b);
const reached = new Set();
for (let i = 0; i < 1440; i++) {
  R.step(S);
  for (const id of b.queue) reached.add(id);
  const iss = R.audit(S); if (iss.length) { check(false, iss.join('; ')); break; }
}
const stillThere = [...reached].filter(id => b.queue.includes(id));
check(reached.size > 20, `${reached.size} customers joined the line during the day`);
check(stillThere.length === reached.size, `all ${reached.size} are still in line the next morning (${stillThere.length})`);
check(!S.ledger.some(l => l.kind === 'Sale'), 'no sales happened without anyone serving');

// 2. Player serves the leftover line overnight: every sale goes through.
let ok = 0;
for (const id of [...b.queue]) { R.serveStart(S, b.id, id); const c = b.cust[id]; if (R.completeSale(S, b.id, id, { given: c.visit.tender }).ok) ok++; }
check(ok === stillThere.length && b.queue.length === 0, `served all ${ok} waiting customers; line now empty`);

// 3. A cashier keeps working past closing until the line is empty.
S = R.newGame({ cash: R.C(50000) }); b = S.branches[0]; stockAndOpen(R, S, b);
const cashier = b.apps.find(a => a.role === 'cashier'); R.hire(S, b.id, cashier.id);
const emp = b.emps[0]; emp.rel = 1; emp.eff = 0.4; // slow cashier so a line builds
for (let i = 0; i < 1440 * 3; i++) { R.step(S); emp.on = true; const iss = R.audit(S); if (iss.length) { check(false, iss.join('; ')); break; } }
const lateSales = S.ledger.filter(l => l.kind === 'Sale' && (l.t % 1440) >= R.SHUT + 15).length;
check(b.queue.length === 0 || (S.t % 1440) < R.SHUT + 60, `cashier cleared the line (left: ${b.queue.length}); ${lateSales} sales after closing`);
const abandoned = Object.values(b.cust).some(c => c.hist.some(h => h.note === 'Left the queue' || h.note === 'Left at closing'));
check(!abandoned, 'no customer history shows anyone leaving the line');
process.exit(fail);
