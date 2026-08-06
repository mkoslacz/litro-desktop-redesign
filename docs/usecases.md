# Product use cases

Generated from `usecases.json`. The matrix is declared rather than a full cross-product: every switch option is documented and appears in at least one product use case.

## State reference

### Account (`auth`)

Whether the visitor is signed in to a LITRO account. This decides whether FRIENDS loyalty credits are shown as a usable balance or as an invitation to sign in, and whether saved traveller data pre-fills checkout.

| Option | Meaning |
| --- | --- |
| `out` — Guest | Not signed in. FRIENDS appears as a prompt ("sign in to collect credits") rather than a balance, and checkout asks for every traveller field. This is the default, because most production traffic arrives cold from search or a campaign. |
| `in` — Member | Signed in. The FRIENDS balance is real and spendable — 1 credit = 1 RON, earned at the 2/3/5% tier bands, valid five years, and capped at 10% of the booking it is spent on. Credits are forfeited on cancellation, so the cap and the expiry are stated wherever the balance is offered. |

### Session (`session`)

How the visitor reached the hotel page. A visitor who arrived from our own listing has already accepted the dates and party, so the page can commit to a rate; a cold visitor from Google has not, and must be able to change the search without losing the page.

| Option | Meaning |
| --- | --- |
| `new` — New visitor | Landed directly on the hotel page, typically from a search engine or a shared link. The search bar stays editable and prominent, and the price shown is qualified by the dates it assumes. |
| `site` — From our site | Arrived from the LITRO listing with dates and party already chosen. The page leads with the rate and the booking bar rather than re-asking the search question. |

### Demo inventory (`inv`)

How much availability the demo search returns. This is the axis that decides whether the funnel is a shop or a rescue operation, and it is the one reviewers never reach by accident. It also drives the "phone as a scalpel" model: the call centre (0241 999, 10:00–18:00) is deliberately quiet when there is plenty to buy and loud when there is not.

| Option | Meaning |
| --- | --- |
| `many` — Many | 1 236 properties — the whole coast, the default cold-entry result. Self-service e-commerce carries the page; the phone number is present in the header but never interrupts. |
| `some` — Some | About a dozen results, a realistic mid-season or narrowed-filter outcome. Sorting and filtering start to matter more than browsing, and date flexibility is suggested but not pushed. |
| `few` — Few | Two or three results left. The scarcity state: the date-flexibility banner appears and the call centre becomes a visible offer, because a consultant can reach allotment the website cannot. |
| `zero` — Zero | Nothing available for the chosen dates. The empty state must never be a dead end — it offers nearby resorts, adjacent dates and the phone, since a consultant can still place a request-based booking. |

### Card view (`density`)

How much of a property a listing card shows. The most-argued decision in the redesign, so it is a switch rather than a rebuild: the same result set is legible as a browsing surface or as a comparison table.

| Option | Meaning |
| --- | --- |
| `a` — Detailed | The full card: photo gallery, guest quote, perks, room types and the price block. Best when a visitor is still deciding where to go. |
| `b` — Compact | Photo, name, score and price, with the secondary meta dropped. Roughly twice as many properties per screen, for a visitor who is comparing rather than discovering. |
| `c` — Icons | The densest row: amenities reduced to icons and the quote removed. This is the closest the listing comes to a spreadsheet, and it is where the beach-distance meta earns its place. |

### Results per page (`per`)

How many properties one page of results holds before the pager. This is a product question, not a constant: it moves the list and the pager together and decides how much weight sorting carries.

| Option | Meaning |
| --- | --- |
| `10` — 10 | The pager reaches the first screen, so sorting and filtering do the work. Shortest scroll, most pagination. |
| `20` — 20 | The middle setting: a substantial page that still ends within a few screens. |
| `30` — 30 | A long browsing page, closest to today's production behaviour. Thirty cards is a long scroll before anyone meets the pager. |

### Room types on card (`rooms`)

Whether a listing card expands to show its room types and their separate rates. Rooms are allocated at reception, so a room type on the card is a price signal rather than a promise of a specific room.

