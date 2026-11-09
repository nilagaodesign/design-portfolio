#!/usr/bin/env python3
"""Rendered checks on a public-build candidate (called by tools/make-public.sh; Main only).

Usage: python3 tools/public-check.py <candidate folder>

On all 15 routes (1440), plus every SUGGEST prompt and one query per project:
  - rendered `[data-placeholder]` elements: must be 0 (O10, D8);
  - no request to the prototypes (proto/, *.dc.html; L17), and no failed request or 404;
  - no console error, no external request except Google Fonts;
  - #discount transfer, fully scrolled, before any click (E7: < 2 MB).
Exit 1 on any failure.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if len(sys.argv) != 2 or not os.path.isdir(sys.argv[1]):
    sys.exit(__doc__)
os.environ["V2_SITE_ROOT"] = os.path.abspath(sys.argv[1])
import _lib
_lib.ensure_venv()
import asyncio, importlib.util

spec = importlib.util.spec_from_file_location("truth", os.path.join(_lib.TOOLS, "truth-test.py"))
truth = importlib.util.module_from_spec(spec)
sys.argv = [sys.argv[0]]
spec.loader.exec_module(truth)
PH_JS = "() => [...document.querySelectorAll('[data-placeholder]')].filter(e => e.getClientRects().length).map(e => __desc(e)).slice(0, 10)"


async def main():
    from playwright.async_api import async_playwright
    srv = _lib.Server(_lib.SITE)
    fails, notes = [], []
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(channel="chrome", headless=True)
            for r in _lib.ROUTES:
                ctx, page, log = await _lib.new_page(browser, 1440, 900)
                await page.goto(srv.base + "/" + r, wait_until="load")
                await _lib.settle(page)
                ph = await page.evaluate(PH_JS)
                await asyncio.gather(*page._pending_sizes, return_exceptions=True)
                proto = [u for u in log["requests"] if ("/proto/" in u or ".dc.html" in u)]
                ext = [u for u in log["requests"] if _lib.EXTERNAL.match(u) and not u.startswith("/") and not any(h in u for h in _lib.FONT_HOSTS)]
                errs = [m for m in log["console"] if not m.startswith("warning")]
                if ph: fails.append(f"{r}: {len(ph)} rendered placeholder(s): {ph[:3]}")
                if proto: fails.append(f"{r}: requests prototype files: {proto[:2]}")
                if log["failed"]: fails.append(f"{r}: failed requests: {sorted(set(log['failed']))[:3]}")
                if ext: fails.append(f"{r}: external requests: {ext[:2]}")
                if errs: fails.append(f"{r}: console: {errs[:2]}")
                if r == "#discount":
                    mb = log["bytes"] / 1e6
                    notes.append(f"#discount transfer, fully scrolled, before any click: {mb:.2f} MB")
                    if mb >= 2.0: fails.append(f"#discount is {mb:.2f} MB (E7 target < 2 MB)")
                    # the prototype control must show a recording without ever requesting assets/discount/proto/
                    clicked = await page.evaluate("""() => { const b = [...document.querySelectorAll('#cs-body button, #cs-body a')]
                        .find(x => /interactive prototype|recording/i.test(x.innerText) && x.getClientRects().length); if (!b) return null; b.click(); return b.innerText.trim(); }""")
                    await page.clock.run_for(3000)
                    await page.wait_for_timeout(1500)
                    recs = sorted({u for u in log["requests"] if "/rec-" in u})
                    shown = await page.evaluate("() => [...document.querySelectorAll('img[src*=\"rec-\"]')].filter(i => i.complete && i.naturalWidth && i.getClientRects().length).length")
                    notes.append(f"#discount: clicked {clicked!r}; recordings requested {len(recs)}, shown {shown}")
                    proto2 = [u for u in log["requests"] if ("/proto/" in u or ".dc.html" in u)]
                    if proto2: fails.append(f"#discount: after the click it requests prototype files: {proto2[:2]}")
                    if not shown: fails.append("#discount: no recording is shown after the click")
                    if log["failed"]: fails.append(f"#discount after click: failed requests: {sorted(set(log['failed']))[:3]}")
                await ctx.close()
            ctx, page, log = await _lib.new_page(browser, 1440, 900)
            await page.goto(srv.base + "/#", wait_until="load")
            await page.clock.run_for(8000)
            meta = await page.evaluate("() => ({s: typeof SUGGEST!=='undefined' ? SUGGEST.map(x => x.q) : [], p: typeof P!=='undefined' ? Object.values(P).map(x => 'Show me ' + x.title) : []})")
            for q in meta["s"] + meta["p"]:
                await truth.ask(page, q)
                ph = await page.evaluate(PH_JS)
                if ph: fails.append(f"answer to {q!r}: {len(ph)} rendered placeholder(s)")
            notes.append(f"search answers checked: {len(meta['s']) + len(meta['p'])}")
            await ctx.close()
            await browser.close()
    finally:
        srv.close()
    for n in notes:
        print("   " + n)
    for f in fails:
        print("❌ " + f)
    print("✅ rendered checks pass" if not fails else f"❌ rendered checks: {len(fails)} problem(s)")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
