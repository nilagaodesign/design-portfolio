#!/usr/bin/env python3
"""Truth test: no held number renders anywhere, and every registered figure renders as registered.

Usage (from the repo or worktree root):  python3 tools/truth-test.py [-v] [--json OUT]
(also writes .capture/truth.json; the gate compares it with baseline/<m>/truth.json)

Checks rendered text (innerText, plus aria-label / alt / title and SVG text) of:
  - all 15 routes, at 1440 and 390;
  - the answer to every SUGGEST prompt, and the 8 review questions;
  - one named-project query per project in P ("Show me <title>"), plus each project's plain name.

Held strings (SHARED-RULES › Truth rules; − and -, – and - all match):
  1.2%, 8.9%, ~8–9%, 7×, 7.4×, "24% … up from 3%", 34.3%, 22.9%, −2.6%

Metrics registry check (W1-02). For each entry of METRIC (data/content.js), any figure that lists where it
renders is checked. Two shapes are accepted, so Content can extend METRIC without a second object:
  METRIC["audience"] = {v, n:"28.9%", l, src:"L3", at:["#audience .imp-n", "#all", "search: audience optimization"]}
  METRIC["audience"] = {v, n, l, figs:[{n:"28.9%", l:"…", src:"L3", at:[…]}, …]}
  - "at" items: "<#route> [css selector]" (selector optional: whole view) or "search: <query>".
  - Pass when the value string `n` appears in the text of at least one element the selector matches
    (whitespace and NBSP normalised). Fail when the selector matches nothing or none contains the value.
  - "not" items (optional): "<#route> <css selector>" where the figure must NOT render. Pass when the selector
    matches no element on that route (e.g. the "relative lift" tag is kept off the home project rows).
Exit code 1 on any failure.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _lib
_lib.ensure_venv()
import asyncio, json, re

REVIEW_QS = ["Show me Nila's favorite project", "Show me AI and LLM work", "How does Nila use AI in her work?",
             "Does Nila code?", "How does Nila make AI trustworthy?", "hi how are you",
             "What did Nila do before Klaviyo?", "What's the capital of France?"]

ATTR_JS = _lib.TEXT_JS


def norm(s):
    return re.sub(r"\s+", " ", (s or "").replace(" ", " ").replace(" ", " ")).strip()


async def page_text(page):
    t = await page.evaluate(ATTR_JS)
    return t["text"] + "\n" + t["attrs"] + "\n" + t["svg"]


async def ask(page, q):
    await page.evaluate("window.scrollTo(0,0)")
    # DOM-level input: Playwright's fill/press wait on animation frames, which the paused clock freezes.
    used_ui = await page.evaluate("""q => { const i = document.querySelector('#q'), f = document.querySelector('#qform');
        if (!i || !f) return false; i.value = q; i.dispatchEvent(new Event('input', {bubbles: true}));
        if (f.requestSubmit) f.requestSubmit(); else f.dispatchEvent(new Event('submit', {cancelable: true, bubbles: true}));
        return true; }""", q)
    if not used_ui:
        await page.evaluate("q => (typeof ask === 'function') && ask(q)", q)
    await page.clock.run_for(15000)
    await page.wait_for_timeout(50)
    box = await page.evaluate("""() => { const b = document.querySelector('#box') || document.querySelector('.view.on') || document.body;
        const attrs = [...b.querySelectorAll('[aria-label],[alt],[title]')].map(e => ['aria-label','alt','title'].map(a => e.getAttribute(a)||'').join(' ')).join('\\n');
        const svg = [...b.querySelectorAll('svg text')].map(t => t.textContent).join('\\n');
        return b.innerText + '\\n' + attrs + '\\n' + svg; }""")
    return box


async def main(verbose=False, json_out=None):
    from playwright.async_api import async_playwright
    srv = _lib.Server()
    failures, checked, keys = [], [], []
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(channel="chrome", headless=True)
            # --- routes
            sem = asyncio.Semaphore(4)

            async def route_text(r, w, h):
                async with sem:
                    ctx, page, _ = await _lib.new_page(browser, w, h)
                    try:
                        await page.goto(srv.base + "/" + r, wait_until="load")
                        await _lib.settle(page)
                        return r, w, await page_text(page)
                    finally:
                        await ctx.close()

            print("  rendering 15 routes at 1440 and 390 …", file=sys.stderr, flush=True)
            res = await asyncio.gather(*(route_text(r, w, h) for r in _lib.ROUTES for (w, h) in _lib.WIDTHS))
            for r, w, txt in res:
                checked.append(f"route {r} @{w}")
                for name, ctx_s in _lib.held_hits(txt):
                    failures.append(f"held {name!r} on {r} @{w}: …{ctx_s}…")
                    keys.append(f"held {name} | {r} @{w}")
            # --- home queries
            ctx, page, _ = await _lib.new_page(browser, 1440, 900)
            await page.goto(srv.base + "/#", wait_until="load")
            await page.clock.run_for(8000)
            meta = await page.evaluate("""() => ({
                suggest: (typeof SUGGEST !== 'undefined') ? SUGGEST.map(s => s.q) : [],
                projects: (typeof P !== 'undefined') ? Object.entries(P).map(([id, p]) => [id, p.title]) : [],
                metric: (typeof METRIC !== 'undefined') ? METRIC : {} })""")
            qs = []
            for q in meta["suggest"] + REVIEW_QS:
                if q not in qs:
                    qs.append(q)
            for pid, title in meta["projects"]:
                for q in (f"Show me {title}", title.lower(), pid.replace("-", " ")):
                    if q not in qs:
                        qs.append(q)
            answers = {}
            print(f"  asking {len(qs)} questions …", file=sys.stderr, flush=True)
            for q in qs:
                txt = await ask(page, q)
                answers[q] = txt
                checked.append(f"search {q!r}")
                for name, ctx_s in _lib.held_hits(txt):
                    failures.append(f"held {name!r} in answer to {q!r}: …{ctx_s}…")
                    keys.append(f"held {name} | search: {q}")
            await ctx.close()
            # --- registry
            figs, nots = [], []
            for mid, m in (meta["metric"] or {}).items():
                if not isinstance(m, dict):
                    continue
                for f in ([m] + list(m.get("figs") or [])):
                    if isinstance(f, dict) and f.get("at") and f.get("n") is not None:
                        figs.append((mid, f))
                    if isinstance(f, dict) and f.get("not"):
                        nots.extend((mid, f, str(loc).strip()) for loc in f["not"])
            for mid, f, loc in nots:
                m = re.match(r"^(#[\w-]*)\s+(\S.*)$", loc)
                if not m:
                    failures.append(f"registry: METRIC[{mid!r}] bad 'not' location {loc!r}")
                    continue
                ctx, page, _ = await _lib.new_page(browser, 1440, 900)
                try:
                    await page.goto(srv.base + "/" + m.group(1), wait_until="load")
                    await _lib.settle(page, scroll=True)
                    found = await page.evaluate("sel => document.querySelectorAll(sel).length", m.group(2))
                except Exception as e:
                    found = None
                    failures.append(f"registry: METRIC[{mid!r}] selector error at not {loc!r}: {e}")
                finally:
                    await ctx.close()
                checked.append(f"registry {mid} not @ {loc}")
                if found:
                    failures.append(f"registry: METRIC[{mid!r}] {str(f['n'])!r} renders at {loc!r} ({found} element(s)), where it must not")
            for mid, f in figs:
                val = norm(str(f["n"]))
                for loc in f["at"]:
                    loc = str(loc).strip()
                    if loc.lower().startswith("search:"):
                        q = loc.split(":", 1)[1].strip()
                        if q not in answers:
                            ctx, page, _ = await _lib.new_page(browser, 1440, 900)
                            await page.goto(srv.base + "/#", wait_until="load")
                            await page.clock.run_for(8000)
                            answers[q] = await ask(page, q)
                            await ctx.close()
                        ok = val in norm(answers[q])
                        checked.append(f"registry {mid} {val!r} @ {loc}")
                        if not ok:
                            failures.append(f"registry: METRIC[{mid!r}] {val!r} not in answer to {q!r}")
                        continue
                    m = re.match(r"^(#[\w-]*)\s*(.*)$", loc)
                    if not m:
                        failures.append(f"registry: METRIC[{mid!r}] bad location {loc!r}")
                        continue
                    route, sel = m.group(1) or "#", m.group(2).strip()
                    ctx, page, _ = await _lib.new_page(browser, 1440, 900)
                    try:
                        await page.goto(srv.base + "/" + route, wait_until="load")
                        await _lib.settle(page, scroll=True)
                        texts = await page.evaluate("""sel => { const root = document.querySelector('.view.on') || document.body;
                            const els = sel ? [...document.querySelectorAll(sel)] : [root];
                            return els.map(e => e.innerText || e.textContent || ''); }""", sel)
                    except Exception as e:
                        texts = None
                        failures.append(f"registry: METRIC[{mid!r}] selector error at {loc!r}: {e}")
                    finally:
                        await ctx.close()
                    checked.append(f"registry {mid} {val!r} @ {loc}")
                    if texts is None:
                        continue
                    if not texts:
                        failures.append(f"registry: METRIC[{mid!r}] {loc!r} matches nothing")
                    elif not any(val in norm(t) for t in texts):
                        failures.append(f"registry: METRIC[{mid!r}] {val!r} not rendered at {loc!r} (found: {norm(texts[0])[:80]!r})")
            await browser.close()
    finally:
        srv.close()
    keys += [f for f in failures if f.startswith("registry")]
    if json_out:
        os.makedirs(os.path.dirname(os.path.abspath(json_out)), exist_ok=True)
        json.dump({"failures": failures, "keys": sorted(keys), "checked": checked}, open(json_out, "w"), indent=1)
    n_reg = sum(1 for c in checked if c.startswith("registry"))
    print(f"Truth test: {len([c for c in checked if c.startswith('route')])} route renders, "
          f"{len([c for c in checked if c.startswith('search')])} search answers, {n_reg} registry locations checked.")
    if verbose:
        for c in checked:
            print("  · " + c)
    if failures:
        print(f"❌ FAIL: {len(failures)} problem(s)")
        for f in failures:
            print("  ❌ " + f)
        return 1
    print("✅ PASS: 0 held strings in rendered text" + (", 0 registry mismatches" if n_reg else " (no registry locations yet: W1-02)"))
    return 0


if __name__ == "__main__":
    jo = sys.argv[sys.argv.index("--json") + 1] if "--json" in sys.argv else os.path.join(_lib.ROOT, ".capture", "truth.json")
    sys.exit(asyncio.run(main("-v" in sys.argv, jo)))
