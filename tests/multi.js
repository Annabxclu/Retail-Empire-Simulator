require(require('path').join(__dirname, '..', 'src', 'engine.js')); const R=globalThis.RE;
const S=R.newGame({cash:R.C(200000)});
  { const bb=S.branches[0]; for(const p of R.TYPES.grocery.catalog) R.setListed(S,bb,p.id,true); }
for (const [type,loc] of [['clothing','mall'],['toy','heights'],['book','univ']]) { const r=R.openBranch(S,{type,name:type+' test',loc,size:'small',stock:true,grand:true}); if(!r.ok) console.log(r.err); }
R.hire(S,'b2',S.branches[1].apps.find(a=>a.role==='cashier').id);
R.hire(S,'b2',S.branches[1].apps.find(a=>a.role==='receiver').id);
R.hire(S,'b2',S.branches[1].apps.find(a=>a.role==='manager').id);
R.buyEquip(S,'b3','giftwrap');
let lastDay=1;
for(let i=0;i<1440*30;i++){ R.step(S); const m=S.t%1440;
  if(m%3===0) for(const b of S.branches){const id=b.queue.find(id=>b.cust[id].visit.phase==='queue'); if(id){R.serveStart(S,b.id,id); const c=b.cust[id]; const r=R.completeSale(S,b.id,id,{given:c.visit.tender,wrap:true}); if(!r.ok) console.log('sale',r.err);}}
  if(m%30===0) for(const b of S.branches) { R.putAwayAll(S,b); R.fillAll(S,b); if(b.setup) R.openStore(S,b.id); }
  if(m===300||m===400) for(const b of S.branches) for(const sid of b.sups){ const sug=R.reorderSuggestion(S,b,sid); if(sug.length){const r=R.placeOrder(S,b.id,sid,sug); if(!r.ok&&!/Minimum/.test(r.err)) console.log(b.type,r.err.slice(0,80));} }
  if(m%20===0) for(const po of S.pos) if(po.status==='arrived') R.acceptDelivery(S,po.id);
  const iss=R.audit(S); if(iss.length){console.log(iss);process.exit(1)}
  const d=R.dayOf(S.t); if(d!==lastDay){ if((d-1)%5===0||d<4){ const parts=S.branches.map(b=>{const s=R.sumStats(S,d-1,d-1,b.id); return `${b.type[0]}:${R.money(s.rev)}/${R.money(s.net)} sv${s.served} rep${b.rep.toFixed(0)}`}); console.log(R.fmtDate(d-1), parts.join(' | ')); } lastDay=d; }
}
console.log('cash',R.money(S.cash),'ret/pre', S.branches.map(b=>b.returnsDue.length+'/'+b.preorders.length).join(' '),'JSON KB',(JSON.stringify(S).length/1024)|0);
console.log(S.notes.slice(0,8).map(n=>n.text).join('\n'));
