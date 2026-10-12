# Table orders, the POS and calling the waiter

When a guest opens the menu from a table's QR code, the selection goes to the restaurant's POS screen instead of WhatsApp. When the menu is opened any other way (the restaurant's general QR code, a link, a search), nothing changes and the selection still goes out on WhatsApp.

## What the guest sees

- The table's QR code opens the menu with the table's key in the address (`?t=<key>`). The menu says which table it is, the selection button reads "Send order to the kitchen", and a "Call waiter" button stays on screen.
- Before sending, the phone is asked where it is. If the restaurant checks location (see below) and the guest says no, nothing is sent and the guest is told why. There is deliberately no WhatsApp fallback from a table.
- After sending, the guest sees their order with a four step progress bar (Received, Preparing, Ready, Served) that **updates live** as staff move it, or a clear message if the restaurant canceled it. It survives a reload: a small "Order 12: Preparing" button stays on the menu until the guest taps Done after it is served or canceled. The guest follows the order with a private random token only they hold; it shows the number and status and nothing about what was ordered.
- A table name typed into the address (`?table=5`, which older printed codes use) still labels a WhatsApp order, but it can never place a POS order: only the unguessable key can. Reprint table codes after switching table ordering on. The QR page says so.

## What the staff see

`/admin/pos` (the "Orders" item in the admin menu, only on plans that include table ordering).

- A live board: New, Preparing, Ready, plus a list of what finished in the last three hours. Each order shows its number, table, dishes, the guest's note and the total.
- A new order plays two soft notes. A waiter call plays three rising, louder notes and **repeats every seven seconds until someone taps "On my way"**, so it cannot be missed in a kitchen. The two sounds are different on purpose.
- Browsers only allow sound after a tap on the page, so the screen has a "Turn on sound" button. If it was on last time the screen says the browser blocked it, instead of staying silently quiet.
- The tab title shows how many things need attention, for example `(3) Table orders`.
- A dot shows whether the live connection is up. If it drops, the board refreshes by itself when it returns, so nothing that happened meanwhile is missed, and it also refreshes every 30 seconds as a safety net.
- Accounts have a role, set on the Team page (`/admin/team`, owners only):
  - **Owner**: everything.
  - **Cashier**: only the orders screen. Sees prices, moves orders through served or canceled, answers waiter calls. Cannot change the location settings.
  - **Kitchen**: only the orders screen, with no prices, no waiter calls and no cancel button. Can mark an order preparing and then ready, and nothing after that. Its live connection never receives waiter calls.
  - A cashier or kitchen account lands on the orders screen after signing in. Every other page under `/admin` is refused to them **by default** (a page added later is owners only until someone opens it to staff), and the same rules are enforced on the server for each action, so a hidden button is not the only barrier.
  - Changing someone's role, resetting their password or removing them signs them out immediately. The last owner of a restaurant can never be demoted or removed, and nobody can change their own role or remove themselves.
  - Staff accounts count toward the plan's account limit (shown as "Team accounts"). A new account gets a generated password, shown once, and an email with a link to choose their own.

Order steps: New, Preparing, Ready, Served, and Canceled from any of the first three. Steps cannot be skipped and a served or canceled order cannot be reopened. If two people tap at once, one wins and the other is told the order changed.

Waiter calls: Open, On my way (stops the sound), Done. A second tap from the same table while a call is open does not make a second call.

## Reports

`/admin/reports` (owners only, plans with analytics). Numbers for **table orders** in the restaurant's own time (Asia/Hebron), for today, the last 7, 30 or 90 days, or any range of up to a year:

- Orders, revenue, average order, dishes sold, and canceled orders with their share. Canceled orders are never in the revenue.
- Orders and revenue per day (days with nothing show as zero), the busiest hours, the most ordered dishes (sizes of one dish add up as that dish), the busiest tables, and waiter calls with the average time to answer.
- **Download CSV**: one row per ordered dish for the chosen period, canceled orders included and marked, for accounting. It opens correctly in Excel in Arabic, and any cell that begins with `=`, `+`, `-` or `@` is defused so a dish named like a formula cannot run anything.
- Orders sent on WhatsApp are not counted, because the restaurant never sees them. If orders in more than one currency exist only the busiest currency is added up, and the page says so.
- A day is the restaurant's day: an order placed at 00:30 local time is on the new day even though it is still the previous day in UTC. This is tested around midnight at both ends of a range.

## Is the guest at the restaurant

Settings are under "Location check" on the POS page: the restaurant's latitude and longitude (with a "use my current location" button to fill them from the phone you are holding), a radius in meters (30 to 2000, 150 by default) and an on/off switch.

The guest's phone reports where it is. The server measures the distance to the restaurant and accepts the order when it is within the radius, widened by the phone's own accuracy estimate up to 100 meters because indoors a fix is often off by tens of meters. A fix worse than 1 km, a missing position, and an impossible one are all refused.

- If the owner has not set a position, orders are accepted from anywhere and the POS page shows a warning saying so.
- Be honest with yourself about what this is: the position comes from the guest's phone, and someone determined can fake it. It stops orders sent from home by mistake or as a prank. It is not proof of presence. The unguessable table key, per table and per device rate limits, and staff being able to cancel an order are the other layers.
- The demo restaurants have the check off, because a demo visitor is not in Hebron.

## How the guest follows an order

The order response carries a random `track` token. The menu keeps it in the browser, asks `GET /m/:slug/orders/:token` for the status (the session cookie must match the order), and also listens on a websocket namespace `/track` where the token plus a session ticket are the way in and only that one order's status is ever sent. If websockets are unavailable it polls every 8 seconds. A wrong, guessed or foreign token, an order id, or another restaurant's slug all answer 404 / `unknown_order`.

## Table sessions: who may see a bill

The QR code only names the table. What lets a guest see a bill or follow an order is membership of the table's current **session** (one party's visit, model `TableSession`).