| Option | Meaning |
| --- | --- |
| `on` — Yes | Each card can be expanded to its room types, so the cheapest bookable unit is visible without opening the property. Note that the sunbed inclusion ("+ 2 șezlonguri incluse la plajă") lives in the unit name and is a real differentiator. |
| `off` — No | Cards show one lead price and no room breakdown. A shorter list, at the cost of making the visitor open a property to learn what the price actually buys. |

### Filter column (`stf`)

Whether the listing's filter column is pinned and scrolls independently of the results. Disabled automatically in export mode, where a full-page capture would otherwise crop the column to one screen.

| Option | Meaning |
| --- | --- |
| `on` — Sticky | Filters stay on screen for the whole result list and scroll inside their own column. Refiltering never requires scrolling back to the top. |
| `off` — Flows | The filter column scrolls away with the page, as production does today. Simpler, and it gives the results the full height of the viewport. |

### Sticky search bar · Homepage (`sthome`)

Whether the homepage keeps a collapsed search pill under the header once the big search box has scrolled out of view.

| Option | Meaning |
| --- | --- |
| `on` — Yes | A compact pill appears under the header after the hero box leaves the screen, reopening the same search editor. The visitor can restate the search from anywhere on the page. |
| `off` — No | Nothing is pinned; changing the search means scrolling back to the hero. This is today's production behaviour. |

### Sticky search bar · Listing (`stlist`)

Whether the listing keeps the search bar docked at the top while the results scroll.

| Option | Meaning |
| --- | --- |
| `on` — Yes | The bar docks into the header on scroll and collapses to a single row, so dates and party stay one click away throughout a long result page. |
| `off` — No | The search bar scrolls away with the page header. |

### Sticky search bar · Hotel (`sthotel`)

Whether the hotel page keeps the search bar docked while the visitor reads down the property.

| Option | Meaning |
| --- | --- |
| `on` — Yes | Dates stay editable from anywhere on the property page — the point where a cold visitor most often discovers the dates were assumed, not chosen. |
| `off` — No | The search bar scrolls away and the booking bar alone carries the dates. |

### Pinned card (`pin`)

How a campaign offer is pinned into the homepage hero carousel. LITRO runs roughly fifteen named offer programmes at once (Oferta Verii, Last Minute, Litoralul Pentru Toți, Extra Discount and the rest), so the homepage needs a defined slot for the one being pushed this week.

| Option | Meaning |
| --- | --- |
| `off` — No | No pinned card. The carousel is purely editorial and every offer competes on equal footing. |
| `inline` — Row | The campaign sits as the first card in the carousel row, framed rather than tinted. It reads as part of the offer, which is what production creative expects. |
| `banner` — Banner | The campaign becomes a wide band above the carousel. The loudest option, for a genuine seasonal push. |

### Photos (`assets`)

Whether the screens use the prototype's clean stock photography or the real photo base scraped from litoralulromanesc.ro. Only the images change — copy, prices and behaviour are untouched.

| Option | Meaning |
| --- | --- |
| `proto` — Prototype | Stock photography from the Szallas design sandbox. Flattering, consistent crops — good for judging layout, misleading about production. |
| `prod` — Production | The real photos from the live site: inconsistent crops, portrait phone shots, campaign badges burned into the JPEG, properties with no spa photo at all. This is the honest test of whether the layout survives the photo base we actually have. |

## UC-01 — Cold entry — the whole coast, nothing chosen yet

Someone arrives from Google or a campaign with no resort in mind. The default search is the entire coast rather than one resort, so the first screen shows the breadth of the offer (1 236 properties) before asking anyone to narrow anything. This is the baseline every other use case is a deviation from.

### State

