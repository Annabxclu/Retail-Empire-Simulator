require(require('path').join(__dirname, '..', 'src', 'engine.js'));
const R = globalThis.RE;
function run(days, botLevel){
  const S = R.newGame({company:'Test', cash:R.C(6000)});
  const b = S.branches[0];
  let lastDay=0;
  for(let i=0;i<days*1440;i++){
    R.step(S);
    const m=S.t%1440;
    if(botLevel>0){
      // bot: serve queue every 3 min (simulating a player), fill shelves every 30 min
      if(m%3===0){ for(const bb of S.branches){ const id=bb.queue.find(id=>bb.cust[id].visit.phase==='queue'); if(id){ R.serveStart(S,bb.id,id); const c=bb.cust[id]; const r=R.completeSale(S,bb.id,id,{method:c.pay,given:c.visit.tender,wrap:true,manual:true}); if(!r.ok) console.log('ERR',r.err);} } }
      if(m%30===0) for(const bb of S.branches) R.fillAll(S,bb);
      if(m===360||m===780){ if(S.t<1440) for(const it of Object.values(b.items)){it.min=18;it.reorder=26;} for(const bb of S.branches){ for(const sid of bb.sups){ const sug=R.reorderSuggestion(S,bb,sid); if(sug.length){ const r=R.placeOrder(S,bb.id,sid,sug); if(!r.ok && !/Minimum/.test(r.err)) console.log('PO',r.err.slice(0,90));} } } }
      if(m%20===0) for(const po of S.pos) if(po.status==='arrived') { const r=R.acceptDelivery(S,po.id); if(!r.ok && !po._l){po._l=1;console.log('ACC',r.err);} }
    }
    const iss=R.audit(S); if(iss.length){console.log('AUDIT',iss);process.exit(1);}
    const d=R.dayOf(S.t); if(d!==lastDay && d>1){ const s=R.sumStats(S,d-1,d-1); console.log(`day ${d-1}: rev ${R.money(s.rev)} net ${R.money(s.net)} served ${s.served} lost ${s.lost} visits ${s.visits} sat ${(s.satSum/Math.max(1,s.satN)).toFixed(0)} rep ${b.rep.toFixed(1)} cash ${R.money(S.cash)} spoil ${R.money(s.spoil)}`); lastDay=d; }
  }
  return S;
}
const S=run(+process.argv[2]||8, 1);
console.log('ledger',S.ledger.length,'json KB',(JSON.stringify(S).length/1024).toFixed(0));
