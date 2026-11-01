# Retail Empire Simulator

A browser-based retail management game. You start with one small grocery store and grow it into a company that runs grocery, clothing, toy and book stores across the city.

This is the **first playable prototype**: a single self-contained web page with no server. Open `index.html` in any modern browser to play.

## Playing

- **Career mode** starts you with $6,000 and a list of goals. **Sandbox mode** lets you pick your starting cash and try every store type right away.
- At 1× speed, one real second is one game minute. Use pause, 1×, 2× and 4× in the top bar. The space bar also pauses and resumes.
- The game saves to your browser every 10 seconds and whenever you leave the tab. While you're away, the clock stops.
- Only one tab can run the game at a time.
- **Settings & save** can copy a save code, so you can back up your game or move it to another browser.

## What's in the prototype

- **Headquarters:** company cash, today's revenue, expenses and profit, a performance table for every store, alerts, and expansion opportunities.
- **Checkout:** customers queue with their own baskets and patience. You serve them by card or cash and enter the change. Cashiers you hire take over the registers.
- **Customers:** each one has a type, a budget, tastes, price tolerance, loyalty, satisfaction and purchase history.
- **Suppliers and orders:** compare suppliers, sign contracts, and place purchase orders, either your own quantities or suggested ones. Orders are paid when placed and arrive hours later.
- **Deliveries:** a delivery must be checked in before it becomes stock. Shortages and damaged units are credited back. You can also refuse a delivery.
- **Inventory:** shelf and stockroom quantities, reorder points, low-stock and empty-shelf filters, and moving stock to the shelves.
- **Products and pricing:** decide what goes in your limited display space, and set prices. Customers compare your price with the suggested price.
- **Employees:** cashiers, stockers, delivery receivers, cleaners and store managers. A manager reorders stock below its minimum every morning.
- **Equipment and upgrades:** shelving, refrigeration, freezers, registers, fitting rooms, gift wrap stations, reading nooks, stockroom expansions, and new grocery departments.
- **Marketing:** store campaigns, a company-wide brand campaign and loyalty programs.
- **Finances:** income statements for each store and for the whole company over any period, a cash flow summary, revenue by category and by store, a 14-day chart, and a full ledger of transactions.
- **Expansion:** open any store type in any of six districts, in any order. Each district has its own foot traffic, rent and spending power.

### How the store types differ

| | Grocery | Clothing | Toy | Book |
|---|---|---|---|---|
| Stock is tracked per | product, with use-by dates | size × color | product | format (hardcover / paperback) |
| Special rules | spoilage, fridge and freezer space, departments to unlock | fitting rooms, markdowns, returns, seasonal collections | age ranges, trending toys, December peak, gift wrap | genre loyalty, new releases, preorders, bestsellers |

## Project layout

```
index.html        Built game: one self-contained file (open this to play)
build.py          Bundles src/ into index.html
src/engine.js     Game rules and simulation (no browser code; runs in Node too)
src/ui.js         Screens, dialogs, saving and the game loop
src/style.css     Styles (light and dark themes)
src/shell.html    Page template
tests/            Simulation and browser tests
```

Make your changes in `src/`, then run `python3 build.py` to rebuild `index.html`.

## Tests

```
node tests/sim.js 14      # one grocery store, played by a simple bot for 14 days
node tests/multi.js       # all four store types for 30 days
node tests/ui.js          # browser test of every screen (requires Playwright)
```

The simulation tests check the game's integrity after every game minute: no negative stock, no duplicate customers in a queue, no more products on display than there is space for, and no duplicate order numbers. If a check fails, the test stops and reports it.

## Known limitations

- Saves live only in one browser's storage. Use the save code as a backup.
- All stores spend from one company account, though every store gets its own income statement.
- The ledger keeps the latest 2,500 transactions; daily totals are kept for the whole game.
- Not built yet: online orders, delivery and pickup, regional managers, multiple cities, book events, research upgrades, and moving stock between stores.

## Next milestone

Move the game rules to a server (Next.js, TypeScript, PostgreSQL and Prisma, as in the original brief). The server would run the clock and keep saves in the database, using database transactions for checkout, deliveries and payments. `src/engine.js` is already separate from the interface, so it can be carried over largely as is.
