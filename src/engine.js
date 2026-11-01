/* Retail Empire Simulator: game data and simulation engine (no DOM access). */
(function (G) {
'use strict';

/* ---------- helpers ---------- */
const C = d => Math.round(d * 100);
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function wpick(arr, wf) {
  let t = 0; const ws = [];
  for (const x of arr) { const w = Math.max(0, wf(x) || 0); ws.push(w); t += w; }
  if (t <= 0) return null;
  let r = Math.random() * t;
  for (let i = 0; i < arr.length; i++) { r -= ws[i]; if (r <= 0) return arr[i]; }
  return arr[arr.length - 1];
}
function poisson(l) { if (l <= 0) return 0; const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= Math.random(); } while (p > L); return k - 1; }

/* ---------- time ---------- */
const DAY = 1440, OPEN = 480, CLOSE = 1260, LAST_ENTRY = 1245, SHUT = 1305;
const BASE = Date.UTC(2026, 10, 1); // Day 1 = Sunday, November 1
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const dayOf = t => Math.floor(t / DAY) + 1;
function dateOf(day) { const d = new Date(BASE + (day - 1) * 864e5); return { y: d.getUTCFullYear() - 2025, m: d.getUTCMonth(), dom: d.getUTCDate(), dow: d.getUTCDay() }; }
function fmtDate(day) { const d = dateOf(day); return `${DOW[d.dow]} ${MON[d.m]} ${d.dom}, Year ${d.y}`; }
function fmtTime(t) { const m = ((t % DAY) + DAY) % DAY; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }

/* ---------- world data ---------- */
const LOCS = {
  main:     { id:'main', name:'Main Street', kind:'Neighborhood high street', traffic:1.0, rent:1.0, wealth:1.0, aff:{grocery:1.15,clothing:0.9,toy:0.95,book:1.0}, note:'Steady local foot traffic. Good for everyday shopping.' },
  mall:     { id:'mall', name:'Riverside Mall', kind:'Shopping district', traffic:1.5, rent:1.8, wealth:1.1, aff:{grocery:0.8,clothing:1.4,toy:1.2,book:1.0}, note:'Big weekend crowds and high rent. Fashion does well here.' },
  heights:  { id:'heights', name:'Maple Heights', kind:'Family neighborhood', traffic:1.0, rent:0.85, wealth:1.05, aff:{grocery:1.2,clothing:0.9,toy:1.45,book:1.0}, note:'Young families nearby. Toys and groceries sell well.' },
  univ:     { id:'univ', name:'University Row', kind:'Campus district', traffic:1.2, rent:0.95, wealth:0.8, aff:{grocery:0.95,clothing:1.1,toy:0.7,book:1.5}, note:'Students on tight budgets. Books and textbooks are in demand.' },
  downtown: { id:'downtown', name:'Downtown Square', kind:'City center', traffic:1.35, rent:1.6, wealth:1.25, aff:{grocery:0.9,clothing:1.2,toy:0.9,book:1.2}, note:'Office workers with money to spend. Expensive rent.' },
  harbor:   { id:'harbor', name:'Harbor Plaza', kind:'Waterfront, tourists', traffic:1.1, rent:1.2, wealth:1.3, aff:{grocery:0.85,clothing:1.0,toy:1.15,book:1.1}, note:'Visitors buy gifts. Higher spending per customer.' }
};
const SIZES = {
  small:  { id:'small', label:'Small', cost:1, rent:1, stock:400, eq:1, traffic:1 },
  medium: { id:'medium', label:'Medium', cost:1.8, rent:1.7, stock:700, eq:1.6, traffic:1.45 },
  large:  { id:'large', label:'Large', cost:3, rent:2.6, stock:1100, eq:2.4, traffic:2 }
};

/* Catalogs */
const G_ = (id, name, cat, cost, price, w, o = {}) => ({ id:'g-'+id, name, cat, cost:C(cost), price:C(price), w, life:o.life||null, cold:o.cold||null });
const GROCERY = [
  G_('sourdough','Sourdough loaf','Bakery',1.9,4.49,1.2,{life:3}),
  G_('croissant','Butter croissants (4)','Bakery',2.2,4.99,0.8,{life:2}),
  G_('wheat','Whole wheat bread','Bakery',1.4,3.29,1.4,{life:4}),
  G_('milk','Whole milk, 1 gal','Dairy',2.1,3.99,2.0,{life:7,cold:'fridge'}),
  G_('eggs','Large eggs, dozen','Dairy',1.7,3.49,1.6,{life:14,cold:'fridge'}),
  G_('cheddar','Cheddar block','Dairy',2.6,4.99,0.9,{life:30,cold:'fridge'}),
  G_('yogurt','Greek yogurt (4)','Dairy',3.1,5.49,0.8,{life:12,cold:'fridge'}),
  G_('butter','Salted butter','Dairy',2.4,4.49,0.7,{life:30,cold:'fridge'}),
  G_('banana','Bananas, bunch','Produce',0.7,1.79,1.8,{life:5}),
  G_('apple','Gala apples, 3 lb','Produce',2.2,4.49,1.1,{life:14}),
  G_('tomato','Vine tomatoes','Produce',1.5,3.29,1.0,{life:6}),
  G_('onion','Yellow onions, 3 lb','Produce',1.1,2.79,0.9,{life:30}),
  G_('lettuce','Romaine lettuce','Produce',1.0,2.49,0.9,{life:5,cold:'fridge'}),
  G_('chicken','Chicken breast','Meat & Seafood',3.8,7.99,1.4,{life:3,cold:'fridge'}),
  G_('beef','Ground beef, 1 lb','Meat & Seafood',4.3,7.49,1.2,{life:3,cold:'fridge'}),
  G_('salmon','Salmon fillet','Meat & Seafood',6.4,12.99,0.6,{life:2,cold:'fridge'}),
  G_('spaghetti','Spaghetti','Pantry',0.8,1.89,1.1),
  G_('rice','Long-grain rice, 5 lb','Pantry',3.0,5.99,0.8),
  G_('crushtom','Crushed tomatoes','Pantry',0.7,1.59,0.9),
  G_('pb','Peanut butter','Pantry',2.0,3.89,0.8),
  G_('cereal','Corn flakes','Pantry',2.2,4.29,1.0),
  G_('water','Spring water (24)','Beverages',2.4,4.99,1.1),
  G_('oj','Orange juice','Beverages',2.3,4.49,1.0,{life:10,cold:'fridge'}),
  G_('cola','Cola (12 cans)','Beverages',3.7,6.99,1.0),
  G_('coffee','Ground coffee','Beverages',4.8,8.99,0.8),
  G_('pizza','Pepperoni pizza','Frozen',3.0,5.99,1.0,{life:120,cold:'freezer'}),
  G_('icecream','Vanilla ice cream','Frozen',2.6,4.99,0.9,{life:120,cold:'freezer'}),
  G_('peas','Frozen peas','Frozen',1.1,2.49,0.6,{life:180,cold:'freezer'}),
  G_('chips','Potato chips','Snacks',1.5,3.49,1.2),
  G_('cookies','Chocolate chip cookies','Snacks',1.6,3.29,0.9),
  G_('trail','Trail mix','Snacks',2.7,5.49,0.5),
  G_('towels','Paper towels (6)','Household',4.9,8.99,0.7),
  G_('trash','Trash bags (40)','Household',4.0,7.49,0.5),
  G_('dish','Dish soap','Cleaning',1.3,2.99,0.7),
  G_('laundry','Laundry detergent','Cleaning',6.0,11.99,0.6),
  G_('paste','Toothpaste','Personal Care',1.4,3.29,0.7),
  G_('shampoo','Shampoo','Personal Care',2.5,5.49,0.6)
];
const APP = ['XS','S','M','L','XL','XXL'], STD = ['S','M','L','XL'], SHOE = ['7','8','9','10','11'], KID = ['4-5Y','6-7Y','8-9Y'], OS = ['One size'];
const K_ = (id, name, cat, cost, price, sizes, colors, w, o = {}) => ({ id:'c-'+id, name, cat, cost:C(cost), price:C(price), sizes, colors, w, season:o.season||'all', brand:o.brand||'Harlow' });
const CLOTHING = [
  K_('oxford','Oxford shirt',"Men's",13,39,STD,['White','Blue'],1.1,{brand:'Harlow'}),
  K_('tee','Graphic tee','Shirts',5,19,APP,['Black','White'],1.4,{brand:'Aster'}),
  K_('jeans','Slim jeans','Pants & Jeans',16,49,STD,['Indigo','Black'],1.3,{brand:'Northline'}),
  K_('dress','Wrap dress','Dresses',18,59,['XS','S','M','L'],['Red','Navy'],0.9,{brand:'Aster'}),
  K_('blouse','Silk blouse',"Women's",15,45,['XS','S','M','L'],['Ivory','Black'],0.8,{brand:'Aster'}),
  K_('puffer','Puffer jacket','Outerwear',34,119,STD,['Black','Olive'],1.0,{season:'winter',brand:'Northline'}),
  K_('runtee','Running tee','Sportswear',8,29,STD,['Blue','Grey'],0.8,{brand:'Northline'}),
  K_('hoodie','Kids hoodie',"Children's",9,29,KID,['Red','Grey'],0.9,{brand:'Harlow'}),
  K_('sneaker','Canvas sneakers','Shoes',15,54,SHOE,['White','Black'],1.0,{brand:'Northline'}),
  K_('belt','Leather belt','Accessories',7,29,OS,['Brown','Black'],0.6,{brand:'Harlow'}),
  K_('tote','Weekender tote','Bags',12,45,OS,['Tan','Black'],0.6,{brand:'Aster'}),
  K_('scarf','Wool scarf','Seasonal',6,24,OS,['Grey','Red'],0.8,{season:'winter',brand:'Harlow'}),
  K_('shorts','Linen shorts','Seasonal',9,32,STD,['Sand'],0.7,{season:'summer',brand:'Harlow'})
];
const T_ = (id, name, cat, cost, price, age, pop, o = {}) => ({ id:'t-'+id, name, cat, cost:C(cost), price:C(price), age, pop, w:1, col:!!o.col, brand:o.brand||'Brightbox', season:o.season||'all' });
const TOYS = [
  T_('starship','Starship builder set','Building Sets',18,44.99,[7,12],70,{brand:'Brickworks'}),
  T_('bricks','Classic bricks bucket','Building Sets',11,27.99,[4,9],60,{brand:'Brickworks'}),
  T_('doll','Fashion doll studio','Dolls & Figures',12,29.99,[4,9],65),
  T_('hero','Galaxy hero figure','Dolls & Figures',6,16.99,[5,12],60),
  T_('strategy','Settlers strategy game','Board Games',13,34.99,[10,99],50,{brand:'Tabletop Co.'}),
  T_('wordrace','Word race card game','Board Games',4,12.99,[7,99],45,{brand:'Tabletop Co.'}),
  T_('robot','Coding robot kit','Educational',28,69.99,[8,14],55,{brand:'Brainy'}),
  T_('puzzle','Animal floor puzzle','Educational',5,14.99,[3,6],45,{brand:'Brainy'}),
  T_('scooter','Kick scooter','Outdoor',24,59.99,[5,12],50),
  T_('bubbles','Bubble machine','Outdoor',6,15.99,[3,8],40),
  T_('bear','Cuddly bear plush','Plush',7,19.99,[0,8],60,{brand:'Snugglo'}),
  T_('rccar','RC stunt car','Remote Control',20,49.99,[8,14],65),
  T_('craft','Craft studio kit','Arts & Crafts',9,24.99,[6,12],45),
  T_('rings','Stacking rings','Baby Toys',3,9.99,[0,2],50,{brand:'Snugglo'}),
  T_('console','Handheld game console','Video Games',120,199.99,[8,99],70,{brand:'Pixelon'}),
  T_('pad','Wireless gamepad','Video Games',28,54.99,[8,99],50,{brand:'Pixelon'}),
  T_('blindbox','Mystery figure blind box','Collectibles',3,9.99,[8,99],70,{col:true,brand:'Vaultline'}),
  T_('holo','Holo card booster pack','Collectibles',2.5,7.99,[8,99],65,{col:true,brand:'Vaultline'}),
  T_('train','Holiday train set','Seasonal Toys',30,79.99,[4,10],55,{season:'holiday'})
];
const B_ = (id, title, author, pub, genre, fmts, w, release = 0) => ({ id:'b-'+id, name:title, author, pub, cat:genre, fmts, w, release,
  isbn: '978-1-' + String(Math.abs([...id].reduce((h,c)=>h*31+c.charCodeAt(0),7)) % 100000).padStart(5,'0') + '-' + (id.length % 10) });
const F = (hc, pb) => { const o = {}; if (hc) o.HC = { cost:C(hc[0]), price:C(hc[1]) }; if (pb) o.PB = { cost:C(pb[0]), price:C(pb[1]) }; return o; };
const BOOKS = [
  B_('lantern','The Lantern Keeper','Mara Ellison','Northgate Press','Fiction',F([13,28],[7,17]),1.2),
  B_('locks','Seven Locks','Dev Okafor','Blackfern','Mystery & Thriller',F([12,27],[7,16.99]),1.2),
  B_('wren','Summer at Wren Cove','Ana Marlow','Rosewood','Romance',F(null,[6,14.99]),1.0),
  B_('crown','Crown of Ash','J. T. Corwin','Northgate Press','Fantasy & Sci-Fi',F([14,29.99],[8,18.99]),1.3),
  B_('orbital','Orbital Drift','Priya Raman','Blackfern','Fantasy & Sci-Fi',F(null,[8,18.99]),0.9),
  B_('habits','Small Habits, Big Days','Leo Fischer','Meridian','Nonfiction',F([13,27],[7,16]),1.0),
  B_('road','The Long Road Home','Grace Nakamura','Meridian','Biography',F([14,30],null),0.7),
  B_('margin','The Margin Mindset','Carla Ruiz','Ledger House','Business',F([15,30],null),0.7),
  B_('rivers','Rivers of Empire','Thomas Adebayo','Ledger House','History',F([16,35],[9,19.99]),0.6),
  B_('pip','Pip the Brave Snail','Hana Ito','Puddle Books',"Children's",F([6,14.99],null),1.0),
  B_('static','Static Hearts','Riley Quinn','Rosewood','Young Adult',F(null,[6,13.99]),0.9),
  B_('algebra','Algebra Made Clear','Dr. Sam Whitlow','Campus Ink','Educational',F(null,[12,29.99]),0.6),
  B_('econ','Intro to Economics, 4th ed.','Ruth Delacroix','Campus Ink','Textbooks',F([60,129.99],null),0.5),
  B_('signal','Midnight Signal, Vol. 1','Kofi Mensah','Panel Press','Comics & Graphic Novels',F(null,[8,19.99]),0.8),
  B_('ninth','Blade of the Ninth Moon, Vol. 1','Aki Moriyama','Panel Press','Manga',F(null,[5,11.99]),1.0),
  B_('journal','Linen-bound journal','Paperworks','Paperworks','Stationery',{ITEM:{cost:C(5),price:C(16.99)}},0.6),
  B_('bookmark','Brass bookmark','Paperworks','Paperworks','Stationery',{ITEM:{cost:C(1.5),price:C(6.99)}},0.5),
  B_('ember','Crown of Ash II: Ember Throne','J. T. Corwin','Northgate Press','Fantasy & Sci-Fi',F([15,32],null),1.4,8),
  B_('quiet','The Quiet Detective','Dev Okafor','Blackfern','Mystery & Thriller',F([13,28],null),1.1,15)
];
const FMT_LABEL = { HC:'Hardcover', PB:'Paperback', ITEM:'Item' };

/* Items (sellable variants) built from products */
function itemsOf(type, p) {
  if (type === 'clothing') { const out = []; for (const c of p.colors) for (const s of p.sizes) out.push({ sku:`${p.id}|${c}|${s}`, pid:p.id, label:`${c} · ${s}`, size:s, color:c, cost:p.cost, price:p.price }); return out; }
  if (type === 'book') return Object.keys(p.fmts).map(f => ({ sku:`${p.id}|${f}`, pid:p.id, label:FMT_LABEL[f], fmt:f, cost:p.fmts[f].cost, price:p.fmts[f].price }));
  return [{ sku:p.id, pid:p.id, label:'', cost:p.cost, price:p.price }];
}

const EQ = (id, name, cost, desc, o = {}) => ({ id, name, cost:C(cost), desc, fac:o.fac||null, max:o.max||20, util:o.util||2 });
const TYPES = {
  grocery: {
    id:'grocery', label:'Grocery store', short:'Grocery', traffic:5, openCost:C(25000), rent:C(130), util:C(22),
    desc:'Fresh food and everyday essentials. Lots of customers, thin margins, and stock that expires.',
    specials:['Fresh food expires and spoils overnight','Refrigerated and freezer cases limit what you can sell cold','Departments to unlock: meat counter, frozen, household','Fast-moving stock needs frequent reorders'],
    catalog:GROCERY, facings:{ ambient:'Shelf facings', fridge:'Refrigerated facings', freezer:'Freezer facings' },
    shelfMax:{ ambient:20, fridge:14, freezer:14 }, defMin:6, defReorder:12,
    facingOf:p => p.cold || 'ambient',
    startDepts:['Bakery','Dairy','Produce','Pantry','Beverages','Snacks'],
    startEquip:{ shelf:3, fridge:1, register:1 },
    equip:[
      EQ('shelf','Shelf unit',600,'Adds 6 shelf facings for ambient products.',{fac:{ambient:6},util:1}),
      EQ('fridge','Refrigerated case',1800,'Adds 4 refrigerated facings. Raises utilities.',{fac:{fridge:4},util:6}),
      EQ('freezer','Chest freezer',1600,'Adds 3 freezer facings. Needed for frozen food.',{fac:{freezer:3},util:8}),
      EQ('register','Checkout register',1200,'One more checkout lane for cashiers.',{max:6,util:2}),
      EQ('stockroom','Stockroom expansion',2500,'Adds 300 units of stockroom space.',{max:6,util:2}),
      EQ('carts','Shopping carts (10)',400,'Customers pick up about 8% more items.',{max:3,util:0})
    ],
    upgrades:[
      { id:'meat', name:'Meat & seafood counter', cost:C(3000), cats:['Meat & Seafood'], need:b => b.equip.fridge >= 2 ? '' : 'Needs 2 refrigerated cases', desc:'Sell chicken, beef and salmon. Short shelf life, high value.' },
      { id:'frozen', name:'Frozen foods aisle', cost:C(1200), cats:['Frozen'], need:b => b.equip.freezer >= 1 ? '' : 'Needs a chest freezer', desc:'Sell pizza, ice cream and frozen vegetables.' },
      { id:'home', name:'Household aisle', cost:C(1500), cats:['Household','Cleaning','Personal Care'], need:() => '', desc:'Paper goods, cleaning supplies and personal care.' }
    ],
    custTypes:[
      { id:'budget', label:'Budget shopper', w:25, budget:[25,60], tol:0.03, items:[3,7], qty:[1,2], patience:[18,30], prefs:['Pantry','Produce','Bakery'] },
      { id:'family', label:'Family shopper', w:24, budget:[60,150], tol:0.15, items:[6,12], qty:[1,2], patience:[14,24], prefs:['Dairy','Produce','Snacks','Bakery','Frozen'] },
      { id:'bulk', label:'Bulk shopper', w:8, budget:[90,240], tol:0.1, items:[4,7], qty:[2,4], patience:[16,26], prefs:['Pantry','Beverages','Household','Cleaning'] },
      { id:'quick', label:'Quick shopper', w:23, budget:[10,35], tol:0.3, items:[1,3], qty:[1,1], patience:[6,12], prefs:['Beverages','Snacks','Bakery','Dairy'] },
      { id:'premium', label:'Premium shopper', w:10, budget:[60,200], tol:0.5, items:[4,9], qty:[1,2], patience:[10,18], prefs:['Bakery','Meat & Seafood','Beverages','Dairy'] },
      { id:'regular', label:'Regular customer', w:10, budget:[35,95], tol:0.18, items:[3,7], qty:[1,2], patience:[16,28], prefs:['Dairy','Bakery','Produce'] }
    ],
    suppliers:['freshway','valley','metro']
  },
  clothing: {
    id:'clothing', label:'Clothing store', short:'Clothing', traffic:3.3, openCost:C(16000), rent:C(80), util:C(12),
    desc:'Apparel tracked by size and color. Seasonal collections, fitting rooms, markdowns and returns.',
    specials:['Every size and color is its own stock line','Fitting rooms: customers queue to try things on','Winter and summer collections shift demand','Markdowns move old stock; returns come back days later'],
    catalog:CLOTHING, facings:{ rack:'Rack slots' }, shelfMax:{ rack:6 }, defMin:2, defReorder:6,
    facingOf:() => 'rack', startEquip:{ rack:4, fitting:1, register:1 },
    equip:[
      EQ('rack','Clothing rack',450,'Displays 2 more products (all sizes and colors).',{fac:{rack:2},util:0}),
      EQ('table','Display table',350,'Displays 1 more product and adds 4% to demand.',{fac:{rack:1},max:4,util:0}),
      EQ('fitting','Fitting room',1500,'One more fitting room. Shorter waits to try on.',{max:6,util:1}),
      EQ('register','Checkout register',1200,'One more checkout lane for cashiers.',{max:4,util:2}),
      EQ('stockroom','Stockroom expansion',2500,'Adds 300 units of stockroom space.',{max:6,util:2})
    ],
    upgrades:[],
    custTypes:[
      { id:'trend', label:'Trend-focused shopper', w:20, budget:[60,180], tol:0.3, items:[1,3], qty:[1,1], patience:[12,22], tryon:0.7 },
      { id:'budget', label:'Budget shopper', w:24, budget:[25,70], tol:0.0, items:[1,2], qty:[1,1], patience:[18,30], tryon:0.5 },
      { id:'brand', label:'Brand-conscious shopper', w:14, budget:[80,240], tol:0.45, items:[1,3], qty:[1,1], patience:[10,18], tryon:0.6 },
      { id:'casual', label:'Casual shopper', w:28, budget:[35,110], tol:0.15, items:[1,2], qty:[1,1], patience:[14,24], tryon:0.45 },
      { id:'seasonal', label:'Seasonal shopper', w:14, budget:[50,160], tol:0.2, items:[1,2], qty:[1,1], patience:[14,24], tryon:0.5 }
    ],
    suppliers:['threadline','northstar']
  },
  toy: {
    id:'toy', label:'Toy store', short:'Toys', traffic:3.8, openCost:C(14000), rent:C(70), util:C(10),
    desc:'Toys for every age, collectibles and games. Demand surges for the holidays and follows trends.',
    specials:['Products have age ranges; parents shop for a child','Hot toys trend up and fade','December demand runs at more than twice normal','Gift wrapping at checkout and collector displays'],
    catalog:TOYS, facings:{ display:'Toy shelf slots', case:'Collectible case slots' }, shelfMax:{ display:10, case:20 }, defMin:3, defReorder:10,
    facingOf:p => p.col ? 'case' : 'display', startEquip:{ display:3, case:1, register:1 },
    equip:[
      EQ('display','Toy shelving',500,'Displays 3 more toys.',{fac:{display:3},util:0}),
      EQ('case','Collectible case',900,'Holds 2 collectible lines. Draws collectors.',{fac:{case:2},max:4,util:1}),
      EQ('giftwrap','Gift wrap station',600,'Lets you offer gift wrapping at $3 per item.',{max:1,util:0}),
      EQ('register','Checkout register',1200,'One more checkout lane for cashiers.',{max:4,util:2}),
      EQ('stockroom','Stockroom expansion',2500,'Adds 300 units of stockroom space.',{max:6,util:2})
    ],
    upgrades:[],
    custTypes:[
      { id:'parent', label:'Parent', w:34, budget:[30,90], tol:0.12, items:[1,2], qty:[1,1], patience:[14,24] },
      { id:'gift', label:'Gift shopper', w:22, budget:[25,80], tol:0.25, items:[1,2], qty:[1,1], patience:[12,22], gift:0.75 },
      { id:'collector', label:'Collector', w:12, budget:[20,90], tol:0.35, items:[2,5], qty:[1,3], patience:[16,28] },
      { id:'kid', label:'Child with parent', w:20, budget:[15,50], tol:0.1, items:[1,3], qty:[1,1], patience:[8,14] },
      { id:'holiday', label:'Holiday shopper', w:12, budget:[60,200], tol:0.3, items:[2,4], qty:[1,1], patience:[10,20], gift:0.9 }
    ],
    suppliers:['playmakers','vault']
  },
  book: {
    id:'book', label:'Book store', short:'Books', traffic:3.6, openCost:C(12000), rent:C(60), util:C(9),
    desc:'Titles by genre, author and format. Readers come back for their favorite genres, new releases and preorders.',
    specials:['Hardcover and paperback stocked separately','Readers stick to genres they love','New releases spike, preorders arrive on release day','Back-to-school and holiday seasons'],
    catalog:BOOKS, facings:{ shelf:'Title slots' }, shelfMax:{ shelf:6 }, defMin:2, defReorder:6,
    facingOf:() => 'shelf', startEquip:{ shelf:3, register:1 },
    equip:[
      EQ('shelf','Bookshelf',450,'Holds 4 more titles.',{fac:{shelf:4},util:0}),
      EQ('newtable','New-release table',700,'Holds 1 title and doubles new-release demand.',{fac:{shelf:1},max:2,util:0}),
      EQ('nook','Reading nook',1200,'Readers linger: +6% traffic and happier visits.',{max:2,util:1}),
      EQ('register','Checkout register',1200,'One more checkout lane for cashiers.',{max:4,util:2}),
      EQ('stockroom','Stockroom expansion',2500,'Adds 300 units of stockroom space.',{max:6,util:2})
    ],
    upgrades:[],
    custTypes:[
      { id:'casual', label:'Casual reader', w:30, budget:[15,45], tol:0.15, items:[1,2], qty:[1,1], patience:[14,24] },
      { id:'student', label:'Student', w:18, budget:[20,150], tol:0.0, items:[1,2], qty:[1,1], patience:[12,22] },
      { id:'collector', label:'Collector', w:8, budget:[40,120], tol:0.4, items:[1,3], qty:[1,1], patience:[16,26] },
      { id:'frequent', label:'Frequent reader', w:24, budget:[30,80], tol:0.2, items:[2,4], qty:[1,1], patience:[16,28] },
      { id:'genre', label:'Genre reader', w:20, budget:[20,60], tol:0.2, items:[1,3], qty:[1,1], patience:[14,24] }
    ],
    suppliers:['harbor','inkwell']
  }
};
for (const t of Object.values(TYPES)) { t.pmap = {}; for (const p of t.catalog) t.pmap[p.id] = p; t.cats = [...new Set(t.catalog.map(p => p.cat))]; }

const SUPPLIERS = {
  freshway:  { id:'freshway', type:'grocery', name:'FreshWay Wholesale', kind:'Full-line grocery wholesaler', priceIdx:1.0, fee:C(35), lead:180, minOrder:C(100), rel:0.95, contract:0, cats:null },
  valley:    { id:'valley', type:'grocery', name:'Valley Farms Co-op', kind:'Local fresh produce, dairy and meat', priceIdx:0.86, fee:C(25), lead:120, minOrder:C(80), rel:0.82, contract:C(400), cats:['Bakery','Dairy','Produce','Meat & Seafood'] },
  metro:     { id:'metro', type:'grocery', name:'Metro Cash & Carry', kind:'Bulk dry goods and household', priceIdx:0.88, fee:C(60), lead:360, minOrder:C(250), rel:0.98, contract:C(600), cats:['Pantry','Beverages','Snacks','Frozen','Household','Cleaning','Personal Care'] },
  threadline:{ id:'threadline', type:'clothing', name:'Threadline Apparel', kind:'Apparel distributor', priceIdx:1.0, fee:C(80), lead:480, minOrder:C(200), rel:0.94, contract:0, cats:null },
  northstar: { id:'northstar', type:'clothing', name:'Northstar Outerwear', kind:'Outerwear, shoes and seasonal', priceIdx:0.9, fee:C(90), lead:720, minOrder:C(400), rel:0.88, contract:C(800), cats:['Outerwear','Shoes','Seasonal','Sportswear'] },
  playmakers:{ id:'playmakers', type:'toy', name:'Playmakers Distribution', kind:'Toy and game distributor', priceIdx:1.0, fee:C(60), lead:360, minOrder:C(200), rel:0.93, contract:0, cats:null },
  vault:     { id:'vault', type:'toy', name:"Collector's Vault", kind:'Collectibles and video games', priceIdx:0.9, fee:C(40), lead:300, minOrder:C(150), rel:0.8, contract:C(700), cats:['Collectibles','Video Games'] },
  harbor:    { id:'harbor', type:'book', name:'Harbor Book Wholesale', kind:'Book wholesaler, all publishers', priceIdx:1.0, fee:C(30), lead:240, minOrder:C(100), rel:0.95, contract:0, cats:null },
  inkwell:   { id:'inkwell', type:'book', name:'Inkwell Publishers Direct', kind:'Direct from select publishers', priceIdx:0.85, fee:C(45), lead:600, minOrder:C(300), rel:0.9, contract:C(500), pubs:['Northgate Press','Blackfern','Rosewood','Panel Press'] }
};
function supCarries(sup, p) { if (sup.pubs) return sup.pubs.includes(p.pub); return !sup.cats || sup.cats.includes(p.cat); }

const ROLES = {
  cashier:  { id:'cashier', label:'Cashier', wage:[13,16], desc:'Runs a checkout register automatically.' },
  stocker:  { id:'stocker', label:'Stocker', wage:[12,15], desc:'Moves stock from the stockroom to shelves every 10 minutes.' },
  receiver: { id:'receiver', label:'Delivery receiver', wage:[13,16], desc:'Checks and accepts deliveries when they arrive.' },
  cleaner:  { id:'cleaner', label:'Store cleaner', wage:[11,14], desc:'Keeps the store clean through the day.' },
  manager:  { id:'manager', label:'Store manager', wage:[24,32], desc:'Reorders stock below minimum each morning; staff work 10% faster.' }
};

const CAMPAIGNS = [
  { id:'flyers', name:'Neighborhood flyers', cost:C(120), mult:1.25, days:2, desc:'+25% traffic for 2 days.' },
  { id:'radio', name:'Local radio spots', cost:C(500), mult:1.5, days:3, desc:'+50% traffic for 3 days.' },
  { id:'sale', name:'Store-wide sale, 10% off', cost:C(200), mult:1.6, days:1, discount:0.1, desc:'10% off every price and +60% traffic for 1 day.' },
  { id:'circular', name:'Weekly circular', type:'grocery', cost:C(250), mult:1.3, days:3, desc:'+30% traffic for 3 days.' },
  { id:'lookbook', name:'Seasonal lookbook', type:'clothing', cost:C(700), mult:1.5, days:3, desc:'+50% traffic for 3 days; seasonal items sell faster.' },
  { id:'toycat', name:'Holiday toy catalog', type:'toy', cost:C(800), mult:1.7, days:4, desc:'+70% traffic for 4 days.' },
  { id:'signing', name:'Author signing event', type:'book', cost:C(600), mult:1.8, days:1, rep:4, desc:'+80% traffic for 1 day and +4 reputation.' }
];
const LOYALTY_COST = C(1500);
const BRAND_CAMPAIGN = { id:'brand', name:'Company brand campaign', cost:C(2000), mult:1.3, days:5, desc:'+30% traffic at every branch for 5 days.' };

const GOALS = [
  { id:'serve25', text:'Serve 25 customers', test:S => S.totals.served >= 25 },
  { id:'hire', text:'Hire your first employee', test:S => S.branches.some(b => b.emps.length > 0) },
  { id:'profit500', text:'Make $500 net profit in a single day', test:S => S.totals.bestDay >= C(500) },
  { id:'supplier2', text:'Sign a contract with a second supplier', test:S => S.branches.some(b => b.sups.length > 1) },
  { id:'dept', text:'Open a new grocery department', test:S => S.branches.some(b => b.type === 'grocery' && b.upg.length > 0) },
  { id:'stars4', text:'Reach a 4-star rating at a branch', test:S => S.branches.some(b => b.rep >= 80) },
  { id:'branch2', text:'Open a second branch', test:S => S.branches.length >= 2 },
  { id:'alltypes', text:'Own all four types of store', test:S => ['grocery','clothing','toy','book'].every(t => S.branches.some(b => b.type === t)) },
  { id:'cash100k', text:'Grow company cash to $100,000', test:S => S.cash >= C(100000) }
];

const FIRST = ['Ava','Liam','Noah','Emma','Mia','Lucas','Zoe','Ethan','Maya','Owen','Nora','Leo','Ruby','Kai','Isla','Omar','Priya','Diego','Hana','Sam','Grace','Theo','Lena','Marcus','Yuki','Ivy','Felix','Amara','Jonah','Elena','Malik','Clara','Rafael','Wren','Tariq','Sofia','Ben','Chloe','Arjun','Nadia','Hugo','Iris','Mateo','Leila','Caleb','Freya','Kofi','June','Luca','Rosa'];
const LAST = ['Park','Nguyen','Garcia','Smith','Okafor','Chen','Patel','Rossi','Kim','Silva','Martin','Haddad','Novak','Brooks','Ito','Mensah','Fischer','Lopez','Kowalski','Reyes','Bauer','Singh','Moreau','Ahmed','Dubois','Walsh','Costa','Larsen','Jensen','Torres','Murphy','Hughes','Sato','Ali','Ortiz','Becker','Price','Kaur','Ward','Bianchi'];

/* ---------- state construction ---------- */
function newGame(opts) {
  const S = {
    v: 1, company: opts.company || 'Cornerstone Retail', mode: opts.mode || 'career', cash: opts.cash != null ? opts.cash : C(6000),
    t: 7 * 60 + 30, speed: 1, seq: { id: 1, po: 1001, br: 1 }, branches: [], pos: [], ledger: [], stats: {}, notes: [],
    totals: { served: 0, bestDay: -1e12, revenue: 0 }, goals: {}, market: { hot: null, hotUntil: 0 }, brandUntil: 0, created: Date.now()
  };
  const b = createBranch(S, { type:'grocery', name:opts.storeName || 'Main Street Market', loc:'main', size:'small', starter:true });
  // pre-stocked starter store
  for (const p of TYPES.grocery.catalog) if (b.listed[p.id]) {
    const it = b.items[p.id]; const m = TYPES.grocery.shelfMax[TYPES.grocery.facingOf(p)];
    addBatch(S, it, p, Math.round(m * 0.75), Math.round(m * 0.5), p.cost);
  }
  chargeDaily(S, b, 1);
  note(S, b.id, 'info', `Welcome to ${S.company}. Your first store, ${b.name}, opens at 08:00. Customers will start lining up at Checkout.`);
  return S;
}
function nid(S, p) { return p + (S.seq.id++); }

function createBranch(S, o) {
  const T = TYPES[o.type], sz = SIZES[o.size || 'small'];
  const b = {
    id: 'b' + (S.seq.br++), type: o.type, name: o.name, loc: o.loc, size: sz.id, opened: dayOf(S.t), status: 'open',
    rep: 60, clean: 90, lastTidy: -999, equip: {}, upg: [], depts: o.type === 'grocery' ? [...T.startDepts] : [...T.cats],
    listed: {}, items: {}, markdown: {}, sups: [T.suppliers[0]], supRel: {}, cust: {}, active: [], queue: [], sched: [],
    emps: [], apps: [], camps: [], loyalty: false, preorders: [], returnsDue: [], fitBusy: 0, invested: 0, stockBuyout: 0
  };
  for (const e of T.equip) b.equip[e.id] = 0;
  for (const [k, v] of Object.entries(T.startEquip)) b.equip[k] = Math.max(1, Math.round(v * sz.eq));
  for (const p of T.catalog) for (const it of itemsOf(o.type, p)) {
    const fac = T.facingOf(p);
    b.items[it.sku] = { sku: it.sku, pid: p.id, label: it.label, size: it.size, color: it.color, fmt: it.fmt, price: it.price,
      min: fac === 'fridge' ? 5 : T.defMin, reorder: fac === 'fridge' ? 10 : T.defReorder, batches: [], soldT: 0, missT: 0, soldY: 0, soldAll: 0 };
  }
  // list products by weight until facings are full
  const caps = facings(b); const used = {};
  const sorted = [...T.catalog].sort((a, c) => (c.w || 1) * (c.pop || 50) - (a.w || 1) * (a.pop || 50));
  for (const p of sorted) {
    if (!b.depts.includes(p.cat)) continue;
    if (o.type === 'book' && p.release > dayOf(S.t)) continue;
    if (o.type === 'clothing' && p.season === 'summer') continue;
    const f = T.facingOf(p); used[f] = used[f] || 0;
    if (used[f] < (caps[f] || 0)) { b.listed[p.id] = true; used[f]++; }
  }
  for (let i = 0; i < 45; i++) genCustomer(S, b);
  refreshApplicants(S, b);
  S.branches.push(b);
  return b;
}

function facings(b) {
  const T = TYPES[b.type]; const out = {};
  for (const k of Object.keys(T.facings)) out[k] = 0;
  for (const e of T.equip) if (e.fac) for (const [k, v] of Object.entries(e.fac)) out[k] += v * (b.equip[e.id] || 0);
  return out;
}
function facingsUsed(b) {
  const T = TYPES[b.type]; const out = {};
  for (const k of Object.keys(T.facings)) out[k] = 0;
  for (const pid of Object.keys(b.listed)) if (b.listed[pid]) out[T.facingOf(T.pmap[pid])]++;
  return out;
}
const stockCap = b => SIZES[b.size].stock + 300 * (b.equip.stockroom || 0);
const itShelf = it => it.batches.reduce((a, x) => a + x.s, 0);
const itStock = it => it.batches.reduce((a, x) => a + x.r, 0);
function stockUsed(b) { let n = 0; for (const it of Object.values(b.items)) n += itStock(it); return n; }
function prodOf(b, it) { return TYPES[b.type].pmap[it.pid]; }
function shelfMaxOf(b, p) { const T = TYPES[b.type]; return T.shelfMax[T.facingOf(p)]; }
function refPrice(b, it) { const p = prodOf(b, it); if (b.type === 'book') return p.fmts[it.fmt].price; return p.price; }
function costOf(b, it) { const p = prodOf(b, it); if (b.type === 'book') return p.fmts[it.fmt].cost; return p.cost; }
function avgCost(b, it) { let q = 0, v = 0; for (const x of it.batches) { q += x.s + x.r; v += (x.s + x.r) * x.c; } return q ? Math.round(v / q) : costOf(b, it); }
function saleOn(S, b) { return b.camps.some(c => c.id === 'sale' && c.until > S.t); }
function effPrice(S, b, it) {
  const md = b.markdown[it.pid] || 0;
  return Math.round(it.price * (1 - md / 100) * (saleOn(S, b) ? 0.9 : 1));
}
function addBatch(S, it, p, shelf, stock, cost) {
  const day = dayOf(S.t);
  const exp = p.life ? day + p.life - 1 + (p.life > 5 ? randi(-1, 1) : 0) : null;
  it.batches.push({ id: S.seq.id++, s: shelf, r: stock, c: cost, exp });
  sortBatches(it);
}
function sortBatches(it) { it.batches.sort((a, c) => (a.exp == null ? 1e9 : a.exp) - (c.exp == null ? 1e9 : c.exp)); }
function cleanBatches(it) { it.batches = it.batches.filter(x => x.s + x.r > 0); }

/* ---------- money & stats ---------- */
function st(S, day, bid) {
  const d = S.stats[day] || (S.stats[day] = {});
  return d[bid] || (d[bid] = { rev:0, refunds:0, cogs:0, gift:0, rent:0, util:0, wages:0, mkt:0, fees:0, maint:0, spoil:0, purchases:0, credits:0, capex:0, cin:0, cout:0, served:0, lost:0, visits:0, satSum:0, satN:0, missed:0, cats:{} });
}
function cashTx(S, bid, amt, kind, memo) {
  S.cash += amt;
  const s = st(S, dayOf(S.t), bid || 'hq');
  if (amt >= 0) s.cin += amt; else s.cout -= amt;
  S.ledger.push({ id: S.seq.id++, t: S.t, b: bid || null, kind, amt, memo: memo || '', bal: S.cash });
  if (S.ledger.length > 2500) S.ledger.splice(0, S.ledger.length - 2500);
}
function note(S, bid, level, text) {
  S.notes.unshift({ id: S.seq.id++, t: S.t, b: bid, level, text, read: false });
  if (S.notes.length > 80) S.notes.length = 80;
  if (S.onNote) S.onNote(S.notes[0]);
}
const branchOf = (S, id) => S.branches.find(b => b.id === id);

/* ---------- customers ---------- */
function genCustomer(S, b) {
  const T = TYPES[b.type], L = LOCS[b.loc];
  const ty = wpick(T.custTypes, x => x.w * (x.id === 'holiday' ? holidayW(dayOf(S.t)) : 1));
  const c = {
    id: 'c' + (S.seq.id++), name: pick(FIRST) + ' ' + pick(LAST), type: ty.id,
    budget: Math.round(C(rand(ty.budget[0], ty.budget[1])) * L.wealth), tol: ty.tol, patience: randi(ty.patience[0], ty.patience[1]),
    loyalty: randi(5, 35), sat: 70, visits: 0, spent: 0, hist: [], lastVisit: -1e9, since: dayOf(S.t), pay: Math.random() < 0.65 ? 'card' : 'cash', visit: null
  };
  if (b.type === 'grocery') c.prefs = [...ty.prefs].sort(() => Math.random() - 0.5).slice(0, 2);
  if (b.type === 'clothing') {
    c.size = wpick(APP, s => ({ XS:5, S:18, M:30, L:27, XL:15, XXL:5 })[s]); c.shoe = pick(SHOE); c.kid = pick(KID);
    c.color = pick(['Black','White','Blue','Red','Navy','Grey','Indigo','Olive','Ivory','Tan','Brown','Sand']);
    c.brand = pick(['Harlow','Aster','Northline']);
    c.prefs = [pick(T.cats), pick(T.cats)];
  }
  if (b.type === 'toy') { c.childAge = ty.id === 'collector' ? 25 : randi(0, 13); c.prefs = [pick(T.cats)]; }
  if (b.type === 'book') {
    const gs = T.cats.filter(g => g !== 'Stationery');
    c.prefs = ty.id === 'student' ? [pick(['Textbooks','Educational']), pick(gs)] : [pick(gs), pick(gs)];
  }
  b.cust[c.id] = c;
  return c;
}
function holidayW(day) { const d = dateOf(day); return d.m === 10 ? 1.5 : d.m === 11 && d.dom <= 24 ? 3 : 0.2; }
function typeLabel(b, c) { const t = TYPES[b.type].custTypes.find(x => x.id === c.type); return t ? t.label : c.type; }
function custType(b, c) { return TYPES[b.type].custTypes.find(x => x.id === c.type); }

function seasonMult(type, day) {
  const d = dateOf(day); let m = 1;
  if (type === 'grocery') { if (d.m === 10 && d.dom >= 22 && d.dom <= 26) m = 1.4; if (d.m === 11 && d.dom >= 18 && d.dom <= 24) m = 1.3; if (d.m === 11 && d.dom === 25) m = 0.3; }
  if (type === 'clothing') { if (d.m === 10 && d.dom === 27) m = 2.0; else if (d.m === 11 && d.dom <= 24) m = 1.4; else if (d.m === 0 && d.dom <= 10) m = 1.3; }
  if (type === 'toy') { if (d.m === 10) m = d.dom >= 20 ? 1.6 : 1.2; else if (d.m === 11 && d.dom <= 24) m = 1.8 + d.dom * 0.04; else if (d.m === 11) m = 0.7; else if (d.m <= 1) m = 0.75; }
  if (type === 'book') { if (d.m === 11 && d.dom <= 24) m = 1.5; else if (d.m === 0 && d.dom <= 15) m = 1.2; else if ((d.m === 7 && d.dom >= 20) || (d.m === 8 && d.dom <= 10)) m = 1.6; }
  if (d.dow === 0 || d.dow === 6) m *= 1.3;
  return m;
}
const HOUR = [0,0,0,0,0,0,0,0,0.6,0.8,1.0,1.1,1.35,1.2,0.9,0.9,1.1,1.45,1.4,1.0,0.75,0.5,0,0];
function trafficMult(S, b) {
  let m = 1;
  for (const c of b.camps) if (c.until > S.t) m *= c.mult;
  if (S.brandUntil > S.t) m *= BRAND_CAMPAIGN.mult;
  return m;
}
function arrivalRate(S, b) { // per hour
  const T = TYPES[b.type], L = LOCS[b.loc], day = dayOf(S.t), h = Math.floor((S.t % DAY) / 60);
  let r = T.traffic * SIZES[b.size].traffic * L.traffic * L.aff[b.type] * (0.35 + b.rep / 100) * HOUR[h] * seasonMult(b.type, day) * trafficMult(S, b);
  if (b.type === 'book') r *= 1 + 0.06 * (b.equip.nook || 0);
  if (b.type === 'clothing') r *= 1 + 0.04 * (b.equip.table || 0);
  if (b.type === 'toy' && b.equip.case) r *= 1.05;
  if (b.loyalty) r *= 1.08;
  return r;
}

function startVisit(S, b, c, kind, data) {
  const usual = c.pay || 'card', other = usual === 'card' ? 'cash' : 'card';
  c.visit = { method: Math.random() < 0.8 ? usual : other, phase: 'browsing', start: S.t, until: S.t + randi(4, 10), kind: kind || 'shop', basket: [], missed: 0, pricey: 0, alt: 0, pre: 0, data: data || null };
  if (kind === 'return') { c.visit.phase = 'queue'; c.visit.queueSince = S.t; b.queue.push(c.id); }
  b.active.push(c.id);
  st(S, dayOf(S.t), b.id).visits++;
}

function productWeight(S, b, c, p, day) {
  const T = TYPES[b.type], ty = custType(b, c), d = dateOf(day);
  let w = (p.w || 1);
  if (c.prefs && c.prefs.includes(p.cat)) w *= 2.5;
  if (b.type === 'clothing') {
    if (p.season === 'winter') w *= (d.m >= 10 || d.m <= 1) ? 1.8 : d.m >= 5 && d.m <= 7 ? 0.3 : 1;
    if (p.season === 'summer') w *= (d.m >= 10 || d.m <= 1) ? 0.25 : d.m >= 5 && d.m <= 7 ? 1.8 : 1;
    if (ty.id === 'seasonal' && p.season !== 'all') w *= 2.5;
    if (ty.id === 'brand' && p.brand === c.brand) w *= 2.5;
    if (ty.id === 'budget') w *= 1 + (b.markdown[p.id] || 0) / 15;
    if (ty.id === 'trend' && b.camps.some(x => x.id === 'lookbook' && x.until > S.t) && p.season !== 'all') w *= 2;
  }
  if (b.type === 'toy') {
    let pop = p.pop; if (S.market.hot === p.id && S.market.hotUntil > S.t) pop += 45;
    w *= pop / 50;
    if (p.season === 'holiday') w *= (d.m === 10 || (d.m === 11 && d.dom <= 24)) ? 2.5 : 0.1;
    if (ty.id === 'collector') w *= p.col ? 8 : 0.2;
    else if (c.childAge != null && !(c.childAge >= p.age[0] && c.childAge <= p.age[1])) w *= 0.08;
  }
  if (b.type === 'book') {
    if (p.release > day) w *= 0.6; // still asked for: becomes preorder
    else if (day - p.release <= 7 && p.release > 0) w *= 3 * (b.equip.newtable ? 2 : 1);
    if (ty.id === 'student' && (p.cat === 'Textbooks' || p.cat === 'Educational')) w *= 4;
    if (ty.id === 'genre' && !(c.prefs || []).includes(p.cat)) w *= 0.2;
    if (b._best && b._best.includes(p.id)) w *= 1.4;
  }
  if (b.type === 'grocery' && !b.depts.includes(p.cat)) w = 0;
  return w;
}

function buildWants(S, b, c) {
  const T = TYPES[b.type], ty = custType(b, c), day = dayOf(S.t);
  let n = randi(ty.items[0], ty.items[1]);
  if (b.type === 'grocery' && b.equip.carts) n = Math.round(n * (1 + 0.08 * b.equip.carts));
  if (b.type === 'toy' && ty.id === 'kid' && Math.random() < 0.5) n++;
  const wants = [], seen = new Set();
  if (c.visit.data && c.visit.data.forced) wants.push(c.visit.data.forced);
  const pool = T.catalog;
  for (let i = 0, guard = 0; i < n && guard < n * 4; guard++) {
    const p = wpick(pool, x => productWeight(S, b, c, x, day));
    if (!p) break; if (seen.has(p.id)) continue; seen.add(p.id); i++;
    const qty = randi(ty.qty[0], ty.qty[1]);
    if (b.type === 'grocery') wants.push({ pid: p.id, opts: [p.id], qty });
    else if (b.type === 'toy') wants.push({ pid: p.id, opts: [p.id], qty, gift: Math.random() < (ty.gift || 0.15) });
    else if (b.type === 'clothing') {
      const size = p.sizes === SHOE ? c.shoe : p.sizes === KID ? c.kid : p.sizes === OS ? 'One size' : (p.sizes.includes(c.size) ? c.size : pick(p.sizes));
      const col = p.colors.includes(c.color) ? c.color : pick(p.colors);
      const opts = [`${p.id}|${col}|${size}`];
      for (const oc of p.colors) if (oc !== col && Math.random() < 0.6) opts.push(`${p.id}|${oc}|${size}`);
      wants.push({ pid: p.id, opts, qty });
    } else if (b.type === 'book') {
      const fm = Object.keys(p.fmts);
      let pref = fm.includes('ITEM') ? 'ITEM' : (ty.id === 'collector' && fm.includes('HC')) ? 'HC' : (ty.id === 'student' && fm.includes('PB')) ? 'PB' : (Math.random() < 0.6 && fm.includes('PB') ? 'PB' : fm[0]);
      const opts = [`${p.id}|${pref}`]; for (const f of fm) if (f !== pref && ty.id !== 'collector') opts.push(`${p.id}|${f}`);
      wants.push({ pid: p.id, opts, qty, pre: p.release > day });
    }
  }
  return wants;
}

function takeFromShelf(it, q) {
  const picks = [];
  for (const x of it.batches) { if (q <= 0) break; const n = Math.min(x.s, q); if (n > 0) { x.s -= n; q -= n; picks.push({ bid: x.id, q: n, c: x.c, exp: x.exp }); } }
  return picks;
}
function returnPicks(S, it, picks) {
  for (const pk of picks) {
    const x = it.batches.find(y => y.id === pk.bid);
    if (x) x.s += pk.q; else it.batches.push({ id: S.seq.id++, s: pk.q, r: 0, c: pk.c, exp: pk.exp });
  }
  sortBatches(it);
}

function finishBrowse(S, b, c) {
  const v = c.visit, ty = custType(b, c), day = dayOf(S.t);
  const wants = buildWants(S, b, c); v.wants = wants.length;
  let spent = 0; const budget = c.budget * (1 + c.loyalty / 400);
  for (const w of wants) {
    if (w.pre) { // unreleased book
      if (Math.random() < 0.6 && !b.preorders.some(x => x.cid === c.id && x.pid === w.pid)) { b.preorders.push({ cid: c.id, pid: w.pid, sku: w.opts[0], day }); v.pre++; }
      continue;
    }
    let got = false, wasAvail = false;
    for (let i = 0; i < w.opts.length; i++) {
      const it = b.items[w.opts[i]]; if (!it || !b.listed[it.pid]) continue;
      const sh = itShelf(it); if (sh <= 0) continue;
      wasAvail = true;
      const price = effPrice(S, b, it), ratio = price / refPrice(b, it);
      const accept = ratio <= 1 + c.tol ? 1 : clamp(1 - (ratio - 1 - c.tol) * 4, 0, 1);
      if (Math.random() > accept) { v.pricey++; break; }
      let q = Math.min(w.qty, sh);
      while (q > 0 && spent + price * q > budget) q--;
      if (q <= 0) break;
      const picks = takeFromShelf(it, q);
      v.basket.push({ sku: it.sku, qty: q, unit: price, picks, gift: !!w.gift });
      spent += price * q; got = true; if (i > 0) v.alt++;
      break;
    }
    if (!got && !wasAvail) { v.missed++; const it0 = b.items[w.opts[0]]; if (it0) it0.missT++; st(S, day, b.id).missed++; }
  }
  if (!v.basket.length) { endVisit(S, b, c, 'left'); return; }
  if (b.type === 'clothing' && Math.random() < (ty.tryon || 0.5)) { v.phase = 'fitwait'; v.fitSince = S.t; tryFit(S, b, c); return; }
  toQueue(S, b, c);
}
function tryFit(S, b, c) {
  if (b.fitBusy < (b.equip.fitting || 0)) { b.fitBusy++; c.visit.phase = 'fitting'; c.visit.until = S.t + randi(4, 8); return true; }
  return false;
}
function toQueue(S, b, c) { c.visit.phase = 'queue'; c.visit.queueSince = S.t; b.queue.push(c.id); }

function abandon(S, b, c, reason) {
  const v = c.visit;
  for (const l of v.basket) { const it = b.items[l.sku]; if (it) returnPicks(S, it, l.picks); }
  v.basket = []; v.abandoned = reason;
  endVisit(S, b, c, 'abandoned');
}

function visitSat(S, b, c, outcome) {
  const v = c.visit; let s = 84; const n = Math.max(1, v.wants || 1);
  s -= 38 * v.missed / n + 16 * v.pricey / n - 4 * v.pre;
  if (v.missed && n <= 2) s -= 8;
  if (v.queueSince != null) { const waited = (v.doneAt || S.t) - v.queueSince; s -= Math.min(25, Math.max(0, waited - 5) * 0.8); }
  if (v.fitSince != null && v.fitWaited) s -= v.fitWaited * 1.2;
  if (b.clean < 65) s -= (65 - b.clean) / 2.5;
  if (outcome === 'paid' && v.missed === 0) s += 6;
  if (outcome === 'abandoned') s -= v.abandoned === 'close' ? 8 : 20;
  if (b.type === 'book') s += 3 * (b.equip.nook || 0);
  const mg = b.emps.find(e => e.role === 'manager' && e.on); if (mg) s += 3;
  return clamp(Math.round(s), 0, 100);
}
function endVisit(S, b, c, outcome) {
  const v = c.visit, day = dayOf(S.t);
  const sat = visitSat(S, b, c, outcome);
  c.sat = Math.round(c.sat * 0.6 + sat * 0.4);
  c.loyalty = clamp(c.loyalty + (sat - 60) / 8 * (b.loyalty ? 1.5 : 1), 0, 100);
  c.visits++; c.lastVisit = S.t;
  const s = st(S, day, b.id); s.satSum += sat; s.satN++;
  if (outcome !== 'paid') { s.lost++; if (outcome === 'abandoned') c.hist.unshift({ day, t: S.t, total: 0, items: 0, note: v.abandoned === 'close' ? 'Left at closing' : 'Left the queue', sat }); else if (v.missed || v.pricey) c.hist.unshift({ day, t: S.t, total: 0, items: 0, note: v.pre ? 'Placed a preorder' : 'Found nothing to buy', sat }); }
  if (c.hist.length > 6) c.hist.length = 6;
  b.rep = clamp(b.rep + (sat - b.rep) * 0.01, 0, 100);
  b.clean = clamp(b.clean - 0.22, 0, 100);
  b.active = b.active.filter(x => x !== c.id);
  b.queue = b.queue.filter(x => x !== c.id);
  c.visit = null;
}

function basketTotal(S, b, v, wrap) {
  let sub = 0, items = 0, gifts = 0;
  for (const l of v.basket) { sub += l.unit * l.qty; items += l.qty; if (l.gift) gifts += l.qty; }
  const wrapFee = (wrap && b.equip.giftwrap) ? gifts * C(3) : 0;
  return { sub, items, gifts, wrapFee, total: sub + wrapFee };
}
function tenderFor(total, pay) {
  if (pay === 'card') return total;
  const bills = [500, 1000, 2000, 5000, 10000];
  if (Math.random() < 0.2) return total;
  const opts = bills.map(bl => Math.ceil(total / bl) * bl).filter(x => x >= total);
  return pick(opts.slice(0, 3));
}

/* checkout: returns {ok, err, change} */
function completeSale(S, bid, cid, o = {}) {
  const b = branchOf(S, bid); if (!b) return { ok: false, err: 'Branch not found.' };
  const c = b.cust[cid]; if (!c || !c.visit) return { ok: false, err: 'This customer is no longer here.' };
  const v = c.visit; if (v.phase !== 'queue' && v.phase !== 'register') return { ok: false, err: 'This customer is not at checkout.' };
  if (v.done) return { ok: false, err: 'Already paid.' };
  const day = dayOf(S.t), s = st(S, day, b.id);
  if (v.kind === 'return') {
    const r = v.data.ret; const it = b.items[r.sku];
    const amt = r.unit * r.qty;
    if (it) { it.batches.push({ id: S.seq.id++, s: 0, r: r.qty, c: r.cost, exp: null }); sortBatches(it); }
    cashTx(S, b.id, -amt, 'Refund', `Return from ${c.name}: ${r.qty} × ${itemName(b, it)}`);
    s.refunds += amt; s.cogs -= r.cost * r.qty;
    v.done = true; v.doneAt = S.t;
    c.hist.unshift({ day, t: S.t, total: -amt, items: r.qty, note: 'Returned an item', sat: 0 });
    c.spent -= amt;
    endVisit(S, b, c, 'paid');
    return { ok: true, refund: amt };
  }
  const tot = basketTotal(S, b, v, o.wrap);
  const method = payMethod(c);
  if (method === 'cash') {
    const given = o.given != null ? o.given : (v.tender || tot.total);
    if (given < tot.total) return { ok: false, err: 'Cash received is less than the total.' };
    o.change = given - tot.total;
  }
  // record
  let cogs = 0; const lines = [];
  for (const l of v.basket) {
    const it = b.items[l.sku]; const p = prodOf(b, it);
    for (const pk of l.picks) cogs += pk.c * pk.q;
    it.soldT += l.qty; it.soldAll += l.qty;
    s.cats[p.cat] = (s.cats[p.cat] || 0) + l.unit * l.qty;
    lines.push(`${l.qty}× ${itemName(b, it)}`);
    // future returns
    if ((b.type === 'clothing' && Math.random() < 0.06) || (b.type === 'toy' && Math.random() < 0.03))
      b.returnsDue.push({ cid: c.id, day: day + randi(1, 3), ret: { sku: l.sku, qty: 1, unit: l.unit, cost: l.picks[0] ? l.picks[0].c : costOf(b, it) } });
  }
  if (tot.wrapFee) { cogs += tot.gifts * 40; s.gift += tot.wrapFee; s.cats['Gift wrap'] = (s.cats['Gift wrap'] || 0) + tot.wrapFee; }
  cashTx(S, b.id, tot.total, 'Sale', `${c.name} · ${method} · ${tot.items} item${tot.items === 1 ? '' : 's'}${tot.wrapFee ? ' · gift wrap' : ''}`);
  s.rev += tot.total; s.cogs += cogs; s.served++;
  S.totals.served++; S.totals.revenue += tot.total;
  v.done = true; v.doneAt = S.t;
  c.spent += tot.total;
  c.hist.unshift({ day, t: S.t, total: tot.total, items: tot.items, note: lines.slice(0, 4).join(', ') + (lines.length > 4 ? '…' : ''), method });
  if (tot.wrapFee) c.sat = clamp(c.sat + 3, 0, 100);
  if (o.manual) v.fast = true;
  endVisit(S, b, c, 'paid');
  return { ok: true, total: tot.total, change: o.change || 0 };
}
function payMethod(c) { return (c.visit && c.visit.method) || c.pay || 'card'; }
function itemName(b, it) { if (!it) return 'item'; const p = prodOf(b, it); return p.name + (it.label ? ` (${it.label})` : ''); }

function serveStart(S, bid, cid) {
  const b = branchOf(S, bid), c = b && b.cust[cid];
  if (!c || !c.visit || c.visit.phase !== 'queue') return { ok: false, err: 'That customer is already being served or has left.' };
  c.visit.phase = 'register'; c.visit.by = 'you';
  if (c.visit.kind !== 'return' && c.visit.tender == null) c.visit.tender = tenderFor(basketTotal(S, b, c.visit, true).total, payMethod(c));
  return { ok: true };
}
function serveCancel(S, bid, cid) {
  const b = branchOf(S, bid), c = b && b.cust[cid];
  if (c && c.visit && c.visit.phase === 'register' && c.visit.by === 'you') { c.visit.phase = 'queue'; c.visit.by = null; }
}

/* ---------- inventory ops ---------- */
function toShelf(S, b, sku, want) {
  const it = b.items[sku]; if (!it) return 0;
  if (!b.listed[it.pid]) return 0;
  const p = prodOf(b, it); const room = shelfMaxOf(b, p) - itShelf(it);
  let q = Math.min(room, want == null ? 1e9 : want); let moved = 0;
  for (const x of it.batches) { if (q <= 0) break; const n = Math.min(x.r, q); x.r -= n; x.s += n; q -= n; moved += n; }
  return moved;
}
function fillAll(S, b, budget) {
  let moved = 0; budget = budget == null ? 1e9 : budget;
  const list = Object.values(b.items).filter(it => b.listed[it.pid] && itStock(it) > 0)
    .map(it => ({ it, ratio: itShelf(it) / shelfMaxOf(b, prodOf(b, it)) })).filter(x => x.ratio < 1).sort((a, c) => a.ratio - c.ratio);
  for (const { it } of list) { if (budget <= 0) break; const m = toShelf(S, b, it.sku, budget); moved += m; budget -= m; }
  return moved;
}
function setListed(S, b, pid, on) {
  const T = TYPES[b.type], p = T.pmap[pid];
  if (!p) return { ok: false, err: 'Unknown product.' };
  if (on) {
    if (b.listed[pid]) return { ok: true };
    if (!b.depts.includes(p.cat)) return { ok: false, err: `Open the ${p.cat} department first (Equipment & upgrades).` };
    const f = T.facingOf(p);
    if (facingsUsed(b)[f] >= facings(b)[f]) return { ok: false, err: `No free ${T.facings[f].toLowerCase()}. Remove a product or buy more display space.` };
    b.listed[pid] = true; return { ok: true };
  }
  delete b.listed[pid];
  for (const it of Object.values(b.items)) if (it.pid === pid) for (const x of it.batches) { x.r += x.s; x.s = 0; }
  return { ok: true };
}

/* ---------- suppliers, purchase orders, deliveries ---------- */
function supDiscount(b, supId) { return Math.min(5, Math.floor((b.supRel[supId] || 0) / 20)) / 100; }
function supUnit(b, supId, sku) {
  const sup = SUPPLIERS[supId], it = b.items[sku];
  return Math.round(costOf(b, it) * sup.priceIdx * (1 - supDiscount(b, supId)));
}
function supItems(b, supId) {
  const sup = SUPPLIERS[supId], T = TYPES[b.type];
  return Object.values(b.items).filter(it => { const p = T.pmap[it.pid]; return supCarries(sup, p) && b.depts.includes(p.cat); });
}
function onOrder(S, b, sku) { let n = 0; for (const po of S.pos) if (po.bid === b.id && (po.status === 'transit' || po.status === 'arrived')) for (const l of po.lines) if (l.sku === sku) n += l.qty; return n; }
function quoteOrder(S, b, supId, lines) {
  const sup = SUPPLIERS[supId]; let sub = 0, units = 0;
  const ls = lines.filter(l => l.qty > 0).map(l => { const unit = supUnit(b, supId, l.sku); sub += unit * l.qty; units += l.qty; return { sku: l.sku, qty: l.qty, unit }; });
  return { lines: ls, sub, units, fee: sup.fee, total: sub + sup.fee };
}
function placeOrder(S, bid, supId, lines, by) {
  const b = branchOf(S, bid), sup = SUPPLIERS[supId];
  if (!b || !sup) return { ok: false, err: 'Unknown supplier.' };
  if (!b.sups.includes(supId)) return { ok: false, err: 'Sign a contract with this supplier first.' };
  const T = TYPES[b.type], day = dayOf(S.t);
  for (const l of lines) { const it = b.items[l.sku]; if (!it || !supCarries(sup, T.pmap[it.pid])) return { ok: false, err: 'This supplier does not carry one of the items.' }; const p = T.pmap[it.pid]; if (b.type === 'book' && p.release > day + 2) return { ok: false, err: `${p.name} can be ordered from 2 days before its release (day ${p.release}).` }; if (!Number.isInteger(l.qty) || l.qty < 0 || l.qty > 999) return { ok: false, err: 'Quantities must be whole numbers from 0 to 999.' }; }
  const q = quoteOrder(S, b, supId, lines);
  if (!q.lines.length) return { ok: false, err: 'Add at least one item.' };
  if (q.sub < sup.minOrder) return { ok: false, err: `Minimum order is ${money(sup.minOrder)} before the delivery fee.` };
  if (S.cash < q.total) return { ok: false, err: `Not enough cash. This order costs ${money(q.total)}.` };
  const free = freeSpace(S, b);
  if (q.units > free) return { ok: false, err: `This order is ${q.units} units, but your stockroom only has room for ${Math.max(0, free)} more (counting deliveries on the way). Order less or expand the stockroom.` };
  let eta = S.t + sup.lead + randi(-20, 40);
  if (b.type === 'book') for (const l of q.lines) { const p = T.pmap[b.items[l.sku].pid]; if (p.release > day) eta = Math.max(eta, (p.release - 1) * DAY + 7 * 60); }
  const po = { id: 'PO-' + (S.seq.po++), bid, sup: supId, lines: q.lines, fee: q.fee, sub: q.sub, total: q.total, placed: S.t, eta, status: 'transit', by: by || 'you' };
  S.pos.unshift(po);
  cashTx(S, bid, -q.total, 'Purchase order', `${po.id} · ${sup.name} · ${q.units} units`);
  const s = st(S, day, bid); s.purchases += q.sub; s.fees += q.fee;
  if (S.pos.length > 300) { const keep = S.pos.filter(p => p.status === 'transit' || p.status === 'arrived'); const closed = S.pos.filter(p => !(p.status === 'transit' || p.status === 'arrived')).slice(0, 200); S.pos = [...keep, ...closed].sort((a, c) => c.placed - a.placed); }
  return { ok: true, po };
}
function arrive(S, po) {
  const sup = SUPPLIERS[po.sup];
  po.status = 'arrived'; po.arrivedAt = S.t;
  for (const l of po.lines) {
    l.delivered = Math.random() > sup.rel ? Math.floor(l.qty * rand(0.3, 0.85)) : l.qty;
    l.dmg = Math.random() < 0.06 && l.delivered > 0 ? Math.min(l.delivered, randi(1, 2)) : 0;
  }
  const short = po.lines.some(l => l.delivered < l.qty || l.dmg);
  note(S, po.bid, short ? 'warn' : 'info', `Delivery ${po.id} from ${sup.name} has arrived${short ? ' with discrepancies' : ''}. Review it in Deliveries.`);
}
function deliveryIn(po) { return po.lines.reduce((a, l) => a + l.delivered - l.dmg, 0); }
function acceptDelivery(S, poId, by) {
  const po = S.pos.find(p => p.id === poId); if (!po) return { ok: false, err: 'Order not found.' };
  if (po.status !== 'arrived') return { ok: false, err: 'This delivery has already been handled.' };
  const b = branchOf(S, po.bid); if (!b) return { ok: false, err: 'Branch not found.' };
  const need = deliveryIn(po), free = stockCap(b) - stockUsed(b);
  if (need > free) return { ok: false, err: `Not enough stockroom space: this delivery needs ${need} units and ${Math.max(0, free)} are free. Move stock to shelves or expand the stockroom.` };
  const T = TYPES[b.type]; let credit = 0;
  for (const l of po.lines) {
    const good = l.delivered - l.dmg; const it = b.items[l.sku];
    if (good > 0) addBatch(S, it, T.pmap[it.pid], 0, good, l.unit);
    credit += (l.qty - good) * l.unit;
  }
  po.status = 'closed'; po.closedAt = S.t; po.credit = credit; po.acceptedBy = by || 'you';
  b.supRel[po.sup] = Math.min(100, (b.supRel[po.sup] || 0) + 3);
  if (credit > 0) { cashTx(S, b.id, credit, 'Supplier credit', `${po.id}: ${po.lines.reduce((a, l) => a + l.qty - (l.delivered - l.dmg), 0)} units short or damaged`); st(S, dayOf(S.t), b.id).credits += credit; st(S, dayOf(S.t), b.id).purchases -= credit; }
  return { ok: true, credit, units: need };
}
function refuseDelivery(S, poId) {
  const po = S.pos.find(p => p.id === poId); if (!po || po.status !== 'arrived') return { ok: false, err: 'This delivery has already been handled.' };
  po.status = 'refused'; po.closedAt = S.t; po.credit = po.sub;
  const b = branchOf(S, po.bid); b.supRel[po.sup] = Math.max(0, (b.supRel[po.sup] || 0) - 5);
  cashTx(S, po.bid, po.sub, 'Supplier credit', `${po.id} refused. Delivery fee not refunded.`);
  const s = st(S, dayOf(S.t), po.bid); s.credits += po.sub; s.purchases -= po.sub;
  return { ok: true };
}
function freeSpace(S, b) {
  const inbound = S.pos.filter(p => p.bid === b.id && (p.status === 'transit' || p.status === 'arrived')).reduce((a, p) => a + p.lines.reduce((x, l) => x + l.qty, 0), 0);
  return Math.max(0, stockCap(b) - stockUsed(b) - inbound);
}
function fitToSpace(lines, free) {
  const tot = lines.reduce((a, l) => a + l.qty, 0);
  if (tot <= free) return lines;
  const k = free / tot;
  return lines.map(l => ({ sku: l.sku, qty: Math.floor(l.qty * k) })).filter(l => l.qty > 0);
}
function reorderSuggestion(S, b, supId, free) {
  const out = [];
  for (const it of supItems(b, supId)) {
    if (!b.listed[it.pid]) continue;
    const p = prodOf(b, it); if (b.type === 'book' && p.release > dayOf(S.t) + 2) continue;
    const have = itShelf(it) + itStock(it) + onOrder(S, b, it.sku);
    if (have < it.min) out.push({ sku: it.sku, qty: Math.max(it.reorder, it.min - have) });
  }
  return fitToSpace(out, free == null ? freeSpace(S, b) : free);
}
function bestSupplierFor(b, it) {
  let best = null, bu = 1e18;
  for (const sid of b.sups) { const sup = SUPPLIERS[sid]; if (!supCarries(sup, prodOf(b, it))) continue; const u = supUnit(b, sid, it.sku); if (u < bu) { bu = u; best = sid; } }
  return best;
}
function managerReorder(S, b) {
  const groups = {};
  for (const it of Object.values(b.items)) {
    if (!b.listed[it.pid]) continue;
    const p = prodOf(b, it); if (b.type === 'book' && p.release > dayOf(S.t) + 2) continue;
    const have = itShelf(it) + itStock(it) + onOrder(S, b, it.sku);
    if (have >= it.min) continue;
    const sid = bestSupplierFor(b, it); if (!sid) continue;
    (groups[sid] = groups[sid] || []).push({ sku: it.sku, qty: Math.max(it.reorder, it.min - have) });
  }
  let n = 0; let free = freeSpace(S, b);
  for (const [sid, raw] of Object.entries(groups)) {
    const lines = fitToSpace(raw, free); if (!lines.length) { note(S, b.id, 'warn', `Store manager could not reorder: the stockroom at ${b.name} is full.`); break; }
    const q = quoteOrder(S, b, sid, lines);
    if (q.sub < SUPPLIERS[sid].minOrder) { const k = Math.ceil(SUPPLIERS[sid].minOrder / Math.max(1, q.sub)); if (k > 3) continue; lines.forEach(l => l.qty *= k); }
    const r = placeOrder(S, b.id, sid, lines, 'manager');
    if (r.ok) { n++; free -= lines.reduce((a, l) => a + l.qty, 0); note(S, b.id, 'info', `Store manager placed ${r.po.id} with ${SUPPLIERS[sid].name} (${money(r.po.total)}).`); }
    else note(S, b.id, 'warn', `Store manager could not reorder from ${SUPPLIERS[sid].name}: ${r.err}`);
  }
  return n;
}
function signSupplier(S, bid, supId) {
  const b = branchOf(S, bid), sup = SUPPLIERS[supId];
  if (b.sups.includes(supId)) return { ok: false, err: 'Already signed.' };
  if (S.cash < sup.contract) return { ok: false, err: `Not enough cash. The contract costs ${money(sup.contract)}.` };
  cashTx(S, bid, -sup.contract, 'Supplier contract', sup.name); st(S, dayOf(S.t), bid).fees += sup.contract;
  b.sups.push(supId); return { ok: true };
}

/* ---------- equipment, upgrades, staff, marketing, branches ---------- */
function buyEquip(S, bid, eid) {
  const b = branchOf(S, bid), e = TYPES[b.type].equip.find(x => x.id === eid);
  if (!e) return { ok: false, err: 'Unknown equipment.' };
  if ((b.equip[eid] || 0) >= e.max) return { ok: false, err: `This store already has the maximum of ${e.max}.` };
  if (S.cash < e.cost) return { ok: false, err: `Not enough cash. ${e.name} costs ${money(e.cost)}.` };
  cashTx(S, bid, -e.cost, 'Equipment', `${e.name} for ${b.name}`); st(S, dayOf(S.t), bid).capex += e.cost; b.invested += e.cost;
  b.equip[eid] = (b.equip[eid] || 0) + 1; return { ok: true };
}
function buyUpgrade(S, bid, uid) {
  const b = branchOf(S, bid), u = TYPES[b.type].upgrades.find(x => x.id === uid);
  if (!u || b.upg.includes(uid)) return { ok: false, err: 'Already open.' };
  const need = u.need(b); if (need) return { ok: false, err: need + '.' };
  if (S.cash < u.cost) return { ok: false, err: `Not enough cash. This costs ${money(u.cost)}.` };
  cashTx(S, bid, -u.cost, 'Upgrade', `${u.name} at ${b.name}`); st(S, dayOf(S.t), bid).capex += u.cost; b.invested += u.cost;
  b.upg.push(uid); for (const c of u.cats) if (!b.depts.includes(c)) b.depts.push(c);
  return { ok: true };
}
function refreshApplicants(S, b) {
  b.apps = [];
  const roles = Object.keys(ROLES);
  for (let i = 0; i < 5; i++) {
    const r = ROLES[i < roles.length ? roles[i] : pick(roles)];
    const eff = Math.round(rand(0.7, 1.25) * 100) / 100;
    b.apps.push({ id: 'e' + (S.seq.id++), name: pick(FIRST) + ' ' + pick(LAST), role: r.id, wage: C(Math.round(rand(r.wage[0], r.wage[1]) * (0.8 + eff * 0.2) * 4) / 4), eff, rel: Math.round(rand(0.82, 0.99) * 100) / 100, exp: randi(0, 4) });
  }
}
function hire(S, bid, aid) {
  const b = branchOf(S, bid), a = b.apps.find(x => x.id === aid);
  if (!a) return { ok: false, err: 'That applicant is no longer available.' };
  b.apps = b.apps.filter(x => x !== a);
  const h = (S.t % DAY) / 60;
  Object.assign(a, { hired: dayOf(S.t), on: true, task: null, perf: 70, days: 0 });
  b.emps.push(a); return { ok: true, emp: a };
}
function fire(S, bid, eid) {
  const b = branchOf(S, bid), e = b.emps.find(x => x.id === eid); if (!e) return { ok: false, err: 'Not found.' };
  if (e.task) { const c = b.cust[e.task.cid]; if (c && c.visit && c.visit.phase === 'register') { c.visit.phase = 'queue'; c.visit.by = null; } }
  b.emps = b.emps.filter(x => x !== e); return { ok: true };
}
function runCampaign(S, bid, cid) {
  if (cid === 'brand') {
    if (S.cash < BRAND_CAMPAIGN.cost) return { ok: false, err: `Not enough cash. This costs ${money(BRAND_CAMPAIGN.cost)}.` };
    if (S.brandUntil > S.t) return { ok: false, err: 'A brand campaign is already running.' };
    cashTx(S, null, -BRAND_CAMPAIGN.cost, 'Marketing', BRAND_CAMPAIGN.name); st(S, dayOf(S.t), 'hq').mkt += BRAND_CAMPAIGN.cost;
    S.brandUntil = S.t + BRAND_CAMPAIGN.days * DAY; return { ok: true };
  }
  const b = branchOf(S, bid);
  if (cid === 'loyalty') {
    if (b.loyalty) return { ok: false, err: 'Already running.' };
    if (S.cash < LOYALTY_COST) return { ok: false, err: `Not enough cash. This costs ${money(LOYALTY_COST)}.` };
    cashTx(S, bid, -LOYALTY_COST, 'Marketing', `Loyalty program at ${b.name}`); st(S, dayOf(S.t), bid).mkt += LOYALTY_COST; b.loyalty = true; return { ok: true };
  }
  const c = CAMPAIGNS.find(x => x.id === cid);
  if (!c || (c.type && c.type !== b.type)) return { ok: false, err: 'Not available for this store.' };
  if (b.camps.some(x => x.id === cid && x.until > S.t)) return { ok: false, err: 'That campaign is already running.' };
  if (S.cash < c.cost) return { ok: false, err: `Not enough cash. This costs ${money(c.cost)}.` };
  cashTx(S, bid, -c.cost, 'Marketing', `${c.name} at ${b.name}`); st(S, dayOf(S.t), bid).mkt += c.cost;
  b.camps.push({ id: c.id, name: c.name, mult: c.mult, until: S.t + c.days * DAY });
  if (c.rep) b.rep = clamp(b.rep + c.rep, 0, 100);
  return { ok: true };
}
function tidy(S, bid) {
  const b = branchOf(S, bid);
  if (S.t - b.lastTidy < 30) return { ok: false, err: `You tidied recently. Try again in ${30 - (S.t - b.lastTidy)} minutes.` };
  b.clean = clamp(b.clean + 15, 0, 100); b.lastTidy = S.t; return { ok: true };
}
function openCost(type, loc, size) { return Math.round(TYPES[type].openCost * SIZES[size].cost * (0.7 + 0.3 * LOCS[loc].rent)); }
function rentOf(b) { return Math.round(TYPES[b.type].rent * SIZES[b.size].rent * LOCS[b.loc].rent); }
function utilOf(b) { let u = TYPES[b.type].util * SIZES[b.size].rent; for (const e of TYPES[b.type].equip) u += C(e.util) * (b.equip[e.id] || 0); return Math.round(u); }
function maintOf(b) { let n = 0; for (const v of Object.values(b.equip)) n += v; return n * 150; }
function starterStock(type, size) { // opening inventory package
  const T = TYPES[type]; const fake = { type, size, equip: {}, depts: type === 'grocery' ? [...T.startDepts] : [...T.cats], listed: {} };
  for (const e of T.equip) fake.equip[e.id] = 0;
  for (const [k, v] of Object.entries(T.startEquip)) fake.equip[k] = Math.max(1, Math.round(v * SIZES[size].eq));
  return fake;
}
function openingStockCost(S, b) {
  const T = TYPES[b.type]; let cost = 0, units = 0;
  for (const it of Object.values(b.items)) if (b.listed[it.pid]) { const p = T.pmap[it.pid]; const q = openingQty(b, p); cost += q * costOf(b, it); units += q; }
  return { cost, units };
}
function openingQty(b, p) { const m = shelfMaxOf(b, p); return b.type === 'clothing' ? m : b.type === 'grocery' ? Math.round(m * 1.25) : Math.round(m * 1.5); }
function openBranch(S, o) {
  if (!TYPES[o.type] || !LOCS[o.loc] || !SIZES[o.size]) return { ok: false, err: 'Pick a type, location and size.' };
  const name = String(o.name || '').trim().slice(0, 40); if (!name) return { ok: false, err: 'Give the store a name.' };
  if (S.branches.some(b => b.name.toLowerCase() === name.toLowerCase())) return { ok: false, err: 'You already have a store with that name.' };
  const cost = openCost(o.type, o.loc, o.size);
  const b = createBranch(S, { type: o.type, name, loc: o.loc, size: o.size });
  let stock = { cost: 0, units: 0 }; if (o.stock) stock = openingStockCost(S, b);
  const gc = o.grand ? C(500) : 0;
  const total = cost + stock.cost + gc;
  if (S.cash < total) { S.branches.pop(); S.seq.br--; return { ok: false, err: `Not enough cash. Opening costs ${money(total)} and you have ${money(S.cash)}.` }; }
  cashTx(S, b.id, -cost, 'Branch opening', `${name}: ${SIZES[o.size].label} ${TYPES[o.type].short.toLowerCase()} store at ${LOCS[o.loc].name}`);
  st(S, dayOf(S.t), b.id).capex += cost; b.invested = cost;
  if (o.stock) {
    const T = TYPES[b.type];
    for (const it of Object.values(b.items)) if (b.listed[it.pid]) { const p = T.pmap[it.pid]; const q = openingQty(b, p); const sh = Math.min(q, shelfMaxOf(b, p)); addBatch(S, it, p, sh, q - sh, costOf(b, it)); }
    cashTx(S, b.id, -stock.cost, 'Opening inventory', `${stock.units} units for ${name}`); st(S, dayOf(S.t), b.id).purchases += stock.cost;
  }
  if (o.cashier) { const a = b.apps.filter(x => x.role === 'cashier').sort((x, y) => x.wage - y.wage)[0]; if (a) hire(S, b.id, a.id); }
  if (gc) { cashTx(S, b.id, -gc, 'Marketing', `Grand opening at ${name}`); st(S, dayOf(S.t), b.id).mkt += gc; b.camps.push({ id: 'grand', name: 'Grand opening', mult: 1.8, until: S.t + 2 * DAY }); }
  chargeDaily(S, b, dayOf(S.t));
  note(S, b.id, 'good', `${name} is open for business.`);
  return { ok: true, b };
}
function sellValue(S, b) { let inv = 0; for (const it of Object.values(b.items)) for (const x of it.batches) inv += (x.s + x.r) * x.c; return Math.round(b.invested * 0.5 + inv * 0.6); }
function sellBranch(S, bid) {
  if (S.branches.length <= 1) return { ok: false, err: 'You cannot sell your only store.' };
  const b = branchOf(S, bid); if (!b) return { ok: false, err: 'Not found.' };
  const v = sellValue(S, b);
  for (const po of S.pos) if (po.bid === bid && (po.status === 'transit' || po.status === 'arrived')) po.status = 'cancelled';
  cashTx(S, null, v, 'Branch sale', `Sold ${b.name}`);
  S.branches = S.branches.filter(x => x !== b);
  note(S, null, 'info', `You sold ${b.name} for ${money(v)}.`);
  return { ok: true, value: v };
}
function setStatus(S, bid, status) {
  const b = branchOf(S, bid);
  if (status === 'closed') for (const cid of [...b.active]) { const c = b.cust[cid]; if (c && c.visit) abandon(S, b, c, 'close'); }
  b.status = status; return { ok: true };
}

/* ---------- daily cycle ---------- */
function chargeDaily(S, b, day) {
  const rent = rentOf(b), util = Math.round(utilOf(b) * (b.status === 'open' ? 1 : 0.4)), maint = maintOf(b);
  cashTx(S, b.id, -rent, 'Rent', `${b.name}, day ${day}`);
  cashTx(S, b.id, -(util + maint), 'Utilities', `${b.name}: power, water and equipment upkeep`);
  const s = st(S, day, b.id); s.rent += rent; s.util += util; s.maint += maint;
}
function dayStart(S) {
  const day = dayOf(S.t);
  for (const b of S.branches) {
    // spoilage
    let lost = 0, units = 0;
    for (const it of Object.values(b.items)) {
      for (const x of it.batches) if (x.exp != null && x.exp < day && x.s + x.r > 0) { lost += (x.s + x.r) * x.c; units += x.s + x.r; x.s = 0; x.r = 0; }
      cleanBatches(it); it.soldY = it.soldT; it.soldT = 0; it.missT = 0;
    }
    if (units) { st(S, day - 1, b.id).spoil += lost; note(S, b.id, 'warn', `${units} expired units thrown out at ${b.name} (${money(lost)} at cost).`); }
    chargeDaily(S, b, day);
    for (const e of b.emps) { if (e.on) { e.days++; e.eff = Math.min(1.5, Math.round((e.eff + 0.004) * 1000) / 1000); } releaseTask(b, e); e.on = Math.random() < e.rel; if (!e.on) note(S, b.id, 'warn', `${e.name} (${ROLES[e.role].label.toLowerCase()}) called in sick today.`); }
    refreshApplicants(S, b);
    b.camps = b.camps.filter(c => c.until > S.t);
    b.fitBusy = 0; b.clean = clamp(b.clean + 12, 0, 100);
    // returns & preorders scheduled
    for (const r of b.returnsDue.filter(r => r.day <= day)) b.sched.push({ cid: r.cid, at: day * DAY - DAY + randi(9 * 60, 19 * 60), kind: 'return', data: { ret: r.ret } });
    b.returnsDue = b.returnsDue.filter(r => r.day > day);
    if (b.type === 'book') {
      const T = TYPES.book;
      const rel = b.preorders.filter(p => T.pmap[p.pid].release <= day);
      for (const p of rel) b.sched.push({ cid: p.cid, at: day * DAY - DAY + randi(10 * 60, 20 * 60), kind: 'preorder', data: { forced: { pid: p.pid, opts: Object.keys(T.pmap[p.pid].fmts).map(f => `${p.pid}|${f}`), qty: 1 } } });
      if (rel.length) note(S, b.id, 'info', `${rel.length} preorder customers will come in today for new releases at ${b.name}.`);
      b.preorders = b.preorders.filter(p => T.pmap[p.pid].release > day);
      for (const p of T.catalog) if (p.release === day) note(S, b.id, 'good', `New release today: ${p.name} by ${p.author}.`);
      b._best = Object.values(b.items).sort((a, c) => c.soldAll - a.soldAll).slice(0, 5).map(it => it.pid);
    }
  }
  // toy trend
  if (S.market.hotUntil <= S.t && Math.random() < 0.5) {
    const p = pick(TOYS.filter(x => !x.col));
    S.market.hot = p.id; S.market.hotUntil = S.t + randi(2, 4) * DAY;
    if (S.branches.some(b => b.type === 'toy')) note(S, null, 'good', `Trending: ${p.name} is the toy everyone wants this week.`);
  }
  // daily summary
  const y = S.stats[day - 1];
  if (y) {
    let rev = 0, net = 0, served = 0;
    for (const [bid, s] of Object.entries(y)) { rev += s.rev - s.refunds; net += netOf(s); served += s.served; }
    S.totals.bestDay = Math.max(S.totals.bestDay, net);
    note(S, null, net >= 0 ? 'good' : 'warn', `Day ${day - 1} closed: revenue ${money(rev)}, net profit ${money(net)}, ${served} customers served.`);
  }
}
function netOf(s) { return s.rev - s.refunds - s.cogs - s.rent - s.util - s.wages - s.mkt - s.fees - s.maint - s.spoil; }

/* ---------- per-minute simulation ---------- */
function step(S) {
  S.t++;
  const mod = S.t % DAY;
  if (mod === 0) dayStart(S);
  for (const b of S.branches) branchMinute(S, b, mod);
  for (const po of S.pos) if (po.status === 'transit' && S.t >= po.eta) arrive(S, po);
  if (S.t % 30 === 0) checkGoals(S);
}
function branchMinute(S, b, mod) {
  if (b.status !== 'open') return;
  const day = dayOf(S.t), T = TYPES[b.type];
  const mgr = b.emps.find(e => e.role === 'manager' && e.on);
  const boost = mgr ? 1.1 : 1;
  if (mod === 360 && mgr) managerReorder(S, b);
  // wages at the end of each open hour
  if (mod > OPEN && mod <= CLOSE && (mod - OPEN) % 60 === 0) {
    let w = 0; for (const e of b.emps) if (e.on) w += e.wage;
    if (w) { cashTx(S, b.id, -w, 'Wages', `${b.name}, ${fmtTime(S.t - 60)}–${fmtTime(S.t)}`); st(S, day, b.id).wages += w; }
  }
  // arrivals
  if (mod >= OPEN && mod < LAST_ENTRY) {
    const n = poisson(arrivalRate(S, b) / 60);
    for (let i = 0; i < n; i++) {
      const pool = Object.values(b.cust).filter(c => !c.visit && S.t - c.lastVisit > 300);
      const cap = Math.min(160, 40 + b.rep * 2);
      let c = null;
      if (pool.length && (Object.keys(b.cust).length >= cap || Math.random() > 0.2)) c = wpick(pool, x => (1 + x.loyalty / 12) * (x.sat < 30 ? 0.3 : 1) * (x.type === 'holiday' ? holidayW(day) : 1));
      if (!c) c = genCustomer(S, b);
      startVisit(S, b, c);
    }
  }
  // scheduled visits (returns, preorder pickups)
  if (b.sched.length && mod >= OPEN && mod < LAST_ENTRY) {
    const due = b.sched.filter(x => x.at <= S.t); b.sched = b.sched.filter(x => x.at > S.t);
    for (const x of due) { const c = b.cust[x.cid]; if (!c) continue; if (c.visit) { x.at = S.t + 30; b.sched.push(x); continue; } startVisit(S, b, c, x.kind, x.data); }
  }
  // customer progress
  for (const cid of [...b.active]) {
    const c = b.cust[cid]; if (!c || !c.visit) { b.active = b.active.filter(x => x !== cid); continue; }
    const v = c.visit;
    if (v.phase === 'browsing' && (S.t >= v.until || mod >= CLOSE)) finishBrowse(S, b, c);
    else if (v.phase === 'fitwait') {
      if (tryFit(S, b, c)) { v.fitWaited = S.t - v.fitSince; }
      else if (S.t - v.fitSince > c.patience || mod >= CLOSE) { abandon(S, b, c, 'fitting'); }
    } else if (v.phase === 'fitting' && S.t >= v.until) {
      b.fitBusy = Math.max(0, b.fitBusy - 1);
      if (v.basket.length > 1 && Math.random() < 0.2) { const l = v.basket.pop(); returnPicks(S, b.items[l.sku], l.picks); }
      else if (v.basket.length === 1 && Math.random() < 0.12) { abandon(S, b, c, 'fit'); continue; }
      toQueue(S, b, c);
    }
    // customers in the checkout line wait as long as it takes; there is no time limit
  }
  // staff
  const staffHours = mod >= OPEN - 60 && mod < SHUT + 15;
  if (staffHours || b.queue.length) {
    const regs = b.equip.register || 1; let lane = 0;
    for (const e of b.emps) {
      if (!e.on) continue;
      if (!staffHours && e.role !== 'cashier') continue;
      if (e.role === 'cashier') {
        lane++; if (lane > regs) { e.task = { idle: 'No free register' }; continue; }
        if (e.task && e.task.cid) {
          if (S.t >= e.task.until) { const r = completeSale(S, b.id, e.task.cid, { auto: true, wrap: true }); e.task = null; if (r.ok) e.perf = Math.min(100, e.perf + 0.2); }
        }
        if (!e.task || !e.task.cid) {
          const nextId = b.queue.find(id => { const c = b.cust[id]; return c && c.visit && c.visit.phase === 'queue'; });
          if (nextId) { const c = b.cust[nextId]; c.visit.phase = 'register'; c.visit.by = e.id; const items = c.visit.basket.reduce((a, l) => a + l.qty, 0); e.task = { cid: nextId, until: S.t + Math.max(1, Math.round((1.4 + items * 0.12) / (e.eff * boost))) }; }
          else e.task = null;
        }
      } else if (e.role === 'stocker' && mod % 10 === 0 && mod >= OPEN - 60 && mod < CLOSE) {
        const m = fillAll(S, b, Math.round(35 * e.eff * boost)); e.task = m ? { label: `Restocked ${m} units` } : { label: 'Shelves are full' };
      } else if (e.role === 'receiver' && mod % 5 === 0) {
        const po = S.pos.find(p => p.bid === b.id && p.status === 'arrived' && S.t - p.arrivedAt >= Math.round(10 / e.eff));
        if (po) { const r = acceptDelivery(S, po.id, e.name); e.task = { label: r.ok ? `Received ${po.id}` : 'Stockroom is full' }; if (!r.ok && !po.warned) { po.warned = true; note(S, b.id, 'warn', `${e.name} could not receive ${po.id}: ${r.err}`); } }
      } else if (e.role === 'cleaner' && mod % 15 === 0 && mod >= OPEN && mod < CLOSE) {
        b.clean = clamp(b.clean + 2.2 * e.eff * boost, 0, 100); e.task = { label: 'Cleaning the floor' };
      } else if (e.role === 'manager') e.task = { label: 'Supervising the store' };
    }
  }
  if (mod === SHUT + 15 && !b.queue.length) for (const e of b.emps) releaseTask(b, e);
}
function releaseTask(b, e) {
  if (e.task && e.task.cid) { const c = b.cust[e.task.cid]; if (c && c.visit && c.visit.phase === 'register' && c.visit.by === e.id) { c.visit.phase = 'queue'; c.visit.by = null; } }
  e.task = null;
}
function checkGoals(S) {
  for (const g of GOALS) if (!S.goals[g.id] && g.test(S)) { S.goals[g.id] = dayOf(S.t); note(S, null, 'good', `Goal reached: ${g.text}.`); }
}
function skipNight(S) { // fast-forward to 07:45 if store hours are over
  let guard = 0; const target = (OPEN - 15);
  while ((S.t % DAY) !== target && guard < DAY) { step(S); guard++; }
}
function isNight(S) { const m = S.t % DAY; return m >= SHUT + 15 || m < OPEN - 30; }

/* ---------- reporting ---------- */
function sumStats(S, d0, d1, bid) {
  const out = { rev:0, refunds:0, cogs:0, gift:0, rent:0, util:0, wages:0, mkt:0, fees:0, maint:0, spoil:0, purchases:0, credits:0, capex:0, cin:0, cout:0, served:0, lost:0, visits:0, satSum:0, satN:0, missed:0, cats:{} };
  for (let d = d0; d <= d1; d++) {
    const day = S.stats[d]; if (!day) continue;
    for (const [k, s] of Object.entries(day)) {
      if (bid && bid !== k) continue;
      for (const f of Object.keys(out)) if (f !== 'cats') out[f] += s[f];
      for (const [c, v] of Object.entries(s.cats)) out.cats[c] = (out.cats[c] || 0) + v;
    }
  }
  out.opex = out.rent + out.util + out.wages + out.mkt + out.fees + out.maint;
  out.gross = out.rev - out.refunds - out.cogs;
  out.net = out.gross - out.opex - out.spoil;
  return out;
}
function invValue(b) { let v = 0; for (const it of Object.values(b.items)) for (const x of it.batches) v += (x.s + x.r) * x.c; for (const c of Object.values(b.cust)) if (c.visit) for (const l of c.visit.basket) for (const pk of l.picks) v += pk.q * pk.c; return v; }
function money(c) { const neg = c < 0; c = Math.abs(Math.round(c)); return (neg ? '−$' : '$') + Math.floor(c / 100).toLocaleString('en-US') + '.' + String(c % 100).padStart(2, '0'); }

/* Check that inventory, baskets and orders are internally consistent. Used by tests and the admin screen. */
function audit(S) {
  const issues = [];
  for (const b of S.branches) {
    for (const it of Object.values(b.items)) for (const x of it.batches) if (x.s < 0 || x.r < 0 || !Number.isFinite(x.s) || !Number.isFinite(x.r)) issues.push(`${b.name}: negative stock on ${it.sku}`);
    for (const cid of b.queue) { const c = b.cust[cid]; if (!c || !c.visit) issues.push(`${b.name}: queue holds a customer who is not visiting`); }
    for (const cid of b.queue) { const v = b.cust[cid] && b.cust[cid].visit; if (v && v.phase === 'register' && v.by !== 'you' && !b.emps.some(e => e.id === v.by && e.task && e.task.cid === cid)) issues.push(`${b.name}: customer stuck at a register nobody is running`); }
    if (new Set(b.queue).size !== b.queue.length) issues.push(`${b.name}: customer appears twice in queue`);
    for (const [pid, on] of Object.entries(b.listed)) if (on && !TYPES[b.type].pmap[pid]) issues.push(`${b.name}: unknown listed product`);
    const fu = facingsUsed(b), fc = facings(b); for (const k of Object.keys(fu)) if (fu[k] > fc[k]) issues.push(`${b.name}: more products listed than ${k} facings`);
  }
  if (!Number.isFinite(S.cash)) issues.push('Cash is not a number');
  if (new Set(S.pos.map(p => p.id)).size !== S.pos.length) issues.push('Duplicate purchase order IDs');
  return issues;
}

G.RE = { C, DAY, OPEN, CLOSE, SHUT, LAST_ENTRY, MON, DOW, LOCS, SIZES, TYPES, SUPPLIERS, ROLES, CAMPAIGNS, BRAND_CAMPAIGN, LOYALTY_COST, GOALS, FMT_LABEL,
  dayOf, dateOf, fmtDate, fmtTime, newGame, step, skipNight, isNight, facings, facingsUsed, stockCap, stockUsed, itShelf, itStock, prodOf, shelfMaxOf, refPrice, costOf, avgCost, effPrice, saleOn,
  arrivalRate, seasonMult, typeLabel, custType, basketTotal, completeSale, payMethod, serveStart, serveCancel, itemName, toShelf, fillAll, setListed,
  supUnit, supItems, freeSpace, supCarries, supDiscount, onOrder, quoteOrder, placeOrder, acceptDelivery, refuseDelivery, deliveryIn, reorderSuggestion, signSupplier,
  buyEquip, buyUpgrade, hire, fire, runCampaign, tidy, openCost, rentOf, utilOf, maintOf, openBranch, openingStockCost, starterStock, sellBranch, sellValue, setStatus,
  sumStats, netOf, invValue, money, audit, branchOf, note, st, itemsOf, createBranch };
})(typeof window !== 'undefined' ? window : globalThis);
