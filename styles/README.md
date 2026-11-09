# styles/ · design tokens and handover

`tokens.css` holds every design token; `site.css` is the page CSS. Preview every token live at
http://localhost:8002/tokens.html (local only, not linked from the site).

**Rules for this build**
- **Colour values never change in this build (D7).** Tokens carry today's exact values, so Nila's later colour pass is a one-file change in `tokens.css`.
- **Type keeps today's sizes (O7b).** Type tokens carry the sizes the site renders today. Nothing visible changes when a rule moves onto them.
- **Motion:** 5 durations, 4 easings, and `linear` for progress bars only. Loop periods, dwell times and typing speed are not tokens. They live as named constants at the top of `js/app.js`.
- New page CSS uses tokens only. Product mock UIs (Klaviyo screens inside `.lx-app`, `.k-*`, `.ao-*`, `.st-*`) may keep product-accurate sizes and radii, like the type "mock UI" exemption (proposal §5).

## Tokens

### Colour (W2-03) · today's values

| Token | Value | Use |
|---|---|---|
| `--ink` | `#2A2029` | headlines, titles, body on light surfaces |
| `--ink-70` | `rgba(42,32,41,.68)` | secondary text |
| `--body` | `rgba(42,32,41,.62)` | reading text (`.sub`, `.dd .body.dd-sub`, `.dd-biz p`) |
| `--muted` | `rgba(42,32,41,.53)` | meta text (`.sr .sv`, nav, footer) |
| `--faint` | `rgba(42,32,41,.42)` | captions outside case studies |
| `--ink-50` | `rgba(42,32,41,.5)` | dim text |
| `--muted-case` | `rgba(42,32,41,.66)` | value of `--muted` inside `.dd` (case studies) |
| `--faint-case` | `rgba(42,32,41,.6)` | value of `--faint` inside `.dd` (`.dd .cap`) |
| `--accent` (= `--holly`) | `#9C6B14` | labels (`.dd .lbl`), links, rings, fills |
| `--accent-06` / `-12` / `-25`, `--holly-08` | accent at .06 / .12 / .25 / .08 | washes |
| `--gold-on-dark` | `#EDC163` | labels and accents on the plum band |
| `--plum` | `#3B2840` | plum band (`.band.ink` via `--ink2`, `.band.hmw`), emphasis words |
| `--on-dark` / `--on-dark-body` / `--on-dark-muted` | `#fff` / `rgba(255,255,255,.62)` / `.6` | text on the plum band |
| `--page` | `#F5F1E8` | page background (middle of the body gradient) |
| `--page-from` / `--page-to` | `#F3EEE3` / `#F0ECE0` | body gradient ends |
| `--band-tint` | `#E7D9C4` | `.dd .band.tint` (the `!important` rule is the one that renders) |
| `--paper` | `#FFFFFF` | `.dd .band.paper` |
| `--surface` | `#ECE8DC` | chips, wells |
| `--line` / `--line-2` | ink at .1 / .16 | hairlines |
| `--white` | `#fff` | cards, buttons |
| `--ink-rgb`, `--white-rgb`, `--accent-rgb`, `--plum-rgb`, `--gold-rgb`, `--black-rgb` | channel triplets | alpha literals: `rgba(42,32,41,.08)` → `rgba(var(--ink-rgb),.08)`, same computed value |

Case-study status colours stay scoped to `.dd` (site.css): `--ok #1E7A45`, `--ok-soft #E3F2E8`, `--bad #B54545`, `--bad-soft #FBEAEA`, `--warm #9A6A00`, `--warm-soft #FFF3DC`, `--ink2 #3B2840` (= `--plum`).

**For W3-08:** today the page CSS has 338 distinct colour literals. Site colours move onto the tokens above, with the same values (gate check 9). Mock UI colours (`#232426`, `#6A707A`, `#4A4F57`, `#1C65AD`, `#E6E7EA` …) stay literal inside mocks.