- The first table order on a table with no open session starts one; later orders attach to it. The database allows only one open session per table (a partial unique index in the migration). Orders and waiter calls store the `sessionId`.
- Placing an order sets the cookie `qaemati_ts` (httpOnly, SameSite=Lax, path `/m/<slug>`), holding the session id and a signature. Nothing is kept in localStorage.
- **Guests who each place an order at the same table join the same open session and share one bill.** That is intended: a table is one party. Someone who only scans the code joins nothing and has to order first.
- "My bill", the bill request, order tracking and the `/track` websocket all answer from the session the cookie proves. With no cookie, a cookie for a closed or idle session, or one for another table or restaurant, the bill is empty and an order answers 404, the same as for a code that does not exist.
- The websocket cannot receive the cookie (its path is `/socket.io`), so the page asks `GET /m/:slug/tables/session-ticket` and sends the 60 second ticket in the handshake. A socket of a session that closes is told and cut off.
- Staff check out closes the open session in the same transaction that frees the table, so the cookie stops working at once. A session with no order, call or bill request for `TABLE_SESSION_IDLE_HOURS` (default 6) counts as closed when read, and an hourly job closes it and frees the table unless the table was scanned since. The job claims each row with a conditional update, so running on several servers is safe, and it follows `REMINDERS_ENABLED`.
- Orders made before sessions existed have no session and cannot be looked up by any guest. Staff screens and reports do not use sessions.

## Safeguards

- The server prices every order from the database. The browser sends only which dish, which size and which extras, and quantities. Names, prices and totals it might add are rejected, and a dish that is switched off, outside its serving hours, or belongs to another restaurant is refused.
- Every order stores its own copy of names and prices, so changing the menu later never changes an order already taken.
- Order numbers are taken with an atomic counter per restaurant, so two orders arriving together never share a number.
- Limits: 8 orders per table and 15 per device per 10 minutes, waiter calls 12 per device per 10 minutes and one per table every 20 seconds. All use the shared rate limit store.
- A subscription that is over takes table ordering offline with the public menu. A plan without `tableOrdering` returns the menu to WhatsApp.
- Tenant isolation: every staff query is scoped to the session's restaurant, other restaurants' orders and calls answer 404, and the websocket room comes from the session and never from anything the client sends.

## How the live part works

- Staff screens connect to a Socket.IO namespace `/pos`. It reads the same login session as the rest of the site, so there is no second sign in, and it refuses any browser whose `Origin` is not this site, so another website cannot open one with a visitor's cookie.
- An event carries only its type and an id (`order.new`, `order.updated`, `call.new`, `call.updated`). The screen then asks the server for the board, which checks the session again. Order contents never travel over the socket.
- Events move between server instances with Postgres `LISTEN` / `NOTIFY` (`PosEventBus`), so a guest connected to one instance reaches a cashier connected to another with nothing extra to run. If the listening connection is down, the event is delivered to the instance's own screens instead of being lost.
- Caddy proxies websockets with no extra configuration.

## Not built

- Kitchen printers, payment at the table, splitting a bill, a waiter role distinct from cashier.
- Notification when no staff screen is open (orders wait on the board until someone opens it).
- A stronger proof of presence than the phone's position (for example a code printed on the table that changes daily).