| Axis | Selected option | Meaning |
| --- | --- | --- |
| Account (`auth`) | `out` — Guest | Not signed in. FRIENDS appears as a prompt ("sign in to collect credits") rather than a balance, and checkout asks for every traveller field. This is the default, because most production traffic arrives cold from search or a campaign. |
| Session (`session`) | `new` — New visitor | Landed directly on the hotel page, typically from a search engine or a shared link. The search bar stays editable and prominent, and the price shown is qualified by the dates it assumes. |
| Demo inventory (`inv`) | `many` — Many | 1 236 properties — the whole coast, the default cold-entry result. Self-service e-commerce carries the page; the phone number is present in the header but never interrupts. |
| Card view (`density`) | `a` — Detailed | The full card: photo gallery, guest quote, perks, room types and the price block. Best when a visitor is still deciding where to go. |
| Results per page (`per`) | `30` — 30 | A long browsing page, closest to today's production behaviour. Thirty cards is a long scroll before anyone meets the pager. |
| Room types on card (`rooms`) | `on` — Yes | Each card can be expanded to its room types, so the cheapest bookable unit is visible without opening the property. Note that the sunbed inclusion ("+ 2 șezlonguri incluse la plajă") lives in the unit name and is a real differentiator. |
| Filter column (`stf`) | `on` — Sticky | Filters stay on screen for the whole result list and scroll inside their own column. Refiltering never requires scrolling back to the top. |
| Sticky search bar · Homepage (`sthome`) | `on` — Yes | A compact pill appears under the header after the hero box leaves the screen, reopening the same search editor. The visitor can restate the search from anywhere on the page. |
| Sticky search bar · Listing (`stlist`) | `on` — Yes | The bar docks into the header on scroll and collapses to a single row, so dates and party stay one click away throughout a long result page. |
| Sticky search bar · Hotel (`sthotel`) | `on` — Yes | Dates stay editable from anywhere on the property page — the point where a cold visitor most often discovers the dates were assumed, not chosen. |
| Pinned card (`pin`) | `inline` — Row | The campaign sits as the first card in the carousel row, framed rather than tinted. It reads as part of the offer, which is what production creative expects. |
| Photos (`assets`) | `proto` — Prototype | Stock photography from the Szallas design sandbox. Flattering, consistent crops — good for judging layout, misleading about production. |

### Screens and deep links

- **desktop** — [home-c.html](../home-c.html?auth=out&session=new&inv=many&density=a&per=30&rooms=on&stf=on&sthome=on&stlist=on&sthotel=on&pin=inline&assets=proto)
- **desktop** — [listing-c.html](../listing-c.html?auth=out&session=new&inv=many&density=a&per=30&rooms=on&stf=on&sthome=on&stlist=on&sthotel=on&pin=inline&assets=proto)
- **desktop** — [hotel.html](../hotel.html?auth=out&session=new&inv=many&density=a&per=30&rooms=on&stf=on&sthome=on&stlist=on&sthotel=on&pin=inline&assets=proto)

### Engineering rules

- The default search is the whole coast, not a pre-selected resort — the visitor sees the offer first and picks the area second.
- Counts come from production, not from the mock: the coast total is 1 236 and Mamaia returns 81 units, not a rounder invented number.
- The call centre is present in the header but does not interrupt; at this inventory level self-service carries the funnel.

## UC-02 — Returning member spends FRIENDS credits

A signed-in member who came through our own listing books a property and pays down part of it with loyalty credits. The whole commercial argument for the account lives in this path, so both the balance and its limits have to be visible at the moment of spending, not buried in terms.

### State

| Axis | Selected option | Meaning |
| --- | --- | --- |
| Account (`auth`) | `in` — Member | Signed in. The FRIENDS balance is real and spendable — 1 credit = 1 RON, earned at the 2/3/5% tier bands, valid five years, and capped at 10% of the booking it is spent on. Credits are forfeited on cancellation, so the cap and the expiry are stated wherever the balance is offered. |
| Session (`session`) | `site` — From our site | Arrived from the LITRO listing with dates and party already chosen. The page leads with the rate and the booking bar rather than re-asking the search question. |
| Demo inventory (`inv`) | `many` — Many | 1 236 properties — the whole coast, the default cold-entry result. Self-service e-commerce carries the page; the phone number is present in the header but never interrupts. |
| Card view (`density`) | `a` — Detailed | The full card: photo gallery, guest quote, perks, room types and the price block. Best when a visitor is still deciding where to go. |
| Results per page (`per`) | `30` — 30 | A long browsing page, closest to today's production behaviour. Thirty cards is a long scroll before anyone meets the pager. |

### Screens and deep links