### Contrast today (for Nila's colour pass; nothing is fixed in this build, D7)

Measured with alpha composited onto each surface (WCAG 2.x). ❌ = under 4.5:1 for normal text.

| Token | Value | on page | on tint | on paper |
|---|---|---|---|---|
| `--ink` | #2A2029 | 13.93 | 11.31 | 15.71 |
| `--ink-70` | rgba(42,32,41,0.68) | 5.17 | 4.71 | 5.49 |
| `--body` | rgba(42,32,41,0.62) | 4.33 ❌ | 3.98 ❌ | 4.50 |
| `--muted` | rgba(42,32,41,0.53) | 3.34 ❌ | 3.12 ❌ | 3.43 ❌ |
| `--faint` | rgba(42,32,41,0.42) | 2.48 ❌ | 2.38 ❌ | 2.54 ❌ |
| `--ink-50` | rgba(42,32,41,0.5) | 3.07 ❌ | 2.91 ❌ | 3.15 ❌ |
| `--muted (in .dd)` | rgba(42,32,41,0.66) | 4.87 | 4.43 ❌ | 5.12 |
| `--faint (in .dd)` | rgba(42,32,41,0.6) | 4.05 ❌ | 3.75 ❌ | 4.25 ❌ |
| `--accent #9C6B14` | #9C6B14 | 4.12 ❌ | 3.34 ❌ | 4.64 |

| On the plum band #3B2840 | Value | ratio |
|---|---|---|
| white | #FFFFFF | 13.43 |
| band body/cap | rgba(255,255,255,0.62) | 6.15 |
| band muted | rgba(255,255,255,0.6) | 5.88 |
| gold on dark | #EDC163 | 7.94 |
| white .55 | rgba(255,255,255,0.55) | 5.18 |
| white .5 | rgba(255,255,255,0.5) | 4.59 |

