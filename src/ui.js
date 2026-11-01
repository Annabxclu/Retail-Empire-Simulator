/* Retail Empire Simulator: interface. All game rules live in engine.js (RE). */
(function () {
'use strict';
const R = window.RE, M = R.money, C = R.C;
const SAVE_KEY = 're_save_v1', LOCK_KEY = 're_lock_v1';
const TAB = Math.random().toString(36).slice(2);
let S = null;
const UI = { view: 'hq', bid: null, modal: null, nav: false, invTab: 'all', invQ: '', invCat: '', prodCat: '', custQ: '', custF: 'all', finRange: 'today', finB: '', ledB: '', order: null, wiz: null, confirm: null, locked: false, lastSave: 0, dirty: false, saveErr: '' };

/* ---------- small helpers ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);
const K = c => { const a = Math.abs(c) / 100, s = c < 0 ? '−$' : '$'; return a >= 1e6 ? s + (a / 1e6).toFixed(2) + 'M' : a >= 1e4 ? s + (a / 1e3).toFixed(1) + 'k' : M(c); };
const B = () => R.branchOf(S, UI.bid) || S.branches[0];
const T = b => R.TYPES[b.type];
const day = () => R.dayOf(S.t);
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const stars = rep => { const n = rep / 20; let h = ''; for (let i = 1; i <= 5; i++) h += i <= Math.round(n) ? '★' : '<span class="off">★</span>'; return `<span class="stars" aria-label="${n.toFixed(1)} of 5 stars">${h}</span> <span class="num small">${n.toFixed(1)}</span>`; };
const tchip = type => `<span class="tchip" style="--c:var(--${type})"><i></i>${esc(R.TYPES[type].short)}</span>`;
const meter = (v, max, cls) => `<div class="meter ${cls || ''}" role="meter" aria-valuenow="${v}" aria-valuemax="${max}"><i style="width:${Math.max(0, Math.min(100, max ? v / max * 100 : 0))}%"></i></div>`;
const ago = t => { const m = S.t - t; return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.floor(m / 60)} h ago` : `${Math.floor(m / 1440)} d ago`; };
const dur = m => m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60 ? (m % 60) + ' min' : ''}`.trim();
const icon = n => ({
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21h4"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/></svg>'
})[n];

function toast(text, level) {
  const el = document.createElement('div'); el.className = 'toast ' + (level || ''); el.textContent = text;
  $('toasts').appendChild(el); setTimeout(() => el.remove(), 3800);
  while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
}
function res(r, okMsg) { if (!r.ok) { toast(r.err, 'bad'); return false; } if (okMsg) toast(okMsg, 'good'); UI.dirty = true; return true; }

/* ---------- save / load / tab lock ---------- */
function save() {
  if (!S || UI.locked) return;
  try { const o = Object.assign({}, S); delete o.onNote; localStorage.setItem(SAVE_KEY, JSON.stringify(o)); UI.lastSave = Date.now(); UI.dirty = false; UI.saveErr = ''; }
  catch (e) { UI.saveErr = 'Autosave failed: browser storage is unavailable or full. Use Settings & save to copy a save code.'; }
}
function load() {
  try { const raw = localStorage.getItem(SAVE_KEY); if (!raw) return null; const o = JSON.parse(raw); if (o && o.v === 1 && o.branches) return o; } catch (e) {}
  return null;
}
function attach(st) { S = st; S.onNote = n => { if (n.level === 'warn' || n.level === 'good' || /arrived/.test(n.text)) toast(n.text, n.level); }; UI.bid = S.branches[0].id; }
function lockCheck() {
  try {
    const raw = localStorage.getItem(LOCK_KEY); const l = raw ? JSON.parse(raw) : null; const now = Date.now();
    if (l && l.id !== TAB && now - l.ts < 6000) { if (!UI.locked) { UI.locked = true; renderLock(); } return; }
    if (UI.locked) return; // we lost the lock earlier; wait for user to take over
    localStorage.setItem(LOCK_KEY, JSON.stringify({ id: TAB, ts: now }));
  } catch (e) {}
}
function takeOver() { try { localStorage.setItem(LOCK_KEY, JSON.stringify({ id: TAB, ts: Date.now() })); } catch (e) {} UI.locked = false; const st = load(); if (st) attach(st); $('lock') && $('lock').remove(); renderAll(); }
function renderLock() {
  if (S && S.speed) S.speed = 0;
  const d = document.createElement('div'); d.className = 'lock'; d.id = 'lock';
  d.innerHTML = `<div class="card" style="max-width:440px"><h2>This game is open in another tab</h2><p class="muted">Only one tab can run the game at a time, so the clock doesn't advance twice. This tab is paused.</p><button class="btn pri" data-a="takeover">Play in this tab instead</button></div>`;
  document.body.appendChild(d);
}

/* ---------- game loop ---------- */
let acc = 0, last = performance.now(), lastRender = 0;
function loop() {
  const now = performance.now(); const dt = Math.min(1000, now - last); last = now;
  if (S && !UI.locked && S.speed > 0 && !document.hidden) {
    const night = R.isNight(S) && !anyQueue();
    acc += dt / 1000 * S.speed * (night ? 15 : 1);
    let n = Math.floor(acc); acc -= n; n = Math.min(n, 240);
    for (let i = 0; i < n; i++) R.step(S);
    if (n) UI.dirty = true;
    renderTop();
    if (now - lastRender > 900) { lastRender = now; liveRender(); }
  }
  if (S && UI.dirty && Date.now() - UI.lastSave > 10000) save();
}
function anyQueue() { return S.branches.some(b => b.active.length); }
function liveRender() {
  const a = document.activeElement;
  if (a && $('main').contains(a) && /INPUT|SELECT|TEXTAREA/.test(a.tagName)) return;
  if (window.getSelection && String(window.getSelection()).length) return;
  renderMain(); renderNav();
  if (UI.modal && UI.modal.live) renderModal();
}

/* ---------- top bar & nav ---------- */
function renderTop() {
  if (!S) return;
  const m = S.t % R.DAY; const open = m >= R.OPEN && m < R.CLOSE;
  $('clkT').textContent = R.fmtTime(S.t);
  $('clkD').textContent = `Day ${day()} · ${R.fmtDate(day())}`;
  $('clkS').innerHTML = open ? '<span class="pill good">Open</span>' : R.isNight(S) ? '<span class="pill">Closed, night</span>' : '<span class="pill warn">Closed</span>';
  const cb = $('cash'); cb.textContent = M(S.cash); cb.classList.toggle('neg', S.cash < 0);
  for (const b of document.querySelectorAll('.speed button')) b.setAttribute('aria-pressed', String(+b.dataset.n === S.speed));
  const unread = S.notes.filter(n => !n.read).length; $('bellDot').textContent = unread; $('bellDot').style.display = unread ? '' : 'none';
  const b = B(); const q = b.queue.filter(id => b.cust[id] && b.cust[id].visit && b.cust[id].visit.phase === 'queue').length;
  $('qBtn').innerHTML = `Queue <b class="num">${q}</b>`; $('qBtn').style.borderColor = q > 3 ? 'var(--bad)' : '';
  $('skipBtn').style.display = R.isNight(S) && !anyQueue() ? '' : 'none';
}
const NAV_CO = [['hq','Headquarters'],['branches','Branches'],['expansion','Expansion'],['finance','Finances & reports'],['goals','Goals'],['admin','Settings & save']];
const NAV_BR = [['overview','Store overview'],['checkout','Checkout'],['inventory','Inventory & stockroom'],['products','Products & pricing'],['suppliers','Suppliers & ordering'],['deliveries','Deliveries & orders'],['customers','Customers'],['employees','Employees'],['equipment','Equipment & upgrades'],['marketing','Marketing']];
function renderNav() {
  if (!S) return;
  const b = B();
  const q = b.queue.filter(id => b.cust[id].visit && b.cust[id].visit.phase === 'queue').length;
  const arr = S.pos.filter(p => p.bid === b.id && p.status === 'arrived').length;
  const badge = { checkout: q, deliveries: arr };
  let h = `<div class="grp">Company</div>`;
  for (const [v, l] of NAV_CO) h += `<button class="nv" data-a="nav" data-v="${v}" ${UI.view === v ? 'aria-current="page"' : ''}>${l}</button>`;
  h += `<div class="grp">Store</div><label class="sr" for="brSel" style="position:absolute;left:-9999px">Store</label><select id="brSel" data-c="pickBranch">${S.branches.map(x => `<option value="${x.id}" ${x.id === b.id ? 'selected' : ''}>${esc(x.name)} (${R.TYPES[x.type].short})</option>`).join('')}</select>`;
  for (const [v, l] of NAV_BR) h += `<button class="nv" data-a="nav" data-v="${v}" ${UI.view === v ? 'aria-current="page"' : ''}>${l}${badge[v] ? `<span class="badge">${badge[v]}</span>` : ''}</button>`;
  $('side').innerHTML = h; $('brandName').textContent = S.company;
  $('side').classList.toggle('open', UI.nav);
  $('brandSub').textContent = isBranchView() ? `${b.name} · ${R.TYPES[b.type].label} · ${R.LOCS[b.loc].name}` : `${S.branches.length} store${S.branches.length > 1 ? 's' : ''} · ${S.mode === 'sandbox' ? 'Sandbox' : 'Career'} mode`;
}
const isBranchView = () => NAV_BR.some(x => x[0] === UI.view);

/* ---------- views ---------- */
const V = {};
function header(title, sub, right) { return `<div class="ph"><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div>${right ? `<div class="row">${right}</div>` : ''}</div>`; }
function tile(k, v, s, cls) { return `<div class="card tile"><div class="k">${k}</div><div class="v ${cls || ''}">${v}</div>${s ? `<div class="s">${s}</div>` : ''}</div>`; }

function branchToday(b) { return R.sumStats(S, day(), day(), b.id); }
function alertsFor(b) {
  const out = []; const TT = T(b);
  const q = b.queue.filter(id => b.cust[id].visit.phase === 'queue').length;
  if (q >= 3) out.push(['bad', `${q} customers waiting at checkout`, 'checkout']);
  const arr = S.pos.filter(p => p.bid === b.id && p.status === 'arrived');
  if (arr.length) out.push(['warn', `${arr.length} deliver${arr.length > 1 ? 'ies' : 'y'} waiting to be checked in`, 'deliveries']);
  let empty = 0, low = 0, exp = 0;
  for (const it of Object.values(b.items)) { if (!b.listed[it.pid]) continue; const sh = R.itShelf(it), sk = R.itStock(it); if (sh === 0) empty++; if (sh + sk + R.onOrder(S, b, it.sku) < it.min) low++; for (const x of it.batches) if (x.exp != null && x.exp <= day() && x.s + x.r) exp += x.s + x.r; }
  if (empty) out.push(['bad', `${empty} stock line${empty > 1 ? 's' : ''} with an empty shelf`, 'inventory']);
  if (low) out.push(['warn', `${low} stock line${low > 1 ? 's' : ''} below the reorder point`, 'suppliers']);
  if (exp) out.push(['warn', `${exp} units expire tonight. Lower prices or accept the loss`, 'inventory']);
  if (b.clean < 60) out.push(['warn', `Store cleanliness is ${Math.round(b.clean)}%. Customers notice`, 'overview']);
  if (S.cash < 0) out.push(['bad', 'Company cash is negative. Cut costs or sell stock quickly', 'finance']);
  return out;
}

V.hq = () => {
  const d = day(), s = R.sumStats(S, d, d), all = R.sumStats(S, 1, d);
  let inv = 0, emps = 0; for (const b of S.branches) { inv += R.invValue(b); emps += b.emps.length; }
  const rows = S.branches.map(b => ({ b, s: branchToday(b), w: R.sumStats(S, Math.max(1, d - 6), d, b.id) }));
  const ranked = [...rows].sort((a, c) => c.w.net - a.w.net);
  const repAvg = S.branches.reduce((a, b) => a + b.rep, 0) / S.branches.length;
  const pend = S.pos.filter(p => p.status === 'transit').length, arr = S.pos.filter(p => p.status === 'arrived').length;
  const alerts = []; for (const b of S.branches) for (const a of alertsFor(b)) alerts.push([a[0], `${b.name}: ${a[1]}`, a[2], b.id]);
  const afford = Object.values(R.TYPES).filter(t => S.cash >= R.openCost(t.id, 'main', 'small'));
  return header(esc(S.company) + ' headquarters', `Day ${d}. Everything across your ${S.branches.length} store${S.branches.length > 1 ? 's' : ''}, today.`, `<button class="btn" data-a="nav" data-v="finance">Full reports</button><button class="btn pri" data-a="nav" data-v="expansion">Open a new store</button>`) +
  `<div class="grid g4">${tile('Company cash', M(S.cash), S.cash < 0 ? 'Overdrawn' : 'Available to spend', S.cash < 0 ? 'negc' : '')}${tile('Revenue today', M(s.rev - s.refunds), `${s.served} customers served`)}${tile('Expenses today', M(s.cogs + s.opex + s.spoil), `Cost of goods ${K(s.cogs)} · operating ${K(s.opex)}`)}${tile('Net profit today', M(s.net), `All time ${K(all.net)}`, s.net < 0 ? 'negc' : 'pos')}
  ${tile('Stores', S.branches.length, [...new Set(S.branches.map(b => R.TYPES[b.type].short))].join(', '))}${tile('Employees', emps, 'Across all stores')}${tile('Inventory value', K(inv), 'At cost, shelves + stockrooms')}${tile('Company rating', stars(repAvg), `${S.totals.served.toLocaleString()} customers served in total`)}</div>
  <div class="mt">
   <div class="card"><h2>Store performance</h2><p class="small muted" style="margin:-4px 0 8px">Today, plus 7-day net profit. Select a store to manage it.</p><div class="tw"><table><thead><tr><th>Store</th><th>Type</th><th class="n">Revenue</th><th class="n">Expenses</th><th class="n">Net</th><th class="n">Served</th><th>Rating</th><th class="n">7-day net</th></tr></thead><tbody>${rows.map(({ b, s, w }) => `<tr class="click" data-a="go" data-b="${b.id}" data-v="overview"><td><div class="nm">${esc(b.name)}</div><div class="sb">${esc(R.LOCS[b.loc].name)}${b.status !== 'open' ? ' · <b>closed</b>' : ''}</div></td><td>${tchip(b.type)}</td><td class="n">${M(s.rev - s.refunds)}</td><td class="n">${M(s.cogs + s.opex + s.spoil)}</td><td class="n ${s.net < 0 ? 'negc' : ''}">${M(s.net)}</td><td class="n">${s.served}</td><td>${stars(b.rep)}</td><td class="n ${w.net < 0 ? 'negc' : ''}">${K(w.net)}</td></tr>`).join('')}</tbody></table></div>
   ${S.branches.length > 1 ? `<div class="row mt8 small"><span class="pill good">Best this week: ${esc(ranked[0].b.name)}</span><span class="pill warn">Lowest: ${esc(ranked[ranked.length - 1].b.name)}</span></div>` : ''}</div></div>
   <div class="grid g3 mt">
    <div class="card"><h2>Needs attention</h2>${alerts.length ? `<div class="stack" style="gap:6px">${alerts.slice(0, 8).map(a => `<div class="alert ${a[0]}"><div style="flex:1">${esc(a[1])}</div><button class="btn sm" data-a="go" data-b="${a[3]}" data-v="${a[2]}">Open</button></div>`).join('')}</div>` : '<div class="empty">Nothing urgent. Shelves stocked, queues short.</div>'}</div>
    <div class="card"><h2>Supply chain</h2><div class="li"><span>Orders on the way</span><b class="num">${pend}</b></div><div class="li"><span>Deliveries waiting to be checked in</span><b class="num">${arr}</b></div><div class="li"><span>Bills paid today (rent, wages, utilities)</span><b class="num">${M(s.rent + s.wages + s.util + s.maint)}</b></div></div>
    <div class="card"><h2>Expansion opportunities</h2>${afford.length ? `<p class="small muted" style="margin-top:0">You can afford a small store of these types right now:</p><div class="row">${afford.map(t => `<button class="btn" data-a="wizard" data-t="${t.id}">${tchip(t.id)} from ${K(R.openCost(t.id, 'heights', 'small'))}</button>`).join('')}</div>` : `<p class="small muted" style="margin:0">The cheapest new store, a small bookstore, costs about ${K(R.openCost('book', 'heights', 'small'))}. Keep growing profit.</p>`}</div>
   </div>`;
};

V.branches = () => {
  return header('Branches', 'Every store you own. Each keeps its own stock, staff, suppliers, customers and books.', `<button class="btn pri" data-a="nav" data-v="expansion">Open a new store</button>`) +
  `<div class="grid g3">${S.branches.map(b => { const s = branchToday(b), w = R.sumStats(S, Math.max(1, day() - 6), day(), b.id); const f = R.facings(b), fu = R.facingsUsed(b);
    return `<div class="card typecard" style="--c:var(--${b.type})"><div class="row" style="justify-content:space-between">${tchip(b.type)}<span class="pill ${b.status === 'open' ? 'good' : 'warn'}">${b.status === 'open' ? 'Operating' : 'Closed'}</span></div>
    <h2 class="mt8">${esc(b.name)}</h2><div class="small muted">${esc(R.LOCS[b.loc].name)} · ${R.SIZES[b.size].label} · opened day ${b.opened}</div><div class="mt8">${stars(b.rep)}</div>
    <div class="li small"><span>Revenue today</span><b class="num">${M(s.rev - s.refunds)}</b></div><div class="li small"><span>Net profit, last 7 days</span><b class="num ${w.net < 0 ? 'negc' : ''}">${M(w.net)}</b></div>
    <div class="li small"><span>Staff</span><b class="num">${b.emps.length}</b></div><div class="li small"><span>Stockroom</span><b class="num">${R.stockUsed(b)} / ${R.stockCap(b)}</b></div><div class="li small"><span>Display space used</span><b class="num">${Object.keys(f).map(k => fu[k] + '/' + f[k]).join(' · ')}</b></div>
    <div class="li small"><span>Rent per day</span><b class="num">${M(R.rentOf(b))}</b></div>
    <div class="row mt8"><button class="btn pri" data-a="go" data-b="${b.id}" data-v="overview">Manage</button><button class="btn" data-a="go" data-b="${b.id}" data-v="checkout">Checkout</button></div></div>`; }).join('')}</div>`;
};

V.expansion = () => {
  return header('Expansion', 'Open stores of any type in any district, in any order. Location changes traffic, the kind of customer and rent.') +
  `<div class="grid g2">${Object.values(R.TYPES).map(t => { const owned = S.branches.filter(b => b.type === t.id).length; const c = R.openCost(t.id, 'main', 'small');
    return `<div class="card typecard" style="--c:var(--${t.id})"><div class="row" style="justify-content:space-between">${tchip(t.id)}<span class="small muted">${owned ? `You own ${owned}` : 'Not owned yet'}</span></div><h2 class="mt8">${t.label}</h2><p class="muted" style="margin:4px 0 8px">${t.desc}</p>
    <ul class="small" style="margin:0 0 8px;padding-left:18px">${t.specials.map(x => `<li>${x}</li>`).join('')}</ul>
    <div class="li small"><span>Small store on Main Street</span><b class="num">${M(c)}</b></div><div class="li small"><span>Rent per day, small</span><b class="num">from ${M(Math.round(t.rent * 0.85))}</b></div><div class="li small"><span>Catalog</span><b>${t.catalog.length} products, ${t.cats.length} categories</b></div>
    <div class="row mt8"><button class="btn pri" data-a="wizard" data-t="${t.id}">Open a ${t.short.toLowerCase()} store</button><button class="btn" data-a="preview" data-t="${t.id}">Preview catalog & suppliers</button></div></div>`; }).join('')}</div>
    <div class="card mt"><h2>Districts</h2><div class="tw"><table><thead><tr><th>District</th><th>Character</th><th class="n">Foot traffic</th><th class="n">Rent</th><th class="n">Spending</th><th>Best fit</th></tr></thead><tbody>${Object.values(R.LOCS).map(l => { const best = Object.entries(l.aff).sort((a, b) => b[1] - a[1])[0][0]; return `<tr><td><div class="nm">${l.name}</div><div class="sb">${l.note}</div></td><td>${l.kind}</td><td class="n">×${l.traffic.toFixed(2)}</td><td class="n">×${l.rent.toFixed(2)}</td><td class="n">×${l.wealth.toFixed(2)}</td><td>${tchip(best)}</td></tr>`; }).join('')}</tbody></table></div></div>`;
};

function rangeDays() {
  const d = day();
  return { today: [d, d, 'Today'], yesterday: [d - 1, d - 1, 'Yesterday'], week: [Math.max(1, d - 6), d, 'Last 7 days'], month: [Math.max(1, d - 29), d, 'Last 30 days'], all: [1, d, 'All time'] }[UI.finRange];
}
V.finance = () => {
  const [d0, d1, lbl] = rangeDays(); const bid = UI.finB || null;
  const s = R.sumStats(S, d0, d1, bid);
  const scope = bid ? R.branchOf(S, bid).name : 'Company, consolidated';
  const rows = [['Sales', s.rev], ['Returns and refunds', -s.refunds], ['Net sales', s.rev - s.refunds, 1], ['Cost of goods sold', -s.cogs], ['Gross profit', s.gross, 1], ['Rent', -s.rent], ['Wages', -s.wages], ['Utilities', -s.util], ['Equipment upkeep', -s.maint], ['Marketing', -s.mkt], ['Delivery fees and contracts', -s.fees], ['Spoilage and waste', -s.spoil], ['Net profit', s.net, 2]];
  const cats = Object.entries(s.cats).sort((a, b) => b[1] - a[1]);
  const byB = S.branches.map(b => ({ b, s: R.sumStats(S, d0, d1, b.id) }));
  const days = []; for (let d = Math.max(1, day() - 13); d <= day(); d++) { const x = R.sumStats(S, d, d, bid); days.push({ d, rev: x.rev - x.refunds, net: x.net }); }
  const led = S.ledger.filter(l => !UI.ledB || l.b === UI.ledB).slice(-120).reverse();
  return header('Finances & reports', 'Income statements, cash flow and every transaction. Inventory purchases are cash spent; they become cost of goods when the items sell.',
    `<select data-c="finRange" aria-label="Period">${['today','yesterday','week','month','all'].map(k => `<option value="${k}" ${UI.finRange === k ? 'selected' : ''}>${{ today:'Today', yesterday:'Yesterday', week:'Last 7 days', month:'Last 30 days', all:'All time' }[k]}</option>`).join('')}</select><select data-c="finB" aria-label="Scope"><option value="">Whole company</option>${S.branches.map(b => `<option value="${b.id}" ${UI.finB === b.id ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select>`) +
  `<div class="grid g4">${tile('Net sales', M(s.rev - s.refunds), lbl)}${tile('Gross margin', (s.rev - s.refunds ? Math.round(s.gross / (s.rev - s.refunds) * 100) : 0) + '%', 'After cost of goods')}${tile('Net profit', M(s.net), scope, s.net < 0 ? 'negc' : 'pos')}${tile('Cash flow', M(s.cin - s.cout), `In ${K(s.cin)} · out ${K(s.cout)}`, s.cin - s.cout < 0 ? 'negc' : '')}</div>
  <div class="grid g2 mt">
   <div class="card"><h2>Income statement</h2><p class="small muted" style="margin:-4px 0 8px">${esc(scope)} · ${lbl}</p><div class="tw"><table><tbody>${rows.map(r => `<tr${r[2] ? ' class="sub"' : ''}><td>${r[2] === 2 ? '<b>' + r[0] + '</b>' : r[2] ? '<b>' + r[0] + '</b>' : '&nbsp;&nbsp;' + r[0]}</td><td class="n ${r[1] < 0 && r[2] ? 'negc' : ''}">${r[2] ? '<b>' + M(r[1]) + '</b>' : M(r[1])}</td></tr>`).join('')}</tbody></table></div>
    <h3 class="mt">Cash flow</h3><div class="tw"><table><tbody><tr><td>Cash from sales and supplier credits</td><td class="n">${M(s.cin)}</td></tr><tr><td>Inventory purchases (net of credits)</td><td class="n">${M(-s.purchases)}</td></tr><tr><td>Equipment, upgrades and new stores</td><td class="n">${M(-s.capex)}</td></tr><tr><td>Operating bills and refunds</td><td class="n">${M(-(s.opex + s.refunds))}</td></tr><tr class="sub"><td><b>Net change in cash</b></td><td class="n"><b>${M(s.cin - s.cout)}</b></td></tr></tbody></table></div></div>
   <div class="stack">
    <div class="card"><h2>Last 14 days</h2>${barChart(days, 'rev', 'Net sales')}${barChart(days, 'net', 'Net profit')}</div>
    <div class="card"><h2>Revenue by category</h2>${cats.length ? `<div class="tw"><table><tbody>${cats.slice(0, 12).map(([c, v]) => `<tr><td>${esc(c)}</td><td style="width:40%">${meter(v, cats[0][1])}</td><td class="n">${M(v)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No sales in this period yet.</div>'}</div>
    ${S.branches.length > 1 && !bid ? `<div class="card"><h2>Revenue by store</h2><div class="tw"><table><thead><tr><th>Store</th><th class="n">Net sales</th><th class="n">Gross</th><th class="n">Net profit</th></tr></thead><tbody>${byB.map(({ b, s }) => `<tr><td>${esc(b.name)}</td><td class="n">${M(s.rev - s.refunds)}</td><td class="n">${M(s.gross)}</td><td class="n ${s.net < 0 ? 'negc' : ''}">${M(s.net)}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
   </div></div>
  <div class="card mt"><div class="row" style="justify-content:space-between"><h2>Ledger</h2><select data-c="ledB" aria-label="Ledger store"><option value="">All entries</option>${S.branches.map(b => `<option value="${b.id}" ${UI.ledB === b.id ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select></div><p class="small muted" style="margin:0 0 8px">Every cash movement, newest first. Showing the latest ${led.length}; the save keeps the latest 2,500, and daily totals are kept forever.</p>
   <div class="tw" style="max-height:420px"><table><thead><tr><th>#</th><th>When</th><th>Store</th><th>Type</th><th>Details</th><th class="n">Amount</th><th class="n">Balance</th></tr></thead><tbody>${led.map(l => `<tr><td class="num small muted">${l.id}</td><td class="num small">D${R.dayOf(l.t)} ${R.fmtTime(l.t)}</td><td class="small">${l.b ? esc((R.branchOf(S, l.b) || { name: '(sold)' }).name) : 'HQ'}</td><td>${esc(l.kind)}</td><td class="small">${esc(l.memo)}</td><td class="n ${l.amt < 0 ? 'negc' : 'pos'}">${M(l.amt)}</td><td class="n">${M(l.bal)}</td></tr>`).join('')}</tbody></table></div></div>`;
};
function barChart(days, key, label) {
  const W = 560, H = 150, pl = 54, pb = 22, pt = 10; const vals = days.map(d => d[key]);
  const mx = Math.max(1, ...vals), mn = Math.min(0, ...vals); const span = mx - mn;
  const nice = v => { const p = Math.pow(10, Math.floor(Math.log10(Math.max(1, Math.abs(v))))); return Math.ceil(v / p) * p; };
  const top = nice(mx), bot = mn < 0 ? -nice(-mn) : 0; const y = v => pt + (top - v) / (top - bot) * (H - pt - pb);
  const bw = (W - pl - 8) / days.length;
  let g = '';
  for (const v of [bot, bot < 0 ? 0 : (top / 2), top]) g += `<line x1="${pl}" x2="${W - 4}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${pl - 6}" y="${y(v) + 4}" text-anchor="end" font-size="10" fill="var(--muted)" font-family="IBM Plex Mono">${K(v)}</text>`;
  days.forEach((d, i) => {
    const v = d[key], x = pl + i * bw + 1, h = Math.abs(y(v) - y(0)), yy = v >= 0 ? y(v) : y(0);
    const r = Math.min(4, bw / 4, h / 2);
    const path = v >= 0 ? `M${x},${y(0)}V${yy + r}q0,-${r} ${r},-${r}H${x + bw - 2 - r}q${r},0 ${r},${r}V${y(0)}Z` : `M${x},${y(0)}V${yy + h - r}q0,${r} ${r},${r}H${x + bw - 2 - r}q${r},0 ${r},-${r}V${y(0)}Z`;
    g += `<g class="bar" data-tip="Day ${d.d}: ${M(v)}"><rect x="${x - 1}" y="${pt}" width="${bw}" height="${H - pt - pb}" fill="transparent"/>${h > 0.5 ? `<path d="${path}" fill="${v < 0 ? 'var(--bad)' : 'var(--accent)'}"/>` : ''}</g>`;
    if (i % 2 === (days.length - 1) % 2) g += `<text x="${x + bw / 2 - 1}" y="${H - 6}" text-anchor="middle" font-size="10" fill="var(--muted)" font-family="IBM Plex Mono">${d.d}</text>`;
  });
  return `<div class="small muted" style="margin-top:6px">${label}, by day${key === 'net' ? ' (red = loss)' : ''}</div><div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${label} for the last ${days.length} days">${g}</svg></div>`;
}

V.goals = () => {
  const done = R.GOALS.filter(g => S.goals[g.id]).length;
  return header('Goals', `${S.mode === 'sandbox' ? 'Sandbox mode: goals are optional milestones.' : 'Career milestones on the way to a retail empire.'} ${done} of ${R.GOALS.length} reached.`) +
  `<div class="card"><div class="mt8">${meter(done, R.GOALS.length, 'good')}</div>${R.GOALS.map(g => `<div class="li"><span>${S.goals[g.id] ? '✓ ' : '○ '}${g.text}</span>${S.goals[g.id] ? `<span class="pill good">Day ${S.goals[g.id]}</span>` : '<span class="pill">Open</span>'}</div>`).join('')}</div>`;
};

V.admin = () => {
  const kb = (() => { try { return Math.round((localStorage.getItem(SAVE_KEY) || '').length / 1024); } catch (e) { return 0; } })();
  const issues = R.audit(S);
  return header('Settings & save', 'The game saves to this browser every 10 seconds and when you leave the tab. While you are away the clock stops: no customers, deliveries, wages or rent.') +
  `<div class="grid g2"><div class="card"><h2>Company</h2><label class="f">Company name<input type="text" id="coName" value="${esc(S.company)}" maxlength="40"></label><div class="row mt8"><button class="btn" data-a="renameCo">Save name</button></div><hr>
   <div class="li small"><span>Mode</span><b>${S.mode === 'sandbox' ? 'Sandbox' : 'Career'}</b></div><div class="li small"><span>Game time</span><b class="num">Day ${day()}, ${R.fmtTime(S.t)}</b></div><div class="li small"><span>Last autosave</span><b>${UI.lastSave ? new Date(UI.lastSave).toLocaleTimeString() : 'not yet'}</b></div><div class="li small"><span>Save size</span><b class="num">${kb} KB</b></div>
   <div class="li small"><span>Integrity check (stock, queues, orders)</span><b class="${issues.length ? 'negc' : 'pos'}">${issues.length ? issues.length + ' issue(s)' : 'All consistent'}</b></div>${UI.saveErr ? `<div class="alert bad mt8">${esc(UI.saveErr)}</div>` : ''}
   <div class="row mt8"><button class="btn" data-a="saveNow">Save now</button><button class="btn bad" data-a="ask" data-q="Start over? Your current company will be deleted from this browser." data-do="reset">Start a new game</button></div></div>
   <div class="card"><h2>Back up or move your save</h2><p class="small muted" style="margin-top:0">Copy the save code to keep it somewhere safe or load it in another browser.</p><div class="row"><button class="btn" data-a="copySave">Copy save code</button></div>
   <label class="f mt">Paste a save code to load it<textarea id="importBox" rows="5" placeholder="Paste a save code here"></textarea></label><div class="row mt8"><button class="btn" data-a="importSave">Load this save</button></div></div></div>`;
};

/* ---- branch views ---- */
V.overview = () => {
  const b = B(), TT = T(b), s = branchToday(b), w = R.sumStats(S, Math.max(1, day() - 6), day(), b.id);
  const f = R.facings(b), fu = R.facingsUsed(b);
  const inStore = b.active.length, q = b.queue.length;
  const sat = s.satN ? Math.round(s.satSum / s.satN) : null;
  const rate = R.arrivalRate(S, b);
  const al = alertsFor(b);
  return header(esc(b.name), `${TT.label} · ${R.LOCS[b.loc].name} · ${R.SIZES[b.size].label}. ${TT.desc}`, `<button class="btn" data-a="ask" data-q="${b.status === 'open' ? 'Close this store temporarily? Customers inside will leave, and staff stop working. Rent is still charged.' : 'Reopen this store?'}" data-do="toggleStatus">${b.status === 'open' ? 'Close temporarily' : 'Reopen store'}</button><button class="btn" data-a="renameB">Rename</button>${S.branches.length > 1 ? `<button class="btn bad" data-a="ask" data-q="Sell ${esc(b.name)} for about ${M(R.sellValue(S, b))}? Orders on the way are cancelled. This cannot be undone." data-do="sellB">Sell store</button>` : ''}`) +
  `<div class="grid g4">${tile('Revenue today', M(s.rev - s.refunds), `${s.served} sales · ${s.lost} left without buying`)}${tile('Net profit today', M(s.net), `7 days: ${K(w.net)}`, s.net < 0 ? 'negc' : 'pos')}${tile('In store now', inStore, `${q} at checkout · ~${rate.toFixed(0)} arrivals/hour`)}${tile('Rating', stars(b.rep), sat != null ? `Today's visits: ${sat}/100 satisfied` : 'No visits yet today')}</div>
  <div class="grid g2 mt"><div class="stack">
   <div class="card"><h2>Needs attention</h2>${al.length ? `<div class="stack" style="gap:6px">${al.map(a => `<div class="alert ${a[0]}"><div style="flex:1">${esc(a[1])}</div><button class="btn sm" data-a="nav" data-v="${a[2]}">Open</button></div>`).join('')}</div>` : '<div class="empty">All good here.</div>'}</div>
   <div class="card"><h2>Store condition</h2><div class="li"><span>Cleanliness</span><span class="row" style="flex:1;justify-content:flex-end">${meter(b.clean, 100, b.clean < 60 ? 'bad' : b.clean < 75 ? 'warn' : 'good')}<b class="num">${Math.round(b.clean)}%</b><button class="btn sm" data-a="tidy">Tidy up</button></span></div>
    ${Object.keys(f).map(k => `<div class="li"><span>${TT.facings[k]}</span><span class="row">${meter(fu[k], f[k])}<b class="num">${fu[k]} / ${f[k]}</b></span></div>`).join('')}
    <div class="li"><span>Stockroom</span><span class="row">${meter(R.stockUsed(b), R.stockCap(b), R.stockUsed(b) / R.stockCap(b) > 0.9 ? 'warn' : '')}<b class="num">${R.stockUsed(b)} / ${R.stockCap(b)}</b></span></div>
    <div class="li"><span>Checkout registers</span><b class="num">${b.equip.register}</b></div><div class="li"><span>Daily rent + utilities</span><b class="num">${M(R.rentOf(b) + R.utilOf(b) + R.maintOf(b))}</b></div></div>
  </div><div class="stack">${specialPanel(b)}
   <div class="card"><h2>Recent activity</h2>${S.notes.filter(n => n.b === b.id).slice(0, 6).map(n => `<div class="li small"><span>${esc(n.text)}</span><span class="muted num" style="white-space:nowrap">${R.fmtTime(n.t)}</span></div>`).join('') || '<div class="empty">Nothing yet.</div>'}</div>
  </div></div>`;
};
function specialPanel(b) {
  const TT = T(b), d = day();
  if (b.type === 'grocery') {
    const exp = []; for (const it of Object.values(b.items)) for (const x of it.batches) if (x.exp != null && x.exp <= d + 1 && x.s + x.r) exp.push({ it, x });
    exp.sort((a, c) => a.x.exp - c.x.exp);
    const locked = TT.upgrades.filter(u => !b.upg.includes(u.id));
    return `<div class="card"><h2>Fresh food</h2><p class="small muted" style="margin-top:0">Expired stock is thrown out at midnight and counted as spoilage.</p>${exp.length ? exp.slice(0, 7).map(({ it, x }) => `<div class="li small"><span>${esc(R.itemName(b, it))}</span><span class="row"><span class="num">${x.s + x.r} units</span><span class="pill ${x.exp <= d ? 'bad' : 'warn'}">${x.exp <= d ? 'Expires tonight' : 'Expires tomorrow'}</span></span></div>`).join('') : '<div class="empty">Nothing expires in the next two days.</div>'}
    <h3 class="mt">Departments</h3><div class="row">${b.depts.map(x => `<span class="pill good">${esc(x)}</span>`).join('')}${locked.map(u => `<span class="pill">${esc(u.name)}: locked</span>`).join('')}</div></div>`;
  }
  if (b.type === 'clothing') {
    const gaps = []; for (const pid of Object.keys(b.listed)) { const p = TT.pmap[pid]; const its = Object.values(b.items).filter(i => i.pid === pid); const out = its.filter(i => R.itShelf(i) === 0); if (out.length) gaps.push(`${p.name}: ${out.map(i => i.label).slice(0, 4).join(', ')}${out.length > 4 ? ` +${out.length - 4}` : ''}`); }
    const fitWait = b.active.filter(id => b.cust[id].visit && b.cust[id].visit.phase === 'fitwait').length;
    return `<div class="card"><h2>Fitting rooms & sizes</h2><div class="li"><span>Fitting rooms in use</span><span class="row">${meter(b.fitBusy, b.equip.fitting)}<b class="num">${b.fitBusy} / ${b.equip.fitting}</b></span></div><div class="li"><span>Waiting to try on</span><b class="num ${fitWait > 1 ? 'negc' : ''}">${fitWait}</b></div><div class="li"><span>Returns expected in the next days</span><b class="num">${b.returnsDue.length}</b></div>
    <h3 class="mt">Missing sizes on the floor</h3>${gaps.length ? gaps.slice(0, 6).map(g => `<div class="small li">${esc(g)}</div>`).join('') : '<div class="empty">Every size and color on display is in stock.</div>'}</div>`;
  }
  if (b.type === 'toy') {
    const hot = S.market.hot && S.market.hotUntil > S.t ? TT.pmap[S.market.hot] : null; const sm = R.seasonMult('toy', d);
    return `<div class="card"><h2>Trends & holidays</h2><div class="li"><span>Hot toy right now</span><b>${hot ? esc(hot.name) + (b.listed[hot.id] ? '' : ' <span class="pill warn">Not on your shelves</span>') : 'Nothing trending'}</b></div><div class="li"><span>Seasonal demand today</span><b class="num">×${sm.toFixed(2)}</b></div><div class="li"><span>Gift wrapping</span><b>${b.equip.giftwrap ? 'Offered at $3 per item' : 'Buy a gift wrap station'}</b></div><div class="li"><span>Collector cases</span><b class="num">${b.equip.case}</b></div>
    <p class="small muted">December demand climbs toward Christmas Eve, then falls away. Stock up early: deliveries take ${R.SUPPLIERS.playmakers.lead / 60} hours.</p></div>`;
  }
  const up = TT.catalog.filter(p => p.release > 0).map(p => ({ p, n: b.preorders.filter(x => x.pid === p.id).length }));
  const best = Object.values(b.items).filter(i => i.soldAll).sort((a, c) => c.soldAll - a.soldAll).slice(0, 5);
  return `<div class="card"><h2>Releases & bestsellers</h2>${up.map(({ p, n }) => `<div class="li small"><span><b>${esc(p.name)}</b><br><span class="muted">${esc(p.author)} · release day ${p.release}</span></span><span>${p.release > d ? `<span class="pill info">${n} preorder${n === 1 ? '' : 's'}</span>` : d - p.release <= 7 ? '<span class="pill good">New this week</span>' : '<span class="pill">Released</span>'}</span></div>`).join('')}
  <h3 class="mt">Bestsellers here</h3>${best.length ? best.map((i, k) => `<div class="li small"><span>${k + 1}. ${esc(R.itemName(b, i))}</span><b class="num">${i.soldAll} sold</b></div>`).join('') : '<div class="empty">No sales yet.</div>'}</div>`;
}

V.checkout = () => {
  const b = B();
  const regs = b.equip.register, cashiers = b.emps.filter(e => e.role === 'cashier');
  const q = b.queue.map(id => b.cust[id]).filter(c => c && c.visit);
  const waiting = q.filter(c => c.visit.phase === 'queue');
  const browsing = b.active.map(id => b.cust[id]).filter(c => c.visit && (c.visit.phase === 'browsing' || c.visit.phase === 'fitting' || c.visit.phase === 'fitwait'));
  return header('Checkout', `Serve customers yourself, or hire cashiers to run the ${regs} register${regs > 1 ? 's' : ''} for you. Customers leave if they wait longer than their patience.`, `<button class="btn pri big" data-a="serveNext" ${waiting.length ? '' : 'disabled'}>Serve next customer</button>`) +
  `<div class="grid g2"><div class="card"><h2>Queue <span class="num muted">(${q.length})</span></h2>${q.length ? `<div class="stack" style="gap:8px">${q.map(c => { const v = c.visit, w = S.t - (v.queueSince || S.t); const tot = v.kind === 'return' ? null : R.basketTotal(S, b, v, true); const busy = v.phase === 'register'; const by = busy ? (v.by === 'you' ? 'You are serving' : 'Cashier ' + ((b.emps.find(e => e.id === v.by) || {}).name || '')) : '';
     return `<div class="qcard ${busy ? 'busy' : ''}"><div><b>${esc(c.name)}</b> <span class="small muted">${esc(R.typeLabel(b, c))}</span><div class="small">${v.kind === 'return' ? '<span class="pill warn">Return</span> ' + esc(R.itemName(b, b.items[v.data.ret.sku])) : `${tot.items} item${tot.items > 1 ? 's' : ''} · <span class="num">${M(tot.sub)}</span> · ${c.pay === 'card' ? 'Card' : 'Cash'}${tot.gifts && b.equip.giftwrap ? ' · wants gift wrap' : ''}`}</div>${busy ? `<div class="small muted">${esc(by)}</div>` : `<div class="row small" style="gap:6px;margin-top:3px">${meter(w, c.patience, w / c.patience > 0.7 ? 'bad' : w / c.patience > 0.4 ? 'warn' : 'good')}<span class="num muted">${w} min</span></div>`}</div>${busy ? '' : `<button class="btn ${v.kind === 'return' ? '' : 'pri'}" data-a="serve" data-c="${c.id}">${v.kind === 'return' ? 'Handle return' : 'Serve'}</button>`}</div>`; }).join('')}</div>` : '<div class="empty">No one is waiting.</div>'}</div>
  <div class="stack"><div class="card"><h2>Registers</h2>${Array.from({ length: regs }, (_, i) => { const e = cashiers.filter(x => x.on)[i]; const c = e && e.task && e.task.cid ? b.cust[e.task.cid] : null; return `<div class="li"><span>Register ${i + 1}</span><span class="small">${e ? `${esc(e.name)}: ${c ? 'serving ' + esc(c.name) : 'waiting for customers'}` : (i === 0 ? 'You (manual checkout)' : '<span class="muted">No cashier</span>')}</span></div>`; }).join('')}
   ${cashiers.length > regs ? `<div class="alert warn mt8">You have ${cashiers.length} cashiers but ${regs} registers. Buy another register in Equipment.</div>` : ''}${!cashiers.length ? `<div class="row mt8"><button class="btn" data-a="nav" data-v="employees">Hire a cashier</button></div>` : ''}</div>
   <div class="card"><h2>Shopping now <span class="num muted">(${browsing.length})</span></h2>${browsing.length ? browsing.slice(0, 12).map(c => `<div class="li small"><span>${esc(c.name)} <span class="muted">${esc(R.typeLabel(b, c))}</span></span><span class="pill">${{ browsing: 'Browsing', fitting: 'In fitting room', fitwait: 'Waiting for a fitting room' }[c.visit.phase]}</span></div>`).join('') : '<div class="empty">The aisles are quiet.</div>'}</div></div></div>`;
};

function invRows(b) {
  const TT = T(b); const q = UI.invQ.toLowerCase();
  let items = Object.values(b.items).filter(it => { const p = TT.pmap[it.pid]; return (UI.invCat ? p.cat === UI.invCat : true) && (!q || (p.name + ' ' + it.label + ' ' + (p.author || '')).toLowerCase().includes(q)); });
  const tab = UI.invTab;
  if (tab === 'all') items = items.filter(it => b.listed[it.pid] || R.itStock(it) > 0);
  if (tab === 'empty') items = items.filter(it => b.listed[it.pid] && R.itShelf(it) === 0);
  if (tab === 'low') items = items.filter(it => b.listed[it.pid] && R.itShelf(it) + R.itStock(it) + R.onOrder(S, b, it.sku) < it.min);
  if (tab === 'stockroom') items = items.filter(it => R.itStock(it) > 0);
  if (tab === 'expiring') items = items.filter(it => it.batches.some(x => x.exp != null && x.exp <= day() + 1 && x.s + x.r));
  return items;
}
V.inventory = () => {
  const b = B(), TT = T(b);
  const items = invRows(b);
  const tabs = [['all', 'On display'], ['empty', 'Empty shelves'], ['low', 'Below reorder point'], ['stockroom', 'In stockroom']]; if (b.type === 'grocery') tabs.push(['expiring', 'Expiring']);
  return header('Inventory & stockroom', `Shelf quantities are what customers can buy. Stock sits in the stockroom until you or a stocker moves it out. Stockroom: ${R.stockUsed(b)} of ${R.stockCap(b)} units.`, `<button class="btn pri" data-a="fillAll">Restock all shelves</button>`) +
  `<div class="row" style="margin-bottom:10px"><div class="seg" role="group" aria-label="Filter">${tabs.map(([k, l]) => `<button data-a="invTab" data-k="${k}" aria-pressed="${UI.invTab === k}">${l}</button>`).join('')}</div><input type="text" id="invQ" data-c="invQ" placeholder="Search products" value="${esc(UI.invQ)}" aria-label="Search products"><select data-c="invCat" aria-label="Category"><option value="">All categories</option>${TT.cats.map(c => `<option ${UI.invCat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
  <div class="tw"><table><thead><tr><th>Product</th><th class="n">Shelf</th><th class="n">Stockroom</th><th class="n">On order</th><th class="n">Cost</th><th class="n">Price</th><th class="n">Margin</th><th class="n">Sold today</th><th class="n">Missed</th><th class="n">Reorder at</th><th class="n">Reorder qty</th><th></th></tr></thead><tbody>${items.slice(0, 300).map(it => { const p = TT.pmap[it.pid]; const sh = R.itShelf(it), sk = R.itStock(it), mx = R.shelfMaxOf(b, p), cost = R.avgCost(b, it), pr = R.effPrice(S, b, it); const mg = pr ? Math.round((pr - cost) / pr * 100) : 0; const ex = it.batches.filter(x => x.exp != null && x.s + x.r).map(x => x.exp)[0];
    return `<tr><td><div class="nm">${esc(p.name)}</div><div class="sb">${esc(it.label || p.cat)}${!b.listed[it.pid] ? ' · <b>not on display</b>' : ''}${ex != null ? ` · use by day ${ex}` : ''}</div></td><td class="n ${b.listed[it.pid] && sh === 0 ? 'negc' : ''}">${sh}/${mx}</td><td class="n">${sk}</td><td class="n">${R.onOrder(S, b, it.sku) || ''}</td><td class="n">${M(cost)}</td><td class="n">${M(pr)}</td><td class="n ${mg < 15 ? 'negc' : ''}">${mg}%</td><td class="n">${it.soldT}</td><td class="n ${it.missT ? 'negc' : ''}">${it.missT || ''}</td>
    <td class="n"><input class="qty" type="number" min="0" max="999" value="${it.min}" data-c="setMin" data-s="${esc(it.sku)}" aria-label="Reorder point"></td><td class="n"><input class="qty" type="number" min="1" max="999" value="${it.reorder}" data-c="setRe" data-s="${esc(it.sku)}" aria-label="Reorder quantity"></td>
    <td><button class="btn sm" data-a="fill" data-s="${esc(it.sku)}" ${sk && b.listed[it.pid] && sh < mx ? '' : 'disabled'}>Fill shelf</button></td></tr>`; }).join('') || `<tr><td colspan="12"><div class="empty">Nothing matches.</div></td></tr>`}</tbody></table></div>
  ${items.length > 300 ? `<p class="small muted">Showing 300 of ${items.length}. Narrow the search.</p>` : ''}<p class="small muted">"Missed" counts customers who wanted the item today and found the shelf empty. "Reorder at" and "Reorder qty" drive suggested orders and the store manager.</p>`;
};

V.products = () => {
  const b = B(), TT = T(b); const f = R.facings(b), fu = R.facingsUsed(b);
  const prods = TT.catalog.filter(p => !UI.prodCat || p.cat === UI.prodCat);
  const info = p => b.type === 'grocery' ? `${p.cold ? (p.cold === 'fridge' ? 'Refrigerated' : 'Frozen') + ' · ' : ''}${p.life ? `keeps ${p.life} days` : 'Shelf-stable'}` :
    b.type === 'clothing' ? `${esc(p.brand)} · ${p.sizes.join('/')} · ${p.colors.join(', ')}${p.season !== 'all' ? ` · ${p.season} collection` : ''}` :
    b.type === 'toy' ? `${esc(p.brand)} · ages ${p.age[0]}${p.age[1] >= 99 ? '+' : '–' + p.age[1]} · popularity ${p.pop}${S.market.hot === p.id && S.market.hotUntil > S.t ? ' · <b>trending</b>' : ''}${p.col ? ' · collectible' : ''}` :
    `${esc(p.author)} · ${esc(p.pub)} · ISBN ${p.isbn}${p.release > day() ? ` · <b>releases day ${p.release}</b>` : ''}`;
  return header('Products & pricing', `Choose what goes on display and set prices. Display space: ${Object.keys(f).map(k => `${TT.facings[k].toLowerCase()} ${fu[k]}/${f[k]}`).join(', ')}.`,
    `<select data-c="prodCat" aria-label="Category"><option value="">All categories</option>${TT.cats.map(c => `<option ${UI.prodCat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>`) +
  `<div class="tw"><table><thead><tr><th>Product</th><th>Category</th><th class="n">Supplier cost</th><th class="n">Suggested price</th><th>Your price</th>${b.type === 'clothing' ? '<th>Markdown</th>' : ''}<th class="n">Sold, all time</th><th>On display</th></tr></thead><tbody>${prods.map(p => {
    const its = Object.values(b.items).filter(i => i.pid === p.id); const open = b.depts.includes(p.cat); const listed = !!b.listed[p.id]; const sold = its.reduce((a, i) => a + i.soldAll, 0);
    const priceCell = b.type === 'book' ? its.map(i => `<div class="row" style="gap:4px;margin:2px 0"><span class="small muted" style="width:62px">${i.label}</span><input class="price" type="number" step="0.01" min="0.01" value="${(i.price / 100).toFixed(2)}" data-c="price" data-s="${esc(i.sku)}" aria-label="Price ${esc(i.label)}"></div>`).join('') : `<input class="price" type="number" step="0.01" min="0.01" value="${(its[0].price / 100).toFixed(2)}" data-c="price" data-p="${p.id}" aria-label="Price">`;
    const costs = b.type === 'book' ? its.map(i => M(R.costOf(b, i))).join('<br>') : M(p.cost); const refs = b.type === 'book' ? its.map(i => M(R.refPrice(b, i))).join('<br>') : M(p.price);
    return `<tr><td><div class="nm">${esc(p.name)}</div><div class="sb">${info(p)}</div></td><td>${esc(p.cat)}${open ? '' : ' <span class="pill">Locked</span>'}</td><td class="n">${costs}</td><td class="n">${refs}</td><td>${priceCell}</td>${b.type === 'clothing' ? `<td><select data-c="md" data-p="${p.id}" aria-label="Markdown">${[0, 20, 40, 60].map(x => `<option value="${x}" ${(b.markdown[p.id] || 0) === x ? 'selected' : ''}>${x ? x + '% off' : 'None'}</option>`).join('')}</select></td>` : ''}<td class="n">${sold}</td>
    <td>${open ? `<button class="btn sm ${listed ? '' : 'pri'}" data-a="list" data-p="${p.id}" data-on="${listed ? 0 : 1}">${listed ? 'Remove' : 'Put on display'}</button>` : '<span class="small muted">Unlock in Equipment</span>'}</td></tr>`; }).join('')}</tbody></table></div>
  <p class="small muted">Customers compare your price with the suggested price. Budget shoppers walk away from small markups; premium and gift shoppers tolerate more. Removing a product sends its shelf stock back to the stockroom.</p>`;
};

V.suppliers = () => {
  const b = B(), TT = T(b);
  return header('Suppliers & ordering', 'Compare suppliers and place purchase orders. You pay when you order; shortages and damaged units are credited back when you check in the delivery.') +
  `<div class="grid g2">${TT.suppliers.map(id => { const s = R.SUPPLIERS[id]; const signed = b.sups.includes(id); const sug = signed ? R.reorderSuggestion(S, b, id) : [];
    return `<div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">${esc(s.name)}</h2>${signed ? '<span class="pill good">Contract signed</span>' : `<span class="pill">Contract ${M(s.contract)}</span>`}</div><p class="small muted" style="margin:4px 0 8px">${esc(s.kind)}${s.cats ? ': ' + s.cats.join(', ') : s.pubs ? ': ' + s.pubs.join(', ') : ''}</p>
    <div class="li small"><span>Prices vs. list</span><b class="num">${Math.round(s.priceIdx * 100)}%${signed && R.supDiscount(b, id) ? ` −${R.supDiscount(b, id) * 100}% loyalty` : ''}</b></div><div class="li small"><span>Delivery time</span><b class="num">about ${dur(s.lead)}</b></div><div class="li small"><span>Delivery fee</span><b class="num">${M(s.fee)}</b></div><div class="li small"><span>Minimum order</span><b class="num">${M(s.minOrder)}</b></div><div class="li small"><span>Reliability</span><span class="row">${meter(s.rel * 100, 100, s.rel < 0.88 ? 'warn' : 'good')}<b class="num">${Math.round(s.rel * 100)}%</b></span></div><div class="li small"><span>Relationship</span><span class="row">${meter(b.supRel[id] || 0, 100)}<b class="num">${b.supRel[id] || 0}</b></span></div>
    <div class="row mt8">${signed ? `<button class="btn pri" data-a="order" data-s="${id}">Create order</button>${sug.length ? `<span class="small muted">${sug.length} line${sug.length > 1 ? 's' : ''} need reordering</span>` : ''}` : `<button class="btn" data-a="sign" data-s="${id}">Sign contract for ${M(s.contract)}</button>`}</div></div>`; }).join('')}</div>
  <p class="small muted mt">Reliability is the chance a delivery arrives complete. Relationship grows with each accepted delivery and earns up to 5% off.</p>`;
};

V.deliveries = () => {
  const b = B(); const mine = S.pos.filter(p => p.bid === b.id);
  const arr = mine.filter(p => p.status === 'arrived'), tr = mine.filter(p => p.status === 'transit'), done = mine.filter(p => p.status !== 'arrived' && p.status !== 'transit').slice(0, 40);
  const sup = id => R.SUPPLIERS[id].name; const units = p => p.lines.reduce((a, l) => a + l.qty, 0);
  return header('Deliveries & orders', 'Arrived deliveries wait at the back door until someone checks them in. Nothing goes into stock before that.', `<button class="btn" data-a="nav" data-v="suppliers">New order</button>`) +
  `<div class="card"><h2>Waiting to be checked in <span class="num muted">(${arr.length})</span></h2>${arr.length ? arr.map(p => { const short = p.lines.some(l => l.delivered < l.qty || l.dmg); return `<div class="li"><span><b>${p.id}</b> · ${esc(sup(p.sup))}<br><span class="small muted">${units(p)} units ordered · arrived ${ago(p.arrivedAt)}</span></span><span class="row">${short ? '<span class="pill warn">Discrepancies</span>' : '<span class="pill good">Looks complete</span>'}<button class="btn pri" data-a="review" data-p="${p.id}">Review</button></span></div>`; }).join('') : '<div class="empty">Nothing at the back door.</div>'}</div>
  <div class="card mt"><h2>On the way <span class="num muted">(${tr.length})</span></h2>${tr.length ? `<div class="tw"><table><thead><tr><th>Order</th><th>Supplier</th><th class="n">Units</th><th class="n">Paid</th><th>Expected</th><th></th></tr></thead><tbody>${tr.map(p => `<tr><td class="num">${p.id}${p.by === 'manager' ? ' <span class="pill">manager</span>' : ''}</td><td>${esc(sup(p.sup))}</td><td class="n">${units(p)}</td><td class="n">${M(p.total)}</td><td class="num small">Day ${R.dayOf(p.eta)} ${R.fmtTime(p.eta)} · in ${dur(Math.max(0, p.eta - S.t))}</td><td><button class="btn sm" data-a="poView" data-p="${p.id}">Details</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No open orders.</div>'}</div>
  <div class="card mt"><h2>History</h2>${done.length ? `<div class="tw"><table><thead><tr><th>Order</th><th>Supplier</th><th>Status</th><th class="n">Paid</th><th class="n">Credited</th><th>Closed</th><th></th></tr></thead><tbody>${done.map(p => `<tr><td class="num">${p.id}</td><td>${esc(sup(p.sup))}</td><td><span class="pill ${p.status === 'closed' ? 'good' : 'warn'}">${{ closed: 'Received', refused: 'Refused', cancelled: 'Cancelled' }[p.status]}</span>${p.acceptedBy && p.acceptedBy !== 'you' ? ` <span class="small muted">by ${esc(p.acceptedBy)}</span>` : ''}</td><td class="n">${M(p.total)}</td><td class="n">${p.credit ? M(p.credit) : ''}</td><td class="num small">${p.closedAt ? 'Day ' + R.dayOf(p.closedAt) + ' ' + R.fmtTime(p.closedAt) : ''}</td><td><button class="btn sm" data-a="poView" data-p="${p.id}">Details</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No completed orders yet.</div>'}</div>`;
};

V.customers = () => {
  const b = B(); const q = UI.custQ.toLowerCase();
  let list = Object.values(b.cust).filter(c => !q || c.name.toLowerCase().includes(q));
  if (UI.custF === 'here') list = list.filter(c => c.visit); else if (UI.custF === 'loyal') list = list.filter(c => c.loyalty >= 60); else if (UI.custF === 'unhappy') list = list.filter(c => c.sat < 45 && c.visits);
  list.sort((a, c) => (c.visit ? 1 : 0) - (a.visit ? 1 : 0) || c.spent - a.spent);
  const st = c => !c.visit ? '' : `<span class="pill info">${{ browsing: 'Shopping', fitting: 'Fitting room', fitwait: 'Waiting to try on', queue: 'In queue', register: 'At register' }[c.visit.phase]}</span>`;
  return header('Customers', `${Object.keys(b.cust).length} people shop at ${esc(b.name)}. Each has a budget, tastes, patience and a memory of how you treated them.`) +
  `<div class="row" style="margin-bottom:10px"><div class="seg" role="group" aria-label="Filter">${[['all', 'Everyone'], ['here', 'In store now'], ['loyal', 'Loyal'], ['unhappy', 'Unhappy']].map(([k, l]) => `<button data-a="custF" data-k="${k}" aria-pressed="${UI.custF === k}">${l}</button>`).join('')}</div><input type="text" data-c="custQ" placeholder="Search by name" value="${esc(UI.custQ)}" aria-label="Search customers"></div>
  <div class="tw"><table><thead><tr><th>Customer</th><th>Type</th><th>Likes</th><th class="n">Visits</th><th class="n">Spent</th><th>Satisfaction</th><th>Loyalty</th><th>Now</th></tr></thead><tbody>${list.slice(0, 150).map(c => `<tr class="click" data-a="cust" data-c="${c.id}"><td><div class="nm">${esc(c.name)}</div><div class="sb num">${c.id.toUpperCase()}</div></td><td class="small">${esc(R.typeLabel(b, c))}</td><td class="small">${esc((c.prefs || []).join(', '))}${c.size ? ' · size ' + c.size : ''}${c.childAge != null && c.childAge < 20 ? ' · child age ' + c.childAge : ''}</td><td class="n">${c.visits}</td><td class="n">${M(c.spent)}</td><td><div class="row" style="gap:6px">${meter(c.sat, 100, c.sat < 45 ? 'bad' : c.sat < 65 ? 'warn' : 'good')}<span class="num small">${c.sat}</span></div></td><td><div class="row" style="gap:6px">${meter(c.loyalty, 100)}<span class="num small">${Math.round(c.loyalty)}</span></div></td><td>${st(c)}</td></tr>`).join('') || '<tr><td colspan="8"><div class="empty">No customers match.</div></td></tr>'}</tbody></table></div>`;
};

V.employees = () => {
  const b = B();
  const wageDay = b.emps.reduce((a, e) => a + e.wage * 13, 0);
  return header('Employees', `Staff work store hours (08:00 to 21:00) and are paid hourly. Wages here: about ${M(wageDay)} per day.`) +
  `<div class="card"><h2>Your team <span class="num muted">(${b.emps.length})</span></h2>${b.emps.length ? `<div class="tw"><table><thead><tr><th>Name</th><th>Role</th><th class="n">Wage</th><th>Efficiency</th><th class="n">Reliability</th><th class="n">Days worked</th><th>Doing now</th><th></th></tr></thead><tbody>${b.emps.map(e => `<tr><td><div class="nm">${esc(e.name)}</div><div class="sb num">${e.id.toUpperCase()} · hired day ${e.hired}</div></td><td>${R.ROLES[e.role].label}</td><td class="n">${M(e.wage)}/h</td><td><div class="row" style="gap:6px">${meter(e.eff, 1.5)}<span class="num small">${Math.round(e.eff * 100)}%</span></div></td><td class="n">${Math.round(e.rel * 100)}%</td><td class="n">${e.days}</td><td class="small">${e.on ? esc(e.task ? (e.task.label || e.task.idle || (e.task.cid ? 'Serving ' + ((b.cust[e.task.cid] || {}).name || 'a customer') : '')) : 'Ready') : '<span class="pill warn">Off sick today</span>'}</td><td><button class="btn sm bad" data-a="ask" data-q="Let ${esc(e.name)} go?" data-do="fire" data-e="${e.id}">Let go</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No staff yet. You run everything yourself.</div>'}</div>
  <div class="card mt"><h2>Applicants</h2><p class="small muted" style="margin-top:0">New applicants every morning. Efficiency improves with each day worked.</p><div class="tw"><table><thead><tr><th>Name</th><th>Role</th><th>What they do</th><th class="n">Wage</th><th class="n">Efficiency</th><th class="n">Reliability</th><th></th></tr></thead><tbody>${b.apps.map(a => `<tr><td><div class="nm">${esc(a.name)}</div><div class="sb">${a.exp} year${a.exp === 1 ? '' : 's'} experience</div></td><td>${R.ROLES[a.role].label}</td><td class="small">${R.ROLES[a.role].desc}</td><td class="n">${M(a.wage)}/h</td><td class="n">${Math.round(a.eff * 100)}%</td><td class="n">${Math.round(a.rel * 100)}%</td><td><button class="btn sm pri" data-a="hire" data-e="${a.id}">Hire</button></td></tr>`).join('') || '<tr><td colspan="7"><div class="empty">No applicants left today.</div></td></tr>'}</tbody></table></div></div>`;
};

V.equipment = () => {
  const b = B(), TT = T(b);
  return header('Equipment & upgrades', 'More display space means more products on sale. Equipment adds daily upkeep and power costs.') +
  `<div class="grid g3">${TT.equip.map(e => { const n = b.equip[e.id] || 0; return `<div class="card"><div class="row" style="justify-content:space-between"><h3 style="margin:0">${esc(e.name)}</h3><span class="pill">Owned ${n}${e.max < 20 ? ' / ' + e.max : ''}</span></div><p class="small muted">${esc(e.desc)}</p><div class="row"><button class="btn pri" data-a="buyEq" data-e="${e.id}" ${n >= e.max ? 'disabled' : ''}>${n >= e.max ? 'Maximum reached' : 'Buy for ' + M(e.cost)}</button></div></div>`; }).join('')}</div>
  ${TT.upgrades.length ? `<h2 class="mt">Departments</h2><div class="grid g3 mt8">${TT.upgrades.map(u => { const has = b.upg.includes(u.id), need = u.need(b); return `<div class="card"><div class="row" style="justify-content:space-between"><h3 style="margin:0">${esc(u.name)}</h3>${has ? '<span class="pill good">Open</span>' : ''}</div><p class="small muted">${esc(u.desc)}</p>${has ? '' : `<div class="row"><button class="btn pri" data-a="buyUp" data-u="${u.id}" ${need ? 'disabled' : ''}>Open for ${M(u.cost)}</button>${need ? `<span class="small muted">${need}</span>` : ''}</div>`}</div>`; }).join('')}</div>` : ''}`;
};

V.marketing = () => {
  const b = B(); const camps = R.CAMPAIGNS.filter(c => !c.type || c.type === b.type);
  const running = b.camps.filter(c => c.until > S.t);
  return header('Marketing', `Campaigns bring more customers in. Traffic right now: about ${R.arrivalRate(S, b).toFixed(0)} customers per hour, and the season is ×${R.seasonMult(b.type, day()).toFixed(2)}.`) +
  `${running.length || S.brandUntil > S.t ? `<div class="card"><h2>Running now</h2>${running.map(c => `<div class="li"><span>${esc(c.name)}</span><span class="pill good">${dur(c.until - S.t)} left</span></div>`).join('')}${S.brandUntil > S.t ? `<div class="li"><span>Company brand campaign</span><span class="pill good">${dur(S.brandUntil - S.t)} left</span></div>` : ''}</div>` : ''}
  <div class="grid g3 mt">${camps.map(c => { const on = b.camps.some(x => x.id === c.id && x.until > S.t); return `<div class="card"><h3>${esc(c.name)}</h3><p class="small muted">${esc(c.desc)}</p><button class="btn pri" data-a="camp" data-c="${c.id}" ${on ? 'disabled' : ''}>${on ? 'Running' : 'Run for ' + M(c.cost)}</button></div>`; }).join('')}
  <div class="card"><h3>Loyalty program</h3><p class="small muted">Permanent. Customers become loyal faster and visit more often (+8% traffic).</p><button class="btn pri" data-a="camp" data-c="loyalty" ${b.loyalty ? 'disabled' : ''}>${b.loyalty ? 'Active' : 'Launch for ' + M(R.LOYALTY_COST)}</button></div>
  <div class="card"><h3>${esc(R.BRAND_CAMPAIGN.name)}</h3><p class="small muted">${esc(R.BRAND_CAMPAIGN.desc)} Paid by headquarters.</p><button class="btn pri" data-a="camp" data-c="brand" ${S.brandUntil > S.t ? 'disabled' : ''}>${S.brandUntil > S.t ? 'Running' : 'Run for ' + M(R.BRAND_CAMPAIGN.cost)}</button></div></div>`;
};

/* ---------- modals ---------- */
function dlg(title, sub, body, foot, cls) { return `<div class="dlg ${cls || ''}" role="dialog" aria-modal="true" aria-labelledby="dlgT"><header><div><h2 id="dlgT">${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div><button class="iconbtn" data-a="close" aria-label="Close">✕</button></header><div class="bd">${body}</div>${foot ? `<footer>${foot}</footer>` : ''}</div>`; }
const MD = {};
MD.serve = m => {
  const b = R.branchOf(S, m.bid), c = b.cust[m.cid];
  if (!c || !c.visit) return dlg('Customer left', '', '<div class="empty">This customer is gone.</div>', '<button class="btn" data-a="close">Close</button>', 'narrow');
  const v = c.visit;
  if (v.kind === 'return') { const r = v.data.ret, it = b.items[r.sku];
    return dlg(`Return: ${esc(c.name)}`, `${esc(R.typeLabel(b, c))} is returning an item bought earlier.`, `<div class="receipt"><div class="ln"><span>${r.qty} × ${esc(R.itemName(b, it))}</span><span>${M(r.unit * r.qty)}</span></div><div class="ln tot"><span>Refund</span><span>${M(r.unit * r.qty)}</span></div></div><p class="small muted">The item goes back into the stockroom at its original cost.</p><div class="err" id="serveErr"></div>`, `<button class="btn" data-a="close">Not now</button><button class="btn pri" data-a="refund">Refund ${M(r.unit * r.qty)}</button>`, 'narrow'); }
  const tot = R.basketTotal(S, b, v, m.wrap);
  const canWrap = b.equip.giftwrap && tot.gifts > 0;
  const method = m.method || c.pay;
  const body = `<div class="receipt">${v.basket.map(l => `<div class="ln"><span>${l.qty} × ${esc(R.itemName(b, b.items[l.sku]))}${l.gift && canWrap ? ' 🎁' : ''}</span><span>${M(l.unit * l.qty)}</span></div>`).join('')}${tot.wrapFee ? `<div class="ln"><span>Gift wrap, ${tot.gifts} item${tot.gifts > 1 ? 's' : ''}</span><span>${M(tot.wrapFee)}</span></div>` : ''}<div class="ln tot"><span>Total</span><span>${M(tot.total)}</span></div></div>
  ${canWrap ? `<label class="row mt8"><input type="checkbox" id="wrapChk" data-c="wrap" ${m.wrap ? 'checked' : ''}> Gift wrap ${tot.gifts} item${tot.gifts > 1 ? 's' : ''} at $3 each</label>` : ''}
  <div class="mt"><div class="small muted">Payment method</div><div class="seg mt8" role="group" aria-label="Payment method"><button data-a="payM" data-k="card" aria-pressed="${method === 'card'}">Card</button><button data-a="payM" data-k="cash" aria-pressed="${method === 'cash'}">Cash</button></div></div>
  ${method === 'cash' ? `<div class="mt"><p style="margin:0 0 6px">${esc(c.name.split(' ')[0])} hands you <span class="pricetag">${M(Math.max(v.tender || 0, tot.total))}</span></p><label class="f">Cash received<input type="number" step="0.01" min="0" id="cashIn" data-c="cashIn" value="" placeholder="0.00" inputmode="decimal"></label><div class="row mt8">${[...new Set([tot.total, Math.max(v.tender || 0, tot.total), Math.ceil(tot.total / 2000) * 2000, Math.ceil(tot.total / 5000) * 5000])].sort((a, z) => a - z).map(x => `<button class="btn sm" data-a="cashQuick" data-v="${x}">${M(x)}</button>`).join('')}</div><p class="mt8" style="margin-bottom:0">Change due: <b class="num" id="changeOut">—</b></p></div>`
  : `<p class="mt">${c.pay === 'card' ? 'Customer taps their card.' : 'Customer agreed to pay by card.'} Confirm once the terminal approves.</p>`}<div class="err" id="serveErr"></div>`;
  return dlg(`Checkout: ${esc(c.name)}`, `${esc(R.typeLabel(b, c))} · waited ${S.t - v.queueSince} min · ${tot.items} item${tot.items > 1 ? 's' : ''}`, body, `<button class="btn" data-a="close">Put back in line</button><button class="btn pri big" data-a="pay">${method === 'cash' ? 'Complete cash sale' : 'Confirm card payment'}</button>`, 'narrow');
};
MD.order = m => {
  const b = R.branchOf(S, m.bid), s = R.SUPPLIERS[m.sup], TT = T(b);
  const items = R.supItems(b, m.sup).filter(it => !m.cat || TT.pmap[it.pid].cat === m.cat).filter(it => !m.onlyListed || b.listed[it.pid]);
  const groups = {}; for (const it of items) (groups[it.pid] = groups[it.pid] || []).push(it);
  const body = `<div class="row" style="margin-bottom:10px"><button class="btn" data-a="orderSuggest">Fill in suggested quantities</button><button class="btn" data-a="orderClear">Clear</button><select data-c="orderCat" aria-label="Category"><option value="">All categories</option>${[...new Set(R.supItems(b, m.sup).map(i => TT.pmap[i.pid].cat))].map(c => `<option ${m.cat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select><label class="row small"><input type="checkbox" data-c="orderListed" ${m.onlyListed ? 'checked' : ''}> Only products on display</label></div>
  <div class="tw"><table><thead><tr><th>Product</th><th class="n">On hand</th><th class="n">Reorder at</th><th class="n">Unit cost</th><th class="n">Quantity</th></tr></thead><tbody>${Object.entries(groups).map(([pid, its]) => { const p = TT.pmap[pid]; const unrel = b.type === 'book' && p.release > day() + 2;
    return (its.length > 1 ? `<tr class="sub"><td colspan="4"><b>${esc(p.name)}</b> <span class="small muted">${esc(p.cat)}${b.listed[pid] ? '' : ' · not on display'}</span></td><td class="n"><button class="btn sm" data-a="orderRun" data-p="${pid}">+2 of each</button></td></tr>` : '') +
    its.map(it => `<tr><td>${its.length > 1 ? `<span style="padding-left:12px">${esc(it.label)}</span>` : `<div class="nm">${esc(p.name)}</div><div class="sb">${esc(p.cat)}${it.label ? ' · ' + esc(it.label) : ''}${b.listed[pid] ? '' : ' · not on display'}${unrel ? ` · orderable from day ${p.release - 2}` : ''}</div>`}</td><td class="n">${R.itShelf(it) + R.itStock(it)}${R.onOrder(S, b, it.sku) ? ` <span class="muted">+${R.onOrder(S, b, it.sku)}</span>` : ''}</td><td class="n">${it.min}</td><td class="n">${M(R.supUnit(b, m.sup, it.sku))}</td><td class="n"><input class="qty" type="number" min="0" max="999" value="${m.qty[it.sku] || ''}" data-c="oq" data-s="${esc(it.sku)}" aria-label="Quantity" ${unrel ? 'disabled' : ''}></td></tr>`).join(''); }).join('')}</tbody></table></div>`;
  return dlg(`New order: ${esc(s.name)}`, `Delivery in about ${dur(s.lead)} · fee ${M(s.fee)} · minimum ${M(s.minOrder)} · stockroom room for ${R.freeSpace(S, b)} more units`, body, `<div id="orderSum" style="flex:1">${orderSum()}</div><button class="btn" data-a="close">Cancel</button><button class="btn pri" data-a="orderPlace">Place order</button>`, 'wide');
};
function orderSum() {
  const m = UI.modal; const b = R.branchOf(S, m.bid);
  const q = R.quoteOrder(S, b, m.sup, Object.entries(m.qty).map(([sku, qty]) => ({ sku, qty: +qty || 0 })));
  const s = R.SUPPLIERS[m.sup];
  return `<span class="num">${q.units} units · ${M(q.sub)} + ${M(q.fee)} fee = <b>${M(q.total)}</b></span>${q.sub && q.sub < s.minOrder ? ` <span class="pill warn">Below minimum</span>` : ''}${q.units > R.freeSpace(S, b) ? ' <span class="pill bad">Too big for stockroom</span>' : ''}${q.total > S.cash ? ' <span class="pill bad">Not enough cash</span>' : ''}`;
}
MD.review = m => {
  const po = S.pos.find(p => p.id === m.po); const b = R.branchOf(S, po.bid);
  if (po.status !== 'arrived') return dlg(`${po.id}`, '', '<div class="empty">This delivery has already been handled.</div>', '<button class="btn" data-a="close">Close</button>', 'narrow');
  let credit = 0; for (const l of po.lines) credit += (l.qty - (l.delivered - l.dmg)) * l.unit;
  const body = `<div class="tw"><table><thead><tr><th>Item</th><th class="n">Ordered</th><th class="n">Delivered</th><th class="n">Damaged</th><th class="n">Into stock</th><th class="n">Credit</th></tr></thead><tbody>${po.lines.map(l => { const good = l.delivered - l.dmg; const bad = good < l.qty; return `<tr><td>${esc(R.itemName(b, b.items[l.sku]))}</td><td class="n">${l.qty}</td><td class="n ${l.delivered < l.qty ? 'negc' : ''}">${l.delivered}</td><td class="n ${l.dmg ? 'negc' : ''}">${l.dmg || ''}</td><td class="n"><b>${good}</b></td><td class="n">${bad ? M((l.qty - good) * l.unit) : ''}</td></tr>`; }).join('')}</tbody></table></div>
  <div class="grid g3 mt"><div class="tile"><div class="k">Units into stockroom</div><div class="v">${R.deliveryIn(po)}</div></div><div class="tile"><div class="k">Stockroom free</div><div class="v">${R.stockCap(b) - R.stockUsed(b)}</div></div><div class="tile"><div class="k">Credit for discrepancies</div><div class="v ${credit ? 'pos' : ''}">${M(credit)}</div></div></div>
  <p class="small muted">Accepting reports any shortage or damage to ${esc(R.SUPPLIERS[po.sup].name)} and you are credited for those units. Refusing sends everything back: you get the goods refunded but not the ${M(po.fee)} delivery fee.</p><div class="err" id="revErr"></div>`;
  return dlg(`Check in ${po.id}`, `${esc(R.SUPPLIERS[po.sup].name)} · arrived ${ago(po.arrivedAt)} · paid ${M(po.total)}`, body, `<button class="btn bad" data-a="ask" data-q="Refuse ${po.id} and send it back?" data-do="refuse" data-p="${po.id}">Refuse delivery</button><button class="btn pri" data-a="accept" data-p="${po.id}">${credit ? 'Report discrepancies & accept' : 'Accept delivery'}</button>`);
};
MD.po = m => {
  const po = S.pos.find(p => p.id === m.po); const b = R.branchOf(S, po.bid) || B();
  return dlg(po.id, `${esc(R.SUPPLIERS[po.sup].name)} · placed day ${R.dayOf(po.placed)} ${R.fmtTime(po.placed)}${po.by === 'manager' ? ' by the store manager' : ''}`, `<div class="tw"><table><thead><tr><th>Item</th><th class="n">Qty</th><th class="n">Unit</th><th class="n">Line</th>${po.lines[0].delivered != null ? '<th class="n">Delivered</th><th class="n">Damaged</th>' : ''}</tr></thead><tbody>${po.lines.map(l => `<tr><td>${esc(R.itemName(b, b.items[l.sku]))}</td><td class="n">${l.qty}</td><td class="n">${M(l.unit)}</td><td class="n">${M(l.unit * l.qty)}</td>${l.delivered != null ? `<td class="n">${l.delivered}</td><td class="n">${l.dmg || ''}</td>` : ''}</tr>`).join('')}<tr class="sub"><td colspan="3">Delivery fee</td><td class="n">${M(po.fee)}</td>${po.lines[0].delivered != null ? '<td></td><td></td>' : ''}</tr><tr class="sub"><td colspan="3"><b>Total paid</b></td><td class="n"><b>${M(po.total)}</b></td>${po.lines[0].delivered != null ? '<td></td><td></td>' : ''}</tr></tbody></table></div>${po.credit ? `<p>Credited back: <b class="num">${M(po.credit)}</b></p>` : ''}`, '<button class="btn" data-a="close">Close</button>');
};
MD.cust = m => {
  const b = R.branchOf(S, m.bid), c = b.cust[m.cid]; const ty = R.custType(b, c);
  return dlg(esc(c.name), `${esc(ty.label)} · customer since day ${c.since} · ${c.id.toUpperCase()}`, `<div class="grid g3"><div class="tile"><div class="k">Satisfaction</div><div class="v">${c.sat}</div></div><div class="tile"><div class="k">Loyalty</div><div class="v">${Math.round(c.loyalty)}</div></div><div class="tile"><div class="k">Total spent</div><div class="v">${M(c.spent)}</div></div></div>
  <div class="li small mt"><span>Typical budget per visit</span><b class="num">${M(c.budget)}</b></div><div class="li small"><span>Price tolerance above list</span><b class="num">${Math.round(c.tol * 100)}%</b></div><div class="li small"><span>Patience in line</span><b class="num">${c.patience} min</b></div><div class="li small"><span>Usually pays by</span><b>${c.pay}</b></div><div class="li small"><span>Favorite sections</span><b>${esc((c.prefs || []).join(', '))}</b></div>${c.size ? `<div class="li small"><span>Sizes</span><b>${c.size}, shoe ${c.shoe}, likes ${c.color.toLowerCase()}, brand ${c.brand}</b></div>` : ''}${c.childAge != null && c.childAge < 20 ? `<div class="li small"><span>Shops for a child aged</span><b>${c.childAge}</b></div>` : ''}<div class="li small"><span>Visits</span><b class="num">${c.visits}</b></div>
  <h3 class="mt">Recent visits</h3>${c.hist.length ? c.hist.map(h => `<div class="li small"><span>Day ${h.day} ${R.fmtTime(h.t)} · ${esc(h.note)}</span><b class="num ${h.total < 0 ? 'negc' : ''}">${h.total ? M(h.total) : ''}</b></div>`).join('') : '<div class="empty">No visits recorded yet.</div>'}`, '<button class="btn" data-a="close">Close</button>');
};
MD.wizard = m => {
  const w = UI.wiz, TT = R.TYPES[w.type], L = R.LOCS[w.loc], Z = R.SIZES[w.size];
  const cost = R.openCost(w.type, w.loc, w.size);
  const fake = R.createBranch({ seq: { id: 1, br: 1 }, t: S.t, branches: [], market: {} }, { type: w.type, name: 'x', loc: w.loc, size: w.size });
  const stock = R.openingStockCost(S, fake); const total = cost + (w.stock ? stock.cost : 0) + (w.grand ? C(500) : 0);
  const rent = R.rentOf(fake);
  const traffic = TT.traffic * Z.traffic * L.traffic * L.aff[w.type];
  const body = `<label class="f">Store type<select data-c="wz" data-k="type">${Object.values(R.TYPES).map(t => `<option value="${t.id}" ${w.type === t.id ? 'selected' : ''}>${t.label}</option>`).join('')}</select></label>
  <label class="f mt8">Store name<input type="text" id="wzName" value="${esc(w.name)}" maxlength="40" data-c="wzName"></label>
  <div class="mt"><div class="small muted">District</div><div class="grid g3 mt8">${Object.values(R.LOCS).map(l => `<button class="btn" style="text-align:left;white-space:normal;${w.loc === l.id ? 'border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)' : ''}" data-a="wzSet" data-k="loc" data-v="${l.id}" aria-pressed="${w.loc === l.id}"><b>${l.name}</b><br><span class="small muted">${l.kind} · fit ×${l.aff[w.type].toFixed(2)} · rent ×${l.rent}</span></button>`).join('')}</div><p class="small muted">${L.note}</p></div>
  <div class="mt"><div class="small muted">Size</div><div class="seg mt8">${Object.values(R.SIZES).map(z => `<button data-a="wzSet" data-k="size" data-v="${z.id}" aria-pressed="${w.size === z.id}">${z.label}</button>`).join('')}</div></div>
  <div class="mt"><div class="small muted">Starting equipment (included)</div><div class="row mt8">${TT.equip.filter(e => fake.equip[e.id]).map(e => `<span class="pill">${fake.equip[e.id]} × ${esc(e.name)}</span>`).join('')}<span class="pill">Stockroom ${R.stockCap(fake)} units</span></div></div>
  <label class="row mt"><input type="checkbox" data-c="wzStock" ${w.stock ? 'checked' : ''}> Opening inventory: ${stock.units} units across ${Object.keys(fake.listed).length} products, on the shelves on day one (${M(stock.cost)})</label>
 <label class="row mt8"><input type="checkbox" data-c="wzCash" ${w.cashier ? 'checked' : ''}> Hire a cashier on opening day so customers aren't left waiting while you're at another store (about $14/hour)</label>
  <label class="row mt8"><input type="checkbox" data-c="wzGrand" ${w.grand ? 'checked' : ''}> Grand opening campaign: +80% traffic for 2 days ($500.00)</label>
  <div class="grid g3 mt"><div class="tile"><div class="k">Investment</div><div class="v">${M(cost)}</div></div><div class="tile"><div class="k">Rent per day</div><div class="v">${M(rent)}</div></div><div class="tile"><div class="k">Expected traffic</div><div class="v">${(traffic * 0.95 * 13).toFixed(0)}/day</div></div></div>
  <div class="receipt mt"><div class="ln"><span>Store fit-out and lease</span><span>${M(cost)}</span></div>${w.stock ? `<div class="ln"><span>Opening inventory</span><span>${M(stock.cost)}</span></div>` : ''}${w.grand ? `<div class="ln"><span>Grand opening</span><span>$500.00</span></div>` : ''}<div class="ln"><span>First day's rent and utilities</span><span>${M(rent + R.utilOf(fake) + R.maintOf(fake))}</span></div><div class="ln tot"><span>Total today</span><span>${M(total + rent + R.utilOf(fake) + R.maintOf(fake))}</span></div></div>
  ${S.cash < total ? `<div class="alert bad mt8">You have ${M(S.cash)}. You need ${M(total - S.cash)} more.</div>` : ''}<div class="err" id="wzErr"></div>`;
  return dlg('Open a new store', 'Pick a type, a district and a size. The store opens immediately.', body, `<button class="btn" data-a="close">Cancel</button><button class="btn pri" data-a="wzOpen" ${S.cash < total ? 'disabled' : ''}>Open store for ${M(total)}</button>`);
};
MD.preview = m => {
  const TT = R.TYPES[m.type];
  return dlg(`${TT.label}: preview`, TT.desc, `<h3>Suppliers</h3>${TT.suppliers.map(id => { const s = R.SUPPLIERS[id]; return `<div class="li small"><span><b>${esc(s.name)}</b> · ${esc(s.kind)}</span><span class="num">${dur(s.lead)} · ${Math.round(s.rel * 100)}% reliable${s.contract ? ' · contract ' + M(s.contract) : ' · included'}</span></div>`; }).join('')}
  <h3 class="mt">Customers you will meet</h3><div class="row">${TT.custTypes.map(c => `<span class="pill">${esc(c.label)}</span>`).join('')}</div>
  <h3 class="mt">Equipment</h3><div class="row">${TT.equip.map(e => `<span class="pill">${esc(e.name)} ${M(e.cost)}</span>`).join('')}</div>
  <h3 class="mt">Catalog</h3><div class="tw"><table><thead><tr><th>Product</th><th>Category</th><th>Details</th><th class="n">Cost</th><th class="n">Price</th></tr></thead><tbody>${TT.catalog.map(p => { const its = R.itemsOf(m.type, p); return `<tr><td>${esc(p.name)}</td><td class="small">${esc(p.cat)}</td><td class="small">${m.type === 'clothing' ? `${its.length} size/color variants` : m.type === 'book' ? esc(p.author) + ' · ' + its.map(i => i.label).join(', ') : m.type === 'toy' ? `Ages ${p.age[0]}${p.age[1] >= 99 ? '+' : '–' + p.age[1]}` : (p.life ? `Keeps ${p.life} days` : 'Shelf-stable') + (p.cold ? ', ' + p.cold : '')}</td><td class="n">${M(its[0].cost)}</td><td class="n">${M(its[0].price)}</td></tr>`; }).join('')}</tbody></table></div>`, `<button class="btn" data-a="close">Close</button><button class="btn pri" data-a="wizard" data-t="${m.type}">Open one</button>`, 'wide');
};
MD.notes = () => dlg('Notifications', '', S.notes.length ? S.notes.map(n => `<div class="alert ${n.level === 'info' ? '' : n.level}" style="margin-bottom:6px"><div style="flex:1">${esc(n.text)}</div><span class="small muted num" style="white-space:nowrap">D${R.dayOf(n.t)} ${R.fmtTime(n.t)}</span></div>`).join('') : '<div class="empty">No notifications.</div>', '<button class="btn" data-a="close">Close</button>');
MD.ask = m => dlg('Please confirm', '', `<p style="margin:0">${esc(m.q)}</p>`, `<button class="btn" data-a="close">Cancel</button><button class="btn pri" data-a="confirmYes">Yes, continue</button>`, 'narrow');
MD.rename = m => dlg('Rename store', '', `<label class="f">Store name<input type="text" id="rnName" value="${esc(B().name)}" maxlength="40"></label>`, `<button class="btn" data-a="close">Cancel</button><button class="btn pri" data-a="renameYes">Save</button>`, 'narrow');

/* ---------- rendering ---------- */
function renderMain() {
  if (!S) return;
  const f = V[UI.view] || V.hq;
  let html; try { html = f(); } catch (e) { console.error(e); html = `<div class="card"><h2>Something went wrong drawing this screen</h2><p class="muted">${esc(e.message)}</p></div>`; }
  $('main').innerHTML = html;
}
function renderModal() {
  const el = $('modal');
  if (!UI.modal) { el.classList.remove('on'); el.innerHTML = ''; return; }
  const sc = el.querySelector('.bd') ? el.querySelector('.bd').scrollTop : 0;
  el.innerHTML = MD[UI.modal.k](UI.modal); el.classList.add('on');
  if (el.querySelector('.bd') && UI.modal.keepScroll) el.querySelector('.bd').scrollTop = sc;
}
function openModal(m) { UI.modal = m; renderModal(); const f = $('modal').querySelector('input:not([type=checkbox]),button.pri'); if (f && m.k !== 'order') f.focus(); }
function closeModal() { if (UI.modal && UI.modal.k === 'serve') R.serveCancel(S, UI.modal.bid, UI.modal.cid); UI.modal = null; renderModal(); renderMain(); }
function renderAll() { if (!S) return renderSetup(); document.body.classList.remove('setup-on'); $('app').style.display = ''; renderTop(); renderNav(); renderMain(); renderModal(); }

function renderSetup() {
  $('app').style.display = 'none';
  let el = $('setup'); if (!el) { el = document.createElement('div'); el.id = 'setup'; document.body.appendChild(el); }
  el.innerHTML = `<div class="setup"><div class="card"><div class="small muted" style="text-transform:uppercase;letter-spacing:.1em;font-weight:600">Retail Empire Simulator</div><div class="hero mt8">Start with one grocery store. End with an empire.</div><p class="muted">Order stock, run the register, hire staff, then open clothing, toy and book stores across the city. Day 1 is Sunday, November 1: the holiday season is coming.</p>
  <label class="f mt">Company name<input type="text" id="suCo" value="Cornerstone Retail" maxlength="40"></label>
  <label class="f mt8">First store's name<input type="text" id="suStore" value="Main Street Market" maxlength="40"></label>
  <div class="mt"><div class="small muted">Mode</div><div class="grid g2 mt8"><label class="card flat" style="cursor:pointer"><input type="radio" name="mode" value="career" checked> <b>Career</b><div class="small muted">$6,000 starting cash and milestones to reach.</div></label><label class="card flat" style="cursor:pointer"><input type="radio" name="mode" value="sandbox"> <b>Sandbox</b><div class="small muted">Pick your money and try every store type right away.</div></label></div></div>
  <label class="f mt8">Sandbox starting cash<select id="suCash"><option value="50000">$50,000</option><option value="150000" selected>$150,000</option><option value="1000000">$1,000,000</option></select></label>
  <div class="row mt"><button class="btn pri big" data-a="start">Open the store</button></div></div></div>`;
}

/* ---------- actions ---------- */
const A = {
  start() {
    const mode = document.querySelector('input[name=mode]:checked').value;
    const st = R.newGame({ company: $('suCo').value.trim() || 'Cornerstone Retail', storeName: $('suStore').value.trim() || 'Main Street Market', mode, cash: mode === 'sandbox' ? C(+$('suCash').value) : C(6000) });
    $('setup') && $('setup').remove(); attach(st); UI.view = 'hq'; save(); renderAll();
    toast('Your store opens at 08:00. Watch the Checkout screen for customers.', 'good');
  },
  nav(d) { UI.view = d.v; UI.nav = false; renderTop(); renderNav(); renderMain(); window.scrollTo(0, 0); },
  go(d) { UI.bid = d.b; A.nav(d); },
  speed(d) { S.speed = +d.n; renderTop(); if (!S.speed) save(); },
  skip() { R.skipNight(S); UI.dirty = true; renderTop(); renderMain(); renderNav(); },
  menu() { UI.nav = !UI.nav; renderNav(); },
  bell() { for (const n of S.notes) n.read = true; openModal({ k: 'notes' }); renderTop(); },
  queue() { A.nav({ v: 'checkout' }); },
  close() { closeModal(); },
  takeover() { takeOver(); },
  serveNext() { const b = B(); const id = b.queue.find(id => b.cust[id].visit && b.cust[id].visit.phase === 'queue'); if (id) A.serve({ c: id }); },
  serve(d) { const b = B(); if (!res(R.serveStart(S, b.id, d.c))) return; openModal({ k: 'serve', bid: b.id, cid: d.c, wrap: true }); },
  payM(d) { UI.modal.method = d.k; renderModal(); },
  cashQuick(d) { $('cashIn').value = (d.v / 100).toFixed(2); onCashIn(); },
  pay() {
    const m = UI.modal; const b = R.branchOf(S, m.bid), c = b.cust[m.cid]; if (!c || !c.visit) { closeModal(); return; }
    const method = m.method || c.pay; let given;
    if (method === 'cash') { const v = parseFloat($('cashIn').value); if (!Number.isFinite(v)) { $('serveErr').textContent = 'Enter the cash you received.'; return; } given = Math.round(v * 100); }
    const r = R.completeSale(S, m.bid, m.cid, { method, given, wrap: m.wrap, manual: true });
    if (!r.ok) { $('serveErr').textContent = r.err; return; }
    UI.modal = null; renderModal(); UI.dirty = true;
    toast(`Sale complete: ${M(r.total)}${method === 'cash' ? ` · change ${M(r.change)}` : ''}`, 'good');
    renderMain(); renderNav(); renderTop();
    const nx = b.queue.find(id => b.cust[id].visit && b.cust[id].visit.phase === 'queue'); if (nx && UI.view === 'checkout') { const btn = document.querySelector('[data-a=serveNext]'); btn && btn.focus(); }
  },
  refund() { const m = UI.modal; const r = R.completeSale(S, m.bid, m.cid, {}); if (!r.ok) { $('serveErr').textContent = r.err; return; } UI.modal = null; renderModal(); toast(`Refunded ${M(r.refund)}. Item back in stock.`, 'good'); UI.dirty = true; renderMain(); },
  tidy() { res(R.tidy(S, B().id), 'The floor is tidy again.'); renderMain(); },
  fill(d) { const n = R.toShelf(S, B(), d.s); toast(n ? `Moved ${n} units to the shelf.` : 'Nothing to move.', n ? 'good' : ''); UI.dirty = true; renderMain(); },
  fillAll() { const n = R.fillAll(S, B()); toast(n ? `Moved ${n} units from the stockroom to shelves.` : 'Shelves are as full as the stockroom allows.', n ? 'good' : ''); UI.dirty = true; renderMain(); },
  invTab(d) { UI.invTab = d.k; renderMain(); },
  custF(d) { UI.custF = d.k; renderMain(); },
  list(d) { res(R.setListed(S, B(), d.p, d.on === '1')); renderMain(); },
  order(d) { openModal({ k: 'order', bid: B().id, sup: d.s, qty: {}, cat: '', onlyListed: true }); },
  orderSuggest() { const m = UI.modal; for (const l of R.reorderSuggestion(S, R.branchOf(S, m.bid), m.sup)) m.qty[l.sku] = l.qty; m.keepScroll = true; renderModal(); if (!Object.keys(m.qty).length) toast('Nothing is below its reorder point.'); },
  orderClear() { UI.modal.qty = {}; renderModal(); },
  orderRun(d) { const m = UI.modal; const b = R.branchOf(S, m.bid); for (const it of Object.values(b.items)) if (it.pid === d.p) m.qty[it.sku] = (+m.qty[it.sku] || 0) + 2; m.keepScroll = true; renderModal(); },
  orderPlace() { const m = UI.modal; const lines = Object.entries(m.qty).map(([sku, q]) => ({ sku, qty: +q || 0 })).filter(l => l.qty > 0); const r = R.placeOrder(S, m.bid, m.sup, lines); if (!res(r)) return; UI.modal = null; renderModal(); toast(`${r.po.id} placed: ${M(r.po.total)}. Arrives around ${R.fmtTime(r.po.eta)}${R.dayOf(r.po.eta) !== day() ? ' on day ' + R.dayOf(r.po.eta) : ''}.`, 'good'); renderMain(); renderTop(); },
  sign(d) { res(R.signSupplier(S, B().id, d.s), `Contract signed with ${R.SUPPLIERS[d.s].name}.`); renderMain(); renderTop(); },
  review(d) { openModal({ k: 'review', po: d.p }); },
  poView(d) { openModal({ k: 'po', po: d.p }); },
  accept(d) { const r = R.acceptDelivery(S, d.p); if (!r.ok) { $('revErr').textContent = r.err; return; } UI.dirty = true; UI.modal = null; renderModal(); toast(`${r.units} units added to the stockroom${r.credit ? `, ${M(r.credit)} credited` : ''}.`, 'good'); renderMain(); renderNav(); renderTop(); },
  cust(d) { openModal({ k: 'cust', bid: B().id, cid: d.c }); },
  hire(d) { const r = R.hire(S, B().id, d.e); if (res(r, `${r.emp && r.emp.name} starts now.`)) renderMain(); },
  buyEq(d) { if (res(R.buyEquip(S, B().id, d.e), 'Installed.')) { renderMain(); renderTop(); } },
  buyUp(d) { if (res(R.buyUpgrade(S, B().id, d.u), 'Department open. Put its products on display in Products & pricing.')) { renderMain(); renderTop(); } },
  camp(d) { if (res(R.runCampaign(S, B().id, d.c), 'Campaign launched.')) { renderMain(); renderTop(); } },
  wizard(d) { const t = d.t || 'clothing'; const sug = { grocery: 'heights', clothing: 'mall', toy: 'heights', book: 'univ' }[t]; UI.wiz = { type: t, name: suggestName(t), loc: sug, size: 'small', stock: true, grand: false, cashier: true }; openModal({ k: 'wizard' }); },
  wzSet(d) { UI.wiz[d.k] = d.v; UI.modal.keepScroll = true; renderModal(); },
  wzOpen() { UI.wiz.name = $('wzName').value; const r = R.openBranch(S, UI.wiz); if (!r.ok) { $('wzErr').textContent = r.err; return; } UI.dirty = true; UI.modal = null; renderModal(); UI.bid = r.b.id; UI.view = 'overview'; save(); renderAll(); },
  preview(d) { openModal({ k: 'preview', type: d.t }); },
  renameB() { openModal({ k: 'rename' }); },
  renameYes() { const n = $('rnName').value.trim().slice(0, 40); if (!n) return; B().name = n; UI.dirty = true; closeModal(); renderNav(); },
  renameCo() { const n = $('coName').value.trim().slice(0, 40); if (n) { S.company = n; UI.dirty = true; toast('Saved.', 'good'); renderNav(); } },
  saveNow() { save(); toast(UI.saveErr || 'Saved.', UI.saveErr ? 'bad' : 'good'); renderMain(); },
  async copySave() { const o = Object.assign({}, S); delete o.onNote; const code = btoa(unescape(encodeURIComponent(JSON.stringify(o)))); try { await navigator.clipboard.writeText(code); toast('Save code copied. Keep it somewhere safe.', 'good'); } catch (e) { $('importBox').value = code; $('importBox').select(); toast('Copy was blocked. The code is in the box: select it and copy.', 'warn'); } },
  importSave() { try { const o = JSON.parse(decodeURIComponent(escape(atob($('importBox').value.trim())))); if (!o || o.v !== 1 || !o.branches) throw 0; attach(o); save(); UI.view = 'hq'; renderAll(); toast('Save loaded.', 'good'); } catch (e) { toast('That save code could not be read. Check you pasted all of it.', 'bad'); } },
  ask(d) { UI.confirm = { do: d.do, p: d.p, e: d.e }; openModal({ k: 'ask', q: d.q }); },
  confirmYes() {
    const c = UI.confirm; UI.modal = null; renderModal(); const b = B();
    if (c.do === 'reset') { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} S = null; renderAll(); return; }
    if (c.do === 'fire') res(R.fire(S, b.id, c.e), 'Employee let go.');
    if (c.do === 'refuse') res(R.refuseDelivery(S, c.p), 'Delivery refused. Goods refunded.');
    if (c.do === 'toggleStatus') res(R.setStatus(S, b.id, b.status === 'open' ? 'closed' : 'open'));
    if (c.do === 'sellB') { const r = R.sellBranch(S, b.id); if (res(r)) { UI.bid = S.branches[0].id; UI.view = 'branches'; } }
    UI.dirty = true; renderMain(); renderNav(); renderTop();
  }
};
function suggestName(t) { const n = { grocery: 'Fresh Corner Market', clothing: 'Thread & Co.', toy: 'Toy Harbor', book: 'Chapter & Verse' }[t]; let k = n, i = 2; while (S.branches.some(b => b.name === k)) k = `${n} ${i++}`; return k; }
function onCashIn() {
  const m = UI.modal; const b = R.branchOf(S, m.bid), c = b.cust[m.cid]; if (!c || !c.visit) return;
  const tot = R.basketTotal(S, b, c.visit, m.wrap).total; const v = Math.round(parseFloat($('cashIn').value) * 100);
  $('changeOut').textContent = Number.isFinite(v) ? (v >= tot ? M(v - tot) : `Short by ${M(tot - v)}`) : '—';
}
const CH = {
  pickBranch(el) { UI.bid = el.value; if (!isBranchView()) UI.view = 'overview'; renderNav(); renderMain(); renderTop(); },
  finRange(el) { UI.finRange = el.value; renderMain(); }, finB(el) { UI.finB = el.value; renderMain(); }, ledB(el) { UI.ledB = el.value; renderMain(); },
  invCat(el) { UI.invCat = el.value; renderMain(); }, prodCat(el) { UI.prodCat = el.value; renderMain(); },
  setMin(el) { const it = B().items[el.dataset.s]; const v = Math.max(0, Math.min(999, Math.round(+el.value || 0))); it.min = v; el.value = v; UI.dirty = true; },
  setRe(el) { const it = B().items[el.dataset.s]; const v = Math.max(1, Math.min(999, Math.round(+el.value || 1))); it.reorder = v; el.value = v; UI.dirty = true; },
  price(el) {
    const b = B(); const v = Math.round(parseFloat(el.value) * 100); if (!Number.isFinite(v) || v < 1 || v > 10000000) { toast('Enter a price above $0.00.', 'bad'); renderMain(); return; }
    if (el.dataset.s) b.items[el.dataset.s].price = v; else for (const it of Object.values(b.items)) if (it.pid === el.dataset.p) it.price = v;
    UI.dirty = true; toast(`Price set to ${M(v)}.`, 'good');
  },
  md(el) { B().markdown[el.dataset.p] = +el.value; UI.dirty = true; toast(+el.value ? `Marked down ${el.value}%.` : 'Markdown removed.', 'good'); },
  wrap(el) { UI.modal.wrap = el.checked; renderModal(); },
  wz(el) { UI.wiz[el.dataset.k] = el.value; if (el.dataset.k === 'type') UI.wiz.name = suggestName(el.value); renderModal(); },
  wzName(el) { UI.wiz.name = el.value; },
  wzStock(el) { UI.wiz.stock = el.checked; UI.modal.keepScroll = true; renderModal(); }, wzCash(el) { UI.wiz.cashier = el.checked; }, wzGrand(el) { UI.wiz.grand = el.checked; UI.modal.keepScroll = true; renderModal(); },
  orderCat(el) { UI.modal.cat = el.value; renderModal(); }, orderListed(el) { UI.modal.onlyListed = el.checked; renderModal(); }
};
const IN = {
  invQ(el) { UI.invQ = el.value; const pos = el.selectionStart; renderMain(); const n = $('invQ'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } },
  custQ(el) { UI.custQ = el.value; const pos = el.selectionStart; renderMain(); const n = document.querySelector('[data-c=custQ]'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } },
  cashIn() { onCashIn(); },
  oq(el) { const v = Math.max(0, Math.min(999, Math.round(+el.value || 0))); if (v) UI.modal.qty[el.dataset.s] = v; else delete UI.modal.qty[el.dataset.s]; $('orderSum').innerHTML = orderSum(); },
  wzName(el) { UI.wiz.name = el.value; }
};

/* ---------- events ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el || el.disabled) return;
  if (el.closest('#modal') === null && $('modal').classList.contains('on') && !el.closest('.top')) return;
  const f = A[el.dataset.a]; if (f) { e.preventDefault(); f(el.dataset, el); }
});
$('modal') && $('modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('change', e => { const el = e.target.closest('[data-c]'); if (el && CH[el.dataset.c]) CH[el.dataset.c](el); });
document.addEventListener('input', e => { const el = e.target.closest('[data-c]'); if (el && IN[el.dataset.c]) IN[el.dataset.c](el); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && UI.modal) closeModal();
  if (e.key === 'Enter' && UI.modal && UI.modal.k === 'serve' && e.target.id === 'cashIn') A.pay();
  if (e.key === ' ' && S && !UI.modal && !/INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName)) { e.preventDefault(); S.speed = S.speed ? 0 : 1; renderTop(); }
});
document.addEventListener('mousemove', e => {
  const g = e.target.closest && e.target.closest('.bar'); const ch = e.target.closest && e.target.closest('.chart');
  document.querySelectorAll('.chart .tip').forEach(t => { if (!ch || t.parentNode !== ch) t.remove(); });
  if (!g || !ch) return; let tip = ch.querySelector('.tip'); if (!tip) { tip = document.createElement('div'); tip.className = 'tip'; ch.appendChild(tip); }
  const r = ch.getBoundingClientRect(); tip.textContent = g.dataset.tip; tip.style.left = (e.clientX - r.left) + 'px'; tip.style.top = (e.clientY - r.top) + 'px';
});
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); else last = performance.now(); });
window.addEventListener('pagehide', save);

/* ---------- boot ---------- */
function boot() {
  $('menuBtn').innerHTML = icon('menu'); $('bellBtn').insertAdjacentHTML('afterbegin', icon('bell'));
  const st = load();
  lockCheck(); setInterval(lockCheck, 2000);
  if (st) attach(st);
  renderAll();
  setInterval(loop, 100);
}
window.__RE_UI = { get S() { return S; }, UI, A };
boot();
})();
