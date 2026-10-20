# Build with YOU

A neubrutalist tech-school site. **Phase 1 of every course is free forever**; a $4.99/month
**Pro membership** unlocks the intermediate and advanced phases and directly funds the creator.

- **`index.html`** — the whole page (nav, hero, marquee, why, learning paths, courses, resources, membership, community, FAQ, footer, course modal)
- **`checkout.html`** — the Pro membership checkout page (same theme, same background engine)
- **`styles.css`** — the neubrutalist design system + the fixed animated background layer
- **`script.js`** — background engine, scroll orchestration, course modal / phase locks / paywall
- **`checkout.js`** — payment form logic (validation, formatting, success state)
- **`serve.ps1`** — tiny dev server (no Node/Python needed)

## Run it

Double-click `index.html` — it works straight from the filesystem.

Or serve it (recommended, so the Google Fonts load normally):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\serve.ps1 -Port 8080
# -> http://127.0.0.1:8080/
```

## The animated background

The background is a **fixed** layer (canvas + parallax grid + grain), so it never scrolls with the
document and never repaints while content moves over it.

- One `requestAnimationFrame` loop drives everything (background, parallax, progress bar, nav state)
- Scrolling **advances the animation phase** and shifts the blob field — the further you scroll, the
  more the background changes
- Scroll **velocity** makes the blobs pulse
- A `setInterval` fallback keeps the animation alive in environments where rAF is paused
  (background tabs, throttled frames), so the background is never static or dead

The checkout page runs the same engine (`checkout.js`).

## Membership

| Plan | Price | What you get |
|---|---|---|
| **Free** | $0 forever | Phase 1 of all 42 courses, every lab, all docs & roadmaps, forum access |
| **Pro** | $4.99 / month | Every phase of every course, full source & datasets, priority code review, certificates |

The `#membership` section shows this as two columns plus a Free-vs-Pro comparison table.

## Courses, phases & the paywall

Every course card has an **Enroll Free** button that opens a phase-by-phase breakdown:

| Phase | State | What happens |
|---|---|---|
| Phase 1 — Beginner | Free, open | Full lesson list + hands-on lab |
| Phase 2 — Intermediate | Locked + blurred | "Locked — complete Phase 1 to unlock" + the $4.99/month membership offer |
| Phase 3 — Advanced | Locked + blurred | Same |

Clicking **Join Pro** redirects to `checkout.html?course=<id>&phase=<id>&name=<title>`, which keeps
the course context. After a successful (demo) payment the page sets `localStorage.bwy_pro = "1"` and
sends the learner back to `index.html?course=<id>&phase=<id>#courses`, where the course modal reopens
with every phase unlocked.

Course data lives in the `COURSES` object in `script.js` — add a course there and a matching
`data-enroll="id"` button to use it.

> The checkout is a **demo**: it validates the card (Luhn, expiry, CVC) but does not process a real
> payment and nothing leaves the browser. Swap the `setTimeout` in `checkout.js` for a Stripe
> Checkout session to make it live.

## Responsive check

`_test/harness.html` shows the site side by side at 1400px, 900px and 390px.
