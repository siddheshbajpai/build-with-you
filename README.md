# Build with YOU

A neubrutalist tech-school site where every course is free.

- **`index.html`** — the whole page (nav, hero, marquee, why, learning paths, courses, resources, community, FAQ, footer, course modal)
- **`styles.css`** — the neubrutalist design system + the fixed animated background layer
- **`script.js`** — background engine, scroll orchestration, course modal / phase locks / paywall
- **`serve.ps1`** — tiny dev server (no Node/Python needed)

## Run it

Double-click `index.html` — it works straight from the filesystem.

Or serve it (recommended, so the Google Fonts load normally):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\serve.ps1 -Port 8080
# -> http://localhost:8080/
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

## Courses & the paywall

Every course card has an **Enroll Free** button that opens a phase-by-phase breakdown:

| Phase | State | What happens |
|---|---|---|
| Phase 1 — Beginner | Free, open | Full lesson list + hands-on lab |
| Phase 2 — Intermediate | Locked + blurred | "Locked — complete Phase 1 to unlock" + the $4.99/month membership offer |
| Phase 3 — Advanced | Locked + blurred | Same |

Clicking a locked phase shows the **Pro membership** panel: **$4.99 / month** (nominal, cancel anytime).
Joining unlocks every phase of every course and shows a confirmation toast. Phase 1 stays free forever.

Course data lives in the `COURSES` object in `script.js` — add a course there and a matching
`data-enroll="id"` button to use it.

## Responsive check

`_test/harness.html` shows the site side by side at 1400px, 900px and 390px.