- **desktop** — [listing-c.html](../listing-c.html?auth=in&session=site&inv=many&density=a&per=30)
- **desktop** — [hotel.html](../hotel.html?auth=in&session=site&inv=many&density=a&per=30)
- **desktop** — [checkout.html](../checkout.html?auth=in&session=site&inv=many&density=a&per=30)
- **desktop** — [thankyou.html](../thankyou.html?auth=in&session=site&inv=many&density=a&per=30)

### Engineering rules

- 1 credit = 1 RON; credits are capped at 10% of the booking they are spent on and are forfeited if the booking is cancelled — state both wherever the balance is offered.
- The price block separates what is paid now from taxa de stațiune (1% of the tariff ex-VAT), which is paid at reception.
- Confirmation is per rate: each rate carries either "Confirmare instantă" or "Confirmare în max. 2 ore". Never promise instant confirmation globally.
- The consent tick is unticked by default and the CTA stays gated until it is ticked; marketing consent is a separate, optional tick.

## UC-03 — Last rooms on the coast — scarcity

Peak August, and the search comes back with two or three properties. This is where the funnel stops being a shop: the page has to offer a way out (other dates, other resorts) and put the consultant in front of the visitor, because a consultant can reach request-based allotment the website cannot.

### State

| Axis | Selected option | Meaning |
| --- | --- | --- |
| Demo inventory (`inv`) | `few` — Few | Two or three results left. The scarcity state: the date-flexibility banner appears and the call centre becomes a visible offer, because a consultant can reach allotment the website cannot. |
| Card view (`density`) | `b` — Compact | Photo, name, score and price, with the secondary meta dropped. Roughly twice as many properties per screen, for a visitor who is comparing rather than discovering. |
| Account (`auth`) | `out` — Guest | Not signed in. FRIENDS appears as a prompt ("sign in to collect credits") rather than a balance, and checkout asks for every traveller field. This is the default, because most production traffic arrives cold from search or a campaign. |

### Screens and deep links

- **desktop** — [listing-c.html](../listing-c.html?inv=few&density=b&auth=out)

### Engineering rules

- At low inventory the date-flexibility banner appears and the phone becomes a visible offer — this is the "phone as a scalpel" trigger, not a permanent overlay.
- The call centre is open 10:00–18:00; a scarcity state shown outside those hours must not imply someone will answer now.
- Scarcity messaging follows real availability, never a countdown invented to create pressure.

## UC-04 — Nothing free for those dates — the empty state

The search returns zero. Production today leaves the visitor with a near-empty page and a phone number; the redesign has to treat an empty result as a routing problem — adjacent dates, nearby resorts, and a consultant who can still place a request-based booking.

### State

| Axis | Selected option | Meaning |
| --- | --- | --- |
| Demo inventory (`inv`) | `zero` — Zero | Nothing available for the chosen dates. The empty state must never be a dead end — it offers nearby resorts, adjacent dates and the phone, since a consultant can still place a request-based booking. |
| Account (`auth`) | `out` — Guest | Not signed in. FRIENDS appears as a prompt ("sign in to collect credits") rather than a balance, and checkout asks for every traveller field. This is the default, because most production traffic arrives cold from search or a campaign. |

### Screens and deep links

- **desktop** — [listing-c.html](../listing-c.html?inv=zero&auth=out)
- **mobile** — [m-listing.html](../m-listing.html?inv=zero&auth=out)

### Engineering rules

- An empty result is never a dead end: nearby resorts, adjacent dates and the phone are all offered on the same screen.
- Phone-only capabilities are named honestly — instalments, holiday-card bookings, gift vouchers, cancellations and storno all still require a consultant today.
- The empty state must survive export: it is reachable as ?inv=zero on both viewports, so it lands in Figma as a frame instead of a click.

## UC-05 — Mid-season — a dozen properties, sorting starts to matter

A realistic shoulder-season search, or a cold-entry search after two filters. There is still a choice to make but not an overwhelming one, and with a short page the pager reaches the first screen, which puts the weight on sorting rather than scrolling.

### State

| Axis | Selected option | Meaning |
| --- | --- | --- |
| Demo inventory (`inv`) | `some` — Some | About a dozen results, a realistic mid-season or narrowed-filter outcome. Sorting and filtering start to matter more than browsing, and date flexibility is suggested but not pushed. |
| Results per page (`per`) | `10` — 10 | The pager reaches the first screen, so sorting and filtering do the work. Shortest scroll, most pagination. |
| Card view (`density`) | `a` — Detailed | The full card: photo gallery, guest quote, perks, room types and the price block. Best when a visitor is still deciding where to go. |

