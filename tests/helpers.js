// Gets a new game's empty store stocked and open, the quick way, for tests that need trading.
module.exports.stockAndOpen = function (R, S, b) {
  for (const p of R.TYPES[b.type].catalog) R.setListed(S, b, p.id, true);
  const lines = Object.values(b.items).filter(it => b.listed[it.pid]).map(it => ({ sku: it.sku, cases: 2 }));
  const r = R.placeOrder(S, b.id, b.sups[0], lines); if (!r.ok) throw new Error(r.err);
  while (r.po.status === 'transit') R.step(S);
  R.acceptDelivery(S, r.po.id); R.putAwayAll(S, b); R.fillAll(S, b); R.putAwayAll(S, b);
  const o = R.openStore(S, b.id); if (!o.ok) throw new Error(o.err);
};
