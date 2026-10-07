# Table orders, the POS and calling the waiter

When a guest opens the menu from a table's QR code, the selection goes to the restaurant's POS screen instead of WhatsApp. When the menu is opened any other way (the restaurant's general QR code, a link, a search), nothing changes and the selection still goes out on WhatsApp.

## What the guest sees

- The table's QR code opens the menu with the table's key in the address (`?t=<key>`). The menu says which table it is, the selection button reads "Send order to the kitchen", and a "Call waiter" button stays on screen.
- Before sending, the phone is asked where it is. If the restaurant checks location (see below) and the guest says no, nothing is sent and the guest is told why. There is deliberately no WhatsApp fallback from a table.
- After sending, the guest sees "Order 12 is sent" with the table. There is no order tracking on the guest side yet.
- A table name typed into the address (`?table=5`, which older printed codes use) still labels a WhatsApp order, but it can never place a POS order: only the unguessable key can. Reprint table codes after switching table ordering on. The QR page says so.

## What the staff see

`/admin/pos` (the "Orders" item in the admin menu, only on plans that include table ordering).

- A live board: New, Preparing, Ready, plus a list of what finished in the last three hours. Each order shows its number, table, dishes, the guest's note and the total.
- A new order plays two soft notes. A waiter call plays three rising, louder notes and **repeats every seven seconds until someone taps "On my way"**, so it cannot be missed in a kitchen. The two sounds are different on purpose.
- Browsers only allow sound after a tap on the page, so the screen has a "Turn on sound" button. If it was on last time the screen says the browser blocked it, instead of staying silently quiet.
- The tab title shows how many things need attention, for example `(3) Table orders`.
- A dot shows whether the live connection is up. If it drops, the board refreshes by itself when it returns, so nothing that happened meanwhile is missed, and it also refreshes every 30 seconds as a safety net.
- Any signed in account of the restaurant can move an order. There are no separate cashier and kitchen roles yet.

Order steps: New, Preparing, Ready, Served, and Canceled from any of the first three. Steps cannot be skipped and a served or canceled order cannot be reopened. If two people tap at once, one wins and the other is told the order changed.

Waiter calls: Open, On my way (stops the sound), Done. A second tap from the same table while a call is open does not make a second call.

## Is the guest at the restaurant

Settings are under "Location check" on the POS page: the restaurant's latitude and longitude (with a "use my current location" button to fill them from the phone you are holding), a radius in meters (30 to 2000, 150 by default) and an on/off switch.

The guest's phone reports where it is. The server measures the distance to the restaurant and accepts the order when it is within the radius, widened by the phone's own accuracy estimate up to 100 meters because indoors a fix is often off by tens of meters. A fix worse than 1 km, a missing position, and an impossible one are all refused.

- If the owner has not set a position, orders are accepted from anywhere and the POS page shows a warning saying so.
- Be honest with yourself about what this is: the position comes from the guest's phone, and someone determined can fake it. It stops orders sent from home by mistake or as a prank. It is not proof of presence. The unguessable table key, per table and per device rate limits, and staff being able to cancel an order are the other layers.
- The demo restaurants have the check off, because a demo visitor is not in Hebron.

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

- The guest cannot see their order's progress.
- Separate cashier and kitchen accounts, kitchen printers, payment at the table, splitting a bill.
- Notification when no staff screen is open (orders wait on the board until someone opens it).
- A stronger proof of presence than the phone's position (for example a code printed on the table that changes daily).