**Today's failures, for the colour pass:**
- `--body` 4.33:1 on the page and 3.98:1 on tint (4.50:1 on paper is right at the line).
- `--muted` 3.34:1 on the page; `--faint` 2.48:1; `--ink-50` 3.07:1.
- Inside case studies, `--faint-case` (`.dd .cap`) is 4.05:1 on the page, and `--muted-case` is 4.43:1 on tint.
- `--accent` as text: 4.12:1 on the page, 3.34:1 on tint (labels like "01 · Problem" are `.72–.8rem`, so AA-large doesn't apply).
- On the plum band, every text token passes (gold 7.94:1, body 6.15:1).
- axe counts per route are in `next-steps/build/roadmap.md` › AA exceptions (baseline m0). None may be added (gate check 4).

### Type (W2-04) · today's sizes (O7b)

| Role | Size token (today's value) | Weight | Line height | Tracking | Font | Today's rule |
|---|---|---|---|---|---|---|
| H1 | `--fs-h1` `clamp(2.4rem,6vw,3.6rem)` (57.6 → 38.4px) | `--fw-h1` 400 | `--lh-h1` 1.2 | `--tr-h1` −.035em | Geist | `.dd-hero .cs-h1` |
| H1 · home | `--fs-h1-home` `clamp(1.8rem,5vw,2.25rem)` (36 → 28.8px) | 400 | `--lh-h1-home` 1.3 | `--tr-h1-home` −.02em | Geist | `.h1` |
| H2 | `--fs-h2` `clamp(1.75rem,3.6vw,2.5rem)` (40 → 28px) | `--fw-h2` 400 | `--lh-h2` 1.15 | `--tr-h2` −.03em | Geist | `.dd .h2` (`--t1`) |
| H3 | `--fs-h3` 1.05rem (16.8px) | `--fw-h3` 500 | `--lh-h3` 1.35 | `--tr-h3` −.01em | Geist | `.dd .h3`, `.cs-subh` |
| H4 | `--fs-h4` 1rem (16px) | `--fw-h4` 500 | `--lh-h4` 1.6 | `--tr-h4` −.015em | Geist | `.sr .st` row titles |
| Body | `--fs-body` 1.05rem (16.8px) | `--fw-body` 400 | `--lh-body` 1.65 | `--tr-body` 0 | Geist | `.dd .body` (`--t2`) |
| Body · home | `--fs-body-home` 1rem (16px) | 400 | `--lh-body-home` 1.6 | 0 | Geist | `#v-home .sub` |
| Body Small | `--fs-body-s` .9rem (14.4px) | `--fw-body-s` 400 | `--lh-body-s` 1.5 | `--tr-body-s` 0 | Geist | `.sr .sv` descriptions |
| Caption | `--fs-caption` .8rem (12.8px) | `--fw-caption` 400 | `--lh-caption` 1.5 | `--tr-caption` 0 (`--tr-label` .02em on `.lbl`) | Geist Mono | `.dd .lbl`, `.dd .cap` (`--t3`) |
| Caption · UI | `--fs-caption-ui` .75rem (12px) | 400 | `--lh-caption-ui` 1.6 | 0 | Geist Mono | nav, footer |

- Instrument Serif is gone: removed from the Google Fonts request and from the tokens (`--serif` deleted). Nothing rendered it: `font-family:inherit !important` already overrode both rules that used it.
- No italics. The two dead `font-style:italic` declarations are removed. Emphasis is the plum colour (`.h1 em`, `.dd .h2 em` → `#3B2840`).
- One serif remains: a Georgia quote mark (`font-family:Georgia,serif`), not Instrument Serif.
- **Why the variants:** O7b keeps today's sizes, and today the home headline, home intro line and nav/footer labels differ from the case-study roles. The variants carry those values so nothing moves. Nila's visual pass can fold them into the 7 roles.
- **W3-08:** page classes (`.cs-h1`, `.dd .h2`, the `--t1/--t2/--t3` scale on `.dd`, the "home type system" `!important` rules) switch to these tokens route by route, with no pixel change. Mock UIs keep their 8.5–12px product sizes.

### Motion (W2-02)

| Token | Value | Use |
|---|---|---|
| `--d-1` | 120ms | press, hover colour, caret, chip, intent delay |
| `--d-2` | 200ms | tooltips, tab underline, small fades, row close |
| `--d-3` | 320ms | row expand, pane swap, dots, carousel indicator |
| `--d-4` | 450ms | block reveal, `ngUp` / `ngStream`, modal, ring move |
| `--d-5` | 520ms | the ceiling: open-case camera move, hero entrance |
| `--ease-out` (alias `--ease`) | `cubic-bezier(.22,.61,.36,1)` | default enter and exit |
| `--ease-emph` | `cubic-bezier(.16,.84,.3,1)` | big spatial moves: open-case, reveals, row expand, ring |
| `--ease-inout` | `cubic-bezier(.65,0,.25,1)` | symmetric slides only: carousel, tab content |
| `--spring` | `cubic-bezier(.34,1.4,.64,1)` | pops only (`jpPop`, `psPop`) |
| `linear` | keyword | progress bars only (`caProg`) |

**Snapping rule (synthesis values that aren't tokens):** 280 → 320, 360 → 320, 400 → 450, 480 → 450, 560 → 520. Anything over 520 ms is either a one-shot animation (snaps to `--d-5`) or a loop period (not a token).

**W2-02 replaced** every CSS literal that already equalled a token: `.2s` ×89, `.45s` ×47, `.32s` ×2, `cubic-bezier(.22,.61,.36,1)` ×38, `(.34,1.4,.64,1)` ×7, `(.65,0,.25,1)` ×5, `(.16,.84,.3,1)` ×1. Delays were left alone. No pixel changed.

**JS (WAAPI, `flipIn()`), W3-09b:** every `.animate()` reads its duration and easing from the tokens through `cssMs('--d-…')` and `cssVar('--ease-…')`: the camera move uses `--d-5` with `--ease-emph`, the rest fades and the fallback use `--d-4`, and the fallback rest uses `--d-5` with `--ease-out`. 0 literal durations or easings are left in `.animate()`. Every JS timing constant sits in one block at the top of `js/app.js` (`SEARCH`, `OPEN`, `JTBD`, `LOOP`, `INTRO`).

### What's still literal (E4 exceptions, after W3-09)

0 `cubic-bezier()` literals and 0 `ease` / `ease-in-out` / `ease-out` keywords are left in CSS. 45 duration literals remain, and every one is one of these kinds:

| Kind | Uses | Literals | Why it isn't a token |
|---|---|---|---|
| Reduced-motion kill switch | 1 | `.01ms` (animations; transitions are `0s`) | must be near zero, so `animationend` still fires; transitions are `0s` because the default `transition-property:all` would otherwise animate every property |
| Loop periods (`infinite` for the thinking dots and skeletons, otherwise a count of 2–3, W3-03) | 28 | `.8s`, `1s`, `1.05s`, `1.2s`, `1.4s`, `1.6s`, `2s`, `2.35s`, `2.4s`, `2.8s`, `3.2s`, `3.6s` | the length of one cycle (caret blink, pulse, a 3.6 s carousel dwell) isn't a transition |
| Ambient drift (hidden under reduced motion) | 7 | `7s`, `15s`–`47s` | `.spark` and the six `ngDrift`/`ngMorph` blob periods |
| Storyboard tracks in thumbnails (`.play …`, `.th .stSc`) | 8 | `1s`, `1.1s`, `1.15s`, `1.5s`, `1.9s`, `1.95s`, `6s` | one track of a choreographed timeline, mostly `steps()` typing; changing it would put the scene out of sync |
| Progress bar | 1 | `6s` (`.lw-prog`, linear) | the length of the simulated task |

**Delays:** 110 literal delays stay. They are choreography (staggers and storyboard cue points), not durations. W3-09 retimed the ones it covers: answer words, rows (40 ms, capped at 240 ms), LMS panels (80 ms), and the jobs-matrix dots (set from `JTBD` in `app.js`).

**Easing keywords that stay:** `linear` ×13 (progress bars, skeleton shimmer, the people-carousel timer, and the `.spark`/snow drift); `step-end` ×3 (caret blink); `steps(n)` ×9 (typewriter tracks).

**W3-09 retiming, by moment:**

| Moment | Now |
|---|---|
| home intro (09a) | headline words `--d-4` `--ease-emph`, 60 ms stagger, 4px blur; prefill 30 ms/char |
| answer (09a) | words rise 6px, step `min(26 ms, 1200 ms / words)` |
| hover-expand (09a) | intent 120 ms; preview fades in after 80 ms; the previous row closes in `--d-2` |
| open-case (09b) | stage and page `--d-5` `--ease-emph`; rest `--d-4` after 80 ms; heavy setup waits `--d-5` + 80 ms; the title animates **once** (rides the page rise, or the FLIP hero; no `ngStream`) |
| chapter-reveal (09b) | `opacity, transform var(--d-4) var(--ease-emph)`, 12px, no scale; colour bands are whole sections and never fade, only their content does |
| ca-carousel (09c) | swipe `--d-4` `--ease-inout` |
| sla-typeahead (09c) | 55 ms/char, dropdown +240 ms, ready +1200 ms, 6 s between runs, 2 runs |
| lms-final (09c) | panes `--d-3` `--ease-out`; panels `--d-3` with 80 ms stagger; ticks `--d-2` |
| da-guide (09c) | ring and tip `--d-3` `--ease-emph`; `pgPulse` 3 cycles; `pgDrag` 2 |
| jtbd-dots (09d) | `--d-3` `--ease-out`; the 16 grey jobs land in 0–348 ms, then the 10 gold ones in 408–580 ms; all in by 900 ms; goal label at 900 ms |

### Radii (W2-05)

| Token | Value | Use |
|---|---|---|
| `--r-xs` | 4px | bars, tags, ticks (today 1–5px) |
| `--r-sm` | 6px | inner screens, small chips (today 5–7px) |
| `--r-md` | 10px | buttons, menus, mock cards (today 8–11px) |
| `--r-lg` | 14px | cards, home rows, media (today 12–16px) |
| `--r-xl` | 20px | panels, stages, the search box (today 18–40px) |
| `--r-pill` | 99px | pills, toggles |
| `50%` | keyword | circles (not a token) |

## Radius mapping (51 values today → 6 tokens)

| Today | Uses | Becomes |
|---|---|---|
| `50%` | 61 | keep `50%` (circle) |
| `99px` | 60 | `var(--r-pill)` |
| `6px` | 47 | `var(--r-sm)` |
| `14px` | 27 | `var(--r-lg)` |
| `12px` | 23 | `var(--r-lg)` |
| `10px` | 22 | `var(--r-md)` |
| `8px` | 22 | `var(--r-md)` |
| `4px` | 22 | `var(--r-xs)` |
| `16px` | 21 | `var(--r-lg)` |
| `3px` | 19 | `var(--r-xs)` |
| `2px` | 19 | `var(--r-xs)` |
| `0` | 18 | `0` |
| `20px` | 15 | `var(--r-xl)` |
| `7px` | 13 | `var(--r-sm)` |
| `5px` | 11 | `var(--r-sm)` |
| `24px` | 9 | `var(--r-xl)` |
| `18px` | 5 | `var(--r-xl)` |
| `9px` | 4 | `var(--r-md)` |
| `11px` | 3 | `var(--r-md)` |
| `8px 8px 0 0` | 3 | `var(--r-md) var(--r-md) 0 0` |
| `22px` | 3 | `var(--r-xl)` · phone frames move to `.frame-phone` (W2-06) |
| `28px` | 2 | `var(--r-xl)` |
| `58% 42% 35% 65% / 55% 35% 65% 45%` | 2 | keep (organic blob shape, ambient) |
| `2px 2px 0 0` | 2 | `var(--r-xs) var(--r-xs) 0 0` |
| `0 !important` | 2 | `0` (keep `!important`) |
| `18px !important` | 2 | `var(--r-xl)` (keep `!important`) |
| `58% 42% 35% 65%/55% 35% 65% 45%` | 1 | keep (organic blob shape, ambient) |
| `42% 58% 65% 35%/45% 65% 35% 55%` | 1 | keep (organic blob shape, ambient) |
| `35% 65% 55% 45%/40% 60% 45% 55%` | 1 | keep (organic blob shape, ambient) |
| `0 0 28px 28px` | 1 | `0 0 var(--r-xl) var(--r-xl)` |
| `42% 58% 65% 35% / 45% 65% 35% 55%` | 1 | keep (organic blob shape, ambient) |
| `65% 35% 45% 55% / 60% 40% 50% 50%` | 1 | keep (organic blob shape, ambient) |
| `35% 65% 55% 45% / 40% 60% 45% 55%` | 1 | keep (organic blob shape, ambient) |
| `55% 45% 40% 60% / 65% 35% 55% 45%` | 1 | keep (organic blob shape, ambient) |
| `0 0 4px 4px` | 1 | `0 0 var(--r-xs) var(--r-xs)` |
| `18px 18px 6px 6px` | 1 | `var(--r-xl) var(--r-xl) var(--r-sm) var(--r-sm)` |
| `0 0 18px 18px` | 1 | `0 0 var(--r-xl) var(--r-xl)` |
| `0 0 8px 8px` | 1 | `0 0 var(--r-md) var(--r-md)` |
| `1px 1px 0 0` | 1 | `var(--r-xs) var(--r-xs) 0 0` |
| `10px 10px 0 0` | 1 | `var(--r-md) var(--r-md) 0 0` |
| `14px !important` | 1 | `var(--r-lg)` (keep `!important`) |
| `16px 16px 16px 4px` | 1 | `var(--r-lg) var(--r-lg) var(--r-lg) var(--r-xs)` |
| `4px 12px 12px 12px` | 1 | `var(--r-xs) var(--r-lg) var(--r-lg) var(--r-lg)` |
| `26px` | 1 | `var(--r-xl)` · phone frames move to `.frame-phone` (W2-06) |
| `40px` | 1 | `var(--r-xl)` · phone frames move to `.frame-phone` (W2-06) |
| `22px !important` | 1 | `var(--r-xl)` · phone frames move to `.frame-phone` (W2-06) (keep `!important`) |
| `99px !important` | 1 | `var(--r-pill)` (keep `!important`) |
| `calc(12px / var(--k,1)) !important` | 1 | keep (scales with the mock zoom `--k`) |
| `12px !important` | 1 | `var(--r-lg)` (keep `!important`) |
| `18px 18px 18px 4px` | 1 | `var(--r-xl) var(--r-xl) var(--r-xl) var(--r-xs)` |
| `0 0 16px 16px` | 1 | `0 0 var(--r-lg) var(--r-lg)` |

**Ties** (8px between 6 and 10, 12px between 10 and 14, 5px between 4 and 6) round **up**, the softer step. W3-12 applies the mapping route by route, with a before/after preview, because radii (unlike colour and type) are meant to change (fix #19).

## Device frames (W2-06)

Two components in `site.css` (end of file) replace today's five frame styles (`.ca-phone` 22px, `.ca-lock2` 26px, `.ca-frame` 40px, `.lx-screen` + `.lx-base`). Colours are today's values.

| | Laptop `.frame-laptop` | Phone `.frame-phone` |
|---|---|---|
| Markup | `.frame-laptop > .frame-screen > .frame-view` + `.frame-base` | `.frame-phone > .frame-view` |
| Screen | 16 : 10, radius `--r-sm` | 9 : 17 (`.is-auto` = content height), radius `--r-xl` + `--r-sm` (26px) |
| Bezel | `--bezel` 12px (8px under 560px), `--ink` | `--bezel` 8px ring (box-shadow) in `--ink`, plus a 1px `#4A3A48` edge |
| Outer radius | `--r-xl` top, `--r-sm` bottom; base `0 0 --r-xl --r-xl` | screen radius + bezel (34px) |
| Shadow | `0 40px 80px -40px rgba(var(--plum-rgb),.55)` | `0 40px 60px -30px rgba(var(--ink-rgb),.6)` |
| Width | 100%, max 900px | 100%, max 250px |
| Note | base overhangs 5% each side (3% on phones) | the ring takes no layout space: leave `--bezel` + 1px around it |

**Applied in W3-12, CSS only (the markup stays until routes are copy locked):**
- The laptop `.lx-screen` / `.lx-base` follows the laptop spec: `--r-xl` / `--r-sm` corners, a `--bezel` of 12px (8px under 560px), and a base that overhangs 3% under 560px.
- The phone `.ca-frame` follows the phone spec: 26px corners (`--r-xl` + `--r-sm`) instead of 40px, and an 8px ring plus a 1px `#4A3A48` edge instead of 9 + 1.
- `.ca-phone` and `.ca-lock2` got the same phone values, but no markup uses them today (dead CSS; can be deleted).

**Radii in page CSS (W3-12):** all 395 px `border-radius` literals use the six tokens, following the mapping above (1–5 → xs, 6–7 → sm, 8–11 → md, 12–16 → lg, 18–40 → xl, 99 → pill). `50%` and `0` stay. Two `calc()`s stay: the scaled thumbnail `calc(12px / var(--k,1))` and the phone `calc(var(--r-xl) + var(--r-sm))`. No radii are set inline in `data/content.js` or `index.html`.

## Loop inventory (W3-03a) and what W3-03 did

Reviewed build: 35 `infinite` CSS animations (32 rules) and 11 `setInterval`s. Verdicts:
- **demo:** runs 2 cycles, then holds its end state. It pauses off-screen, on hover and on focus, has a Pause toggle (`aria-pressed`), and shows its end state under reduced motion.
- **affordance:** stops after first use or 3 cycles.
- **illustration:** a small loop inside a thumbnail or mock. It stops after 1–2 cycles (under 5 s, WCAG 2.2.2), with no control.
- **status:** runs only while something is busy (≤ 2 s).
- **ambient:** decoration. It is still under reduced motion, and snow is hidden.

Under reduced motion the global rule now also sets `animation-iteration-count:1` (W3-03b), so nothing keeps running (gate check 2 ✅ on 15/15 routes).

### CSS loops

| Animation | Element | Route(s) | Verdict | Now |
|---|---|---|---|---|
| `ngMorph`, `ngDrift1/2` | `.amb .blob` (×3, 6 animations) | every route | ambient | unchanged; still under reduced motion |
| `ngSnow` | `.snow i` | seasonal | ambient | unchanged; hidden under reduced motion (already) |
| `ngSpin` | `.spark svg` (sparkle cursor) | none: `.spark{display:none !important}` | dead | unchanged (never renders) |
| `ngThink` | `.think .mark` | search (400 ms) | status | unchanged |
| `slxSk` | `.slx-sk` skeleton | `#subject-line` while suggestions load (≤ 650 ms) | status | unchanged |
| `goBounce`, `goRing` ×2 | `.go.nudge` (the Ask button) | `#` | affordance | 3 cycles; still removed on first use |
| `ngPulse` | `.go.ready` | `#` | affordance | 3 cycles |
| `ngBlink` | `.caret`, `.sla-car` | `#all`, `#subject-line` thumbs | affordance | 3 cycles |
| `blink`, `slaBlink` | `.slaCaret` | SLA thumbnail | affordance | 3 cycles |
| `hxTw` | `.hx-chips button.on::after` | chips | affordance | 3 cycles |
| `cptPulse` | `.dd-int > button.on + button b` | `#discount` | affordance | 3 cycles |
| `aoNudge` | `.ao-live .ao-sw:not(.on)` | `#audience` | affordance | 3 cycles |
| `pgPulse` | `.pg-ring` (guide ring) | `#discount`, `#channel-affinity` | affordance | 3 cycles, then a solid ring |
| `pgDrag` | `.pt-guide.drag .pg-ghost` | `#discount` | affordance | 2 cycles |
| `stTick` | `.th .stSc` (clock in the Send Time thumb) | `#`, `#all` | illustration | 1 cycle (6 s) |
| `dxScan`, `dxDot` | `.play .dxScan`, `.dxDots circle` | Data XRay thumb | illustration | 2 cycles |
| `dpDash` | `.dp-line polyline` | Discount mock | illustration | 2 cycles |
| `kvStripe2` | `.st-pg i` | `#audience` mock | illustration | 2 cycles |
| `slaSh` | `.sla-sk i` | SLA thumb (`#all`, `#subject-line`) | illustration | 2 cycles |
| `lwBlink`, `lwProg` | `.lw-type i`, `.lw-prog i` | LMS thumb (`#all`, `#lms`) | illustration | 2 cycles / 1 cycle (6 s) |
| `lmPress`, `lmPane` ×2, `lmBob` | `.lm-m1`, `.lm-m3` concept mocks | `#lms` | demo | 2 cycles, start in view, Pause per mock, pause on hover/focus/off-screen |
| `lmPress` | `.lm-fd .bt .cw` | `#lms` final design | demo | 2 cycles; paused with the storyboard's toggle |

### JS timers

| Timer | Route | Verdict | Now |
|---|---|---|---|
| `ask()` thinking timer, 100 ms (`.t` in the live region) | `#` | fake latency | removed (W3-02) |
| `ask()` quip rotation, 520 ms | `#` | fake latency | removed (W3-02) |
| focus-card replay `setInterval(…,6500)` | `#` answers | demo | replays once (2 plays), then rests |
| Channel Affinity carousel `setInterval(…,3600)` | `#channel-affinity` | demo | a `setTimeout` chain: starts half in view, 2 full cycles (8 slides), then holds; Pause; pauses on hover, focus and off-screen; stops for good when a person picks a tab or swipes |
| LMS storyboard 500 ms poll (3 s step) | `#lms` | demo | an exact 3 s `setTimeout` chain; 2 cycles ending on step 3; Stop/Replay became the Pause toggle; step buttons take over; reduced motion shows step 3 |
| `slx` start poll, 400 ms + endless demo | `#subject-line` | demo | IntersectionObserver start; 2 runs at 55 ms/char, then holds the picked line; focus, click or typing stops it; Pause; reduced motion shows the end state |
| SLA hero `initSLA()` loop every ~10 s | `#subject-line` | demo | 2 runs at 55 ms/char (was 90); Pause; waits while paused or off-screen |
| SLA experiment bars, 600 ms poll | `#subject-line` | poll | IntersectionObserver |
| LMS reveal-on-view, 500 ms poll | `#lms` | poll | IntersectionObserver |
| Discount guide `setInterval(place,350)` | `#discount` | poll | kept (it reads the prototype's iframe), but skips work while off-screen |
| CA helper buddy `setInterval(all,500)` | `#channel-affinity` | poll | kept (positions the ring on live mock controls), only for apps on screen |

**Constants** (top of `js/app.js`): `SEARCH`, `LOOP` and `INTRO` hold every dwell, step and typing speed. Thumbnails on home and `#all` are decorative copies of the stages, so they keep the cycle caps but get no Pause button.

## AA exceptions (L18)

**Approved exceptions: none.** Today's `color-contrast` failures (above, and per route in the roadmap) are tolerated until Nila's colour pass (D7). They are not exceptions, and none may be added. Proposals go to Main under "Needs from others" with a reason and the measured ratio.

**Revealed at 390, recorded for the colour pass (Nila, 7 Nov: these are today's colours under D7, not new failures).** Before W3-06 these nodes sat off-screen at 390, so axe skipped them. They're the same colours as at 1440, where they already fail.

| Route | Node | Text | Ratio | Colours | Size |
|---|---|---|---|---|---|
| `#audience` | `.mute > .l` (AO report card, muted row label) | "Placed order rate lift" | 3.0 : 1 | `#9095A0` on `#FFFFFF` | 13.5px |
| `#audience` | `div[data-f-v2]` (the muted lift value) | "+0.4%" | 3.0 : 1 | `#9095A0` on `#FFFFFF` | 22px |
| `#channel-affinity` | `.ca-today-t li` 1 | "Duplicate fatigue…" | 3.97 : 1 | `#726664` on `#E7D9C4` (`--band-tint`) | 16px |
| `#channel-affinity` | `.ca-today-t li` 4 | "Manual workarounds…" | 3.97 : 1 | `#726664` on `#E7D9C4` | 16px |
| `#data-xray` | `.tint > .head > .body` (the tint chapter's intro) | "Athenic lets business teams analyze their data…" | 3.97 : 1 | `#726664` on `#E7D9C4` | 16.8px |

Also in the colour pass: `#lms` `.dk > b` ("Slides", 1.16 : 1, `#2A2029` on `#3B2840`, 12px). Since W3-03b, reduced motion shows the storyboard's end state, so the node is visible there. It's the same colour pair the animation already passes through.