### Screens and deep links

- **desktop** — [listing-c.html](../listing-c.html?inv=some&per=10&density=a)

### Engineering rules

- Facet values and their counts come from the live site, including negative ones — "pets not allowed" is data, not an omission.
- Offer programmes are the same properties sliced into packages; a property may legitimately appear under several programmes.

## UC-06 — Comparing, not browsing — the dense list

A visitor who already knows the resort and is now comparing price against score across as many properties as will fit. The card collapses to its comparable facts and the room breakdown comes off, turning the listing into something closer to a table.

### State

| Axis | Selected option | Meaning |
| --- | --- | --- |
| Card view (`density`) | `c` — Icons | The densest row: amenities reduced to icons and the quote removed. This is the closest the listing comes to a spreadsheet, and it is where the beach-distance meta earns its place. |
| Results per page (`per`) | `20` — 20 | The middle setting: a substantial page that still ends within a few screens. |
| Room types on card (`rooms`) | `off` — No | Cards show one lead price and no room breakdown. A shorter list, at the cost of making the visitor open a property to learn what the price actually buys. |
| Demo inventory (`inv`) | `many` — Many | 1 236 properties — the whole coast, the default cold-entry result. Self-service e-commerce carries the page; the phone number is present in the header but never interrupts. |

### Screens and deep links

- **desktop** — [listing-c.html](../listing-c.html?density=c&per=20&rooms=off&inv=many)

### Engineering rules

- Beach distance stays on the card at every density — it is the litoral-specific comparison axis and the reason the filter group exists.
- With room types off, the lead price must still say what it buys; rooms are allocated at reception, so a room type is a price signal rather than a promise.

## UC-07 — Judging the design on the real photo base

The design review that decides whether this layout can actually ship. Every image is swapped for the real one from litoralulromanesc.ro, so the screens are judged on the photo base LITRO has rather than on stock photography that flatters the grid.

### State

| Axis | Selected option | Meaning |
| --- | --- | --- |
| Photos (`assets`) | `prod` — Production | The real photos from the live site: inconsistent crops, portrait phone shots, campaign badges burned into the JPEG, properties with no spa photo at all. This is the honest test of whether the layout survives the photo base we actually have. |
| Demo inventory (`inv`) | `many` — Many | 1 236 properties — the whole coast, the default cold-entry result. Self-service e-commerce carries the page; the phone number is present in the header but never interrupts. |
| Card view (`density`) | `a` — Detailed | The full card: photo gallery, guest quote, perks, room types and the price block. Best when a visitor is still deciding where to go. |

### Screens and deep links

- **desktop** — [home-c.html](../home-c.html?assets=prod&inv=many&density=a)
- **desktop** — [listing-c.html](../listing-c.html?assets=prod&inv=many&density=a)
- **desktop** — [hotel.html](../hotel.html?assets=prod&inv=many&density=a)

### Engineering rules

- Only the pictures change — copy, prices and behaviour are identical to the prototype photo mode, so the comparison is honest.
- All thirteen properties the prototype names by hand exist in production; a card shows that property's own photos.
- If a layout only works on clean 16:9 crops, it does not work — that is the finding, not a reason to re-crop the production pack.

## UC-08 — Seasonal campaign takes the homepage

A named programme — Oferta Verii, Last Minute, Litoralul Pentru Toți — is being pushed this week and needs the loudest slot the homepage has. The campaign becomes a wide band above the carousel rather than competing as one card among many.

### State

| Axis | Selected option | Meaning |
| --- | --- | --- |
| Pinned card (`pin`) | `banner` — Banner | The campaign becomes a wide band above the carousel. The loudest option, for a genuine seasonal push. |
| Account (`auth`) | `out` — Guest | Not signed in. FRIENDS appears as a prompt ("sign in to collect credits") rather than a balance, and checkout asks for every traveller field. This is the default, because most production traffic arrives cold from search or a campaign. |
| Demo inventory (`inv`) | `many` — Many | 1 236 properties — the whole coast, the default cold-entry result. Self-service e-commerce carries the page; the phone number is present in the header but never interrupts. |

