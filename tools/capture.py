#!/usr/bin/env python3
"""Deterministic capture of the site (and the normal-motion smoke test).

Usage (from the repo or worktree root):
  python3 tools/capture.py [routes…] [--out DIR] [--no-keyboard]
      routes: all (default) or e.g. "#audience #all" or "audience,all"
      DIR defaults to .capture/latest
      Writes, per route: <slug>.1440.png, <slug>.390.png (full page), <slug>.<w>.txt (visible text),
      <slug>.axe.<w>.json, and <slug>.json (console, transfer bytes, scrollWidth, external requests,
      motion state, computed colours, :root variables, keyboard pass).
  python3 tools/capture.py --smoke
      Normal motion: the intro completes, each SUGGEST prompt returns an answer (chip, or search box when no chips render), every route opens from home,
      and there are no console errors. Exit code 1 on failure.

How it stays repeatable: a private 127.0.0.1 server; every non-localhost request blocked except Google Fonts
(served from .cache/fonts after the first fetch); Math.random pinned to 0.42; Playwright's page.clock paused
and advanced by fixed amounts; prefers-reduced-motion emulated; screenshots taken with animations disabled,
after scrolling to the bottom and back so every reveal fires.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _lib
_lib.ensure_venv()
import asyncio, argparse, json


async def smoke(root=_lib.ROOT):
    from playwright.async_api import async_playwright
    srv = _lib.Server(root)
    fails, notes = [], []
    sandboxed = set()

    def check_console(log, where):
        # requests the capture sandbox blocks on purpose (e.g. the weather API) are reported, not failed
        own = [m for m in log["console"] if "ERR_BLOCKED_BY_CLIENT" in m]
        real = [m for m in log["console"] if m not in own and not m.startswith("warning")] + log.get("failed", [])
        sandboxed.update(own)
        if real:
            fails.append(f"console {where}: " + "; ".join(real[:5]))

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(channel="chrome", headless=True)
            # 1. intro completes
            ctx, page, log = await _lib.new_page(browser, 1440, 900, reduced=False)
            await page.goto(srv.base + "/#", wait_until="load")
            await page.clock.run_for(20000)
            await page.wait_for_timeout(500)
            st = await page.evaluate("""() => ({h1: (document.querySelector('#h1')||{}).textContent||'',
                sub: (document.querySelector('#sub')||{}).textContent||'',
                want_h: typeof INTRO_H!=='undefined'?INTRO_H:null, want_s: typeof INTRO_S!=='undefined'?INTRO_S:null,
                rows: document.querySelectorAll('#res > *, #more-list > *').length,
                chips: [...document.querySelectorAll('#chips button')].length})""")
            ok_h = st["want_h"] is None or st["h1"].strip() == st["want_h"].strip()
            ok_s = st["want_s"] is None or st["sub"].strip() == st["want_s"].strip()
            if not (ok_h and ok_s):
                fails.append(f"intro incomplete: h1={st['h1']!r} sub={st['sub'][:60]!r}")
            if st["rows"] < 1:
                fails.append("home renders no project rows")
            notes.append(f"intro: h1 and sub complete={ok_h and ok_s}; home rows={st['rows']}; chips={st['chips']}")
            check_console(log, "on home")
            await ctx.close()
            # 2. each SUGGEST prompt returns an answer (chips are clicked when the site renders them;
            #    otherwise the prompt is submitted through the search box)
            prompts = await page_suggest(browser, srv.base)
            for i, q in enumerate(prompts):
                ctx, page, log = await _lib.new_page(browser, 1440, 900, reduced=False)
                await page.goto(srv.base + "/#", wait_until="load")
                await page.clock.run_for(20000)
                how = await page.evaluate("""([i, q]) => { const b = document.querySelectorAll('#chips button')[i];
                    if (b && b.offsetParent) { b.click(); return 'chip'; }
                    const inp = document.querySelector('#q'), f = document.querySelector('#qform');
                    inp.value = q; inp.dispatchEvent(new Event('input', {bubbles: true})); f.requestSubmit(); return 'search box'; }""", [i, q])
                await page.clock.run_for(15000)
                await page.wait_for_timeout(200)
                a = await page.evaluate("""() => ({ans: (document.querySelector('#ans')||{}).innerText||'',
                    think: !!document.querySelector('#ans .think:not(.done)') || document.querySelector('#ans')?.getAttribute('aria-busy') === 'true',
                    body: ((document.querySelector('#ans')||{}).innerText||'').replace(/^.*Answers written by Nila\s*/s, '').trim().length,
                    next: document.querySelectorAll('#ans-next button').length})""")
                # W3-02 keeps the thinking line as the caption (".think.done"), so "still thinking" = a .think
                # without .done, or aria-busy; and the answer must have text beyond the caption
                if a["think"] or a["body"] < 5:
                    fails.append(f"SUGGEST {q!r} ({how}) gave no answer")
                notes.append(f"SUGGEST {q!r} via {how}: {len(a['ans'].strip())} chars, {a['next']} follow-ups")
                check_console(log, f"after SUGGEST {q!r}")
                await ctx.close()
            # 3. every route opens from home
            ctx, page, log = await _lib.new_page(browser, 1440, 900, reduced=False)
            await page.goto(srv.base + "/#", wait_until="load")
            await page.clock.run_for(20000)
            for r in _lib.ROUTES[1:] + ["#"]:
                await page.evaluate(f"location.hash = {json.dumps(r)}")
                await page.clock.run_for(4000)
                await page.wait_for_timeout(100)
                v = await page.evaluate("""() => { const on=[...document.querySelectorAll('.view.on')].map(v=>v.id);
                    const t=(document.querySelector('.view.on')||document.body).innerText.trim(); return {on, n:t.length, h1:((document.querySelector('.view.on h1')||{}).textContent||'').trim().slice(0,50)} }""")
                if not v["on"] or v["n"] < 20:
                    fails.append(f"route {r} did not open (views on: {v['on']}, text {v['n']})")
                notes.append(f"route {r}: view={','.join(v['on'])} h1={v['h1']!r}")
            check_console(log, "while opening routes")
            await ctx.close()
            await browser.close()
    finally:
        srv.close()
    for m in sorted(sandboxed):
        notes.append("blocked by the capture sandbox (not a failure): " + m[:140])
    return fails, notes


async def page_suggest(browser, base):
    ctx, page, _ = await _lib.new_page(browser, 1440, 900, reduced=True)
    await page.goto(base + "/#", wait_until="load")
    await page.clock.run_for(3000)
    qs = await page.evaluate("() => (typeof SUGGEST !== 'undefined') ? SUGGEST.map(s => s.q) : []")
    await ctx.close()
    return qs


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("routes", nargs="*")
    ap.add_argument("--out", default=os.path.join(_lib.ROOT, ".capture", "latest"))
    ap.add_argument("--no-keyboard", action="store_true")
    ap.add_argument("--smoke", action="store_true")
    a = ap.parse_args()
    if a.smoke:
        fails, notes = asyncio.run(smoke())
        for n in notes:
            print("  " + n)
        print("\nSMOKE " + ("✅ passed" if not fails else "❌ failed"))
        for f in fails:
            print("  ❌ " + f)
        sys.exit(1 if fails else 0)
    routes = _lib.parse_routes(a.routes)
    print(f"Capturing {len(routes)} route(s) from {_lib.ROOT} → {a.out}")
    asyncio.run(_lib.capture(routes, a.out, keyboard=not a.no_keyboard))
    print("done")


if __name__ == "__main__":
    main()