### Screens and deep links

- **desktop** — [home-c.html](../home-c.html?pin=banner&auth=out&inv=many)
- **desktop** — [home-d.html](../home-d.html?pin=banner&auth=out&inv=many)

### Engineering rules

- The pinned slot carries real production creative, not a placeholder; "Super ofertele verii" is an existing campaign asset.
- Offer-expiry countdowns are commercial machinery that exists in production — a redesign that silently drops them is a revenue cut disguised as a cleanup.

## UC-09 — Nothing pinned, nothing docked — the quiet page

The control case for every sticky decision in the prototype. No campaign is pinned, no search bar docks on any of the three page kinds, and the filter column scrolls away with the page — which is broadly what production does today. It exists so the docking arguments can be settled by comparison rather than by assertion.

### State

| Axis | Selected option | Meaning |
| --- | --- | --- |
| Pinned card (`pin`) | `off` — No | No pinned card. The carousel is purely editorial and every offer competes on equal footing. |
| Filter column (`stf`) | `off` — Flows | The filter column scrolls away with the page, as production does today. Simpler, and it gives the results the full height of the viewport. |
| Sticky search bar · Homepage (`sthome`) | `off` — No | Nothing is pinned; changing the search means scrolling back to the hero. This is today's production behaviour. |
| Sticky search bar · Listing (`stlist`) | `off` — No | The search bar scrolls away with the page header. |
| Sticky search bar · Hotel (`sthotel`) | `off` — No | The search bar scrolls away and the booking bar alone carries the dates. |
| Demo inventory (`inv`) | `many` — Many | 1 236 properties — the whole coast, the default cold-entry result. Self-service e-commerce carries the page; the phone number is present in the header but never interrupts. |

### Screens and deep links

- **desktop** — [home-c.html](../home-c.html?pin=off&stf=off&sthome=off&stlist=off&sthotel=off&inv=many)
- **desktop** — [listing-c.html](../listing-c.html?pin=off&stf=off&sthome=off&stlist=off&sthotel=off&inv=many)

### Engineering rules

- This is the closest state to today's production behaviour and is the honest "before" for any claim the redesign makes about search persistence.
- Each page kind docks independently: the homepage, the listing and the hotel page are three separate decisions, not one.

## UC-10 — Mobile web — the whole flow on a phone

Mobile web is a separate file set with its own engine, because the flows genuinely differ: sheets instead of popovers, a booking bar that rises from the bottom, filters on a full screen. The same state and the same price model carry over from desktop through a shared localStorage key, so a reviewer can switch viewport mid-flow without losing the search.

### State

| Axis | Selected option | Meaning |
| --- | --- | --- |
| Account (`auth`) | `out` — Guest | Not signed in. FRIENDS appears as a prompt ("sign in to collect credits") rather than a balance, and checkout asks for every traveller field. This is the default, because most production traffic arrives cold from search or a campaign. |
| Demo inventory (`inv`) | `many` — Many | 1 236 properties — the whole coast, the default cold-entry result. Self-service e-commerce carries the page; the phone number is present in the header but never interrupts. |
| Card view (`density`) | `a` — Detailed | The full card: photo gallery, guest quote, perks, room types and the price block. Best when a visitor is still deciding where to go. |
| Results per page (`per`) | `30` — 30 | A long browsing page, closest to today's production behaviour. Thirty cards is a long scroll before anyone meets the pager. |

### Screens and deep links

- **mobile** — [m-home.html](../m-home.html?auth=out&inv=many&density=a&per=30)
- **mobile** — [m-listing.html](../m-listing.html?auth=out&inv=many&density=a&per=30)
- **mobile** — [m-hotel.html](../m-hotel.html?auth=out&inv=many&density=a&per=30)

### Engineering rules

- Mobile is a separate file set (m-*.html), not a media query — the token block is shared verbatim, the components are not.
- The legal identity travels with every screen at both viewports: S.C. Creative Eye S.R.L., Licența de Turism nr. 536, ANPC and Ministry of Tourism contacts.
- Prices are never all-in on mobile either: taxa de stațiune stays a separate "De plătit la hotel" line.

