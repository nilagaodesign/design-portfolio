"""Shared code for the v2 build tools (capture, gate, truth test, smoke test).

Sessions run the tools; they never edit them (Main owns tools/*).
Everything here is local: a private http server on 127.0.0.1, headless Chrome,
and every non-localhost request blocked except Google Fonts (cached on disk
after the first fetch, so captures are repeatable).
"""
import asyncio, datetime, functools, hashlib, http.server, json, os, re, subprocess, sys, threading

TOOLS = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(TOOLS)  # repo or worktree root
# The folder that gets served. Normally ROOT; Main sets V2_SITE_ROOT to capture an exported older commit.
SITE = os.path.abspath(os.environ.get("V2_SITE_ROOT", ROOT))


def _common_root():
    """Main repo folder (shared by all worktrees): holds .venv and .cache."""
    try:
        gd = subprocess.check_output(["git", "rev-parse", "--git-common-dir"], cwd=ROOT, text=True).strip()
        return os.path.dirname(os.path.abspath(os.path.join(ROOT, gd)))
    except Exception:
        return ROOT


COMMON = _common_root()
BUILD = os.path.expanduser("~/Desktop/portfolio-review/next-steps/build")
BASELINE_DIR = os.path.join(BUILD, "baseline")
CACHE = os.path.join(COMMON, ".cache")


def ensure_venv():
    """Re-exec under the shared .venv (Playwright, axe, Pillow) if needed."""
    try:
        import playwright, PIL, axe_playwright_python  # noqa: F401
        return
    except ImportError:
        pass
    py = os.path.join(COMMON, ".venv", "bin", "python")
    if not os.path.exists(py):
        sys.exit(f"Missing {py}. Main creates it with: python3 -m venv .venv && .venv/bin/pip install playwright axe-playwright-python pillow")
    if os.environ.get("V2_TOOLS_VENV") == "1":
        sys.exit("The .venv is missing a package; ask Main.")
    os.environ["V2_TOOLS_VENV"] = "1"
    os.execv(py, [py] + sys.argv)


ROUTES = ["#", "#all", "#about", "#playground", "#discount", "#send-time", "#audience",
          "#channel-affinity", "#subject-line", "#data-xray", "#system", "#sitematch",
          "#lms", "#peoples-vertex", "#4run2"]
WIDTHS = [(1440, 900), (390, 844)]
FIXED_TIME = datetime.datetime(2026, 11, 7, 12, 0, 0, tzinfo=datetime.timezone.utc)


def slug(route):
    return "home" if route in ("#", "", "/") else route.lstrip("#")


def parse_routes(args):
    if not args or args == ["all"]:
        return list(ROUTES)
    out = []
    for a in args:
        for r in a.split(","):
            r = r.strip()
            if not r:
                continue
            if r in ("home", "#home", "/"):
                r = "#"
            if not r.startswith("#"):
                r = "#" + r
            if r not in ROUTES:
                sys.exit(f"Unknown route {r}. Known: {' '.join(ROUTES)}")
            out.append(r)
    return out


def git(*args):
    try:
        return subprocess.check_output(["git", *args], cwd=ROOT, text=True, stderr=subprocess.DEVNULL).strip()
    except Exception:
        return ""


# ---------------------------------------------------------------- server
class _Quiet(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *a):
        pass


class Server:
    """Private no-store server for one capture run (random free port)."""

    def __init__(self, root=None):
        root = root or SITE
        self.httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(_Quiet, directory=root))
        self.port = self.httpd.server_address[1]
        self.base = f"http://127.0.0.1:{self.port}"
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def close(self):
        self.httpd.shutdown()


LOCAL_RE = re.compile(r"^https?://(127\.0\.0\.1|localhost)(:\d+)?")
FONT_HOSTS = ("fonts.googleapis.com", "fonts.gstatic.com")


def norm_url(u):
    return LOCAL_RE.sub("", u)


def norm_text(s):
    return LOCAL_RE.sub("", s or "")


async def _route_external(route):
    url = route.request.url
    host = re.sub(r"^https?://([^/:]+).*$", r"\1", url)
    if host not in FONT_HOSTS:
        await route.abort("blockedbyclient")
        return
    os.makedirs(os.path.join(CACHE, "fonts"), exist_ok=True)
    key = hashlib.sha1(url.encode()).hexdigest()
    body_p = os.path.join(CACHE, "fonts", key + ".body")
    meta_p = os.path.join(CACHE, "fonts", key + ".json")
    if os.path.exists(body_p) and os.path.exists(meta_p):
        meta = json.load(open(meta_p))
        await route.fulfill(status=meta["status"], headers=meta["headers"], body=open(body_p, "rb").read())
        return
    resp = await route.fetch()
    body = await resp.body()
    headers = {k: v for k, v in resp.headers.items() if k.lower() in ("content-type", "access-control-allow-origin", "timing-allow-origin")}
    headers.setdefault("access-control-allow-origin", "*")
    if resp.status == 200:
        open(body_p, "wb").write(body)
        json.dump({"status": 200, "headers": headers, "url": url}, open(meta_p, "w"))
    await route.fulfill(status=resp.status, headers=headers, body=body)


_GIF_CACHE = {}


async def _route_gif(route):
    """Captures only: serve an animated GIF's first frame, so real-time GIF playback doesn't add pixel noise."""
    from PIL import Image
    import io
    from urllib.parse import unquote, urlparse
    path = os.path.join(route._v2_root, unquote(urlparse(route.request.url).path).lstrip("/"))
    try:
        st = os.stat(path)
        key = (path, st.st_mtime_ns, st.st_size)
        if key not in _GIF_CACHE:
            im = Image.open(path)
            im.seek(0)
            buf = io.BytesIO()
            im.save(buf, format="GIF")
            _GIF_CACHE[key] = buf.getvalue()
        await route.fulfill(status=200, headers={"Content-Type": "image/gif", "Cache-Control": "no-store"}, body=_GIF_CACHE[key])
    except Exception:
        await route.continue_()


EXTERNAL = re.compile(r"^(?!https?://(127\.0\.0\.1|localhost)(:\d+)?/)(?!data:|blob:|about:).*")

# ---------------------------------------------------------------- page JS
DESC_JS = r"""
window.__desc = el => {
  if(!el || !el.tagName) return '';
  let s = el.tagName.toLowerCase();
  if(el.id) s += '#' + el.id;
  const c = (el.getAttribute('class')||'').trim().split(/\s+/).filter(Boolean).slice(0,2);
  if(c.length) s += '.' + c.join('.');
  const t = (el.getAttribute('aria-label') || el.innerText || el.textContent || '').trim().replace(/\s+/g,' ').slice(0,40);
  return t ? s + ' "' + t + '"' : s;
};
"""

INIT_JS = "Math.random = () => 0.42;\n" + DESC_JS

TEXT_JS = r"""() => {
  const parts = [document.body.innerText];
  const attrs = [];
  for (const el of document.querySelectorAll('[aria-label],[alt],[title]')) {
    for (const a of ['aria-label','alt','title']) { const v = el.getAttribute(a); if (v && v.trim()) attrs.push(v.trim()); }
  }
  const svg = [];
  for (const t of document.querySelectorAll('svg text')) { const v = t.textContent.trim(); if (v) svg.push(v); }
  return {text: parts.join('\n'), attrs: attrs.join('\n'), svg: svg.join('\n')};
}"""

COLORS_JS = r"""() => {
  const out = {};
  const add = (p, v) => { if (!v || v === 'none' || v === 'rgba(0, 0, 0, 0)' || v === 'transparent') return; (out[p] = out[p] || {}); out[p][v] = (out[p][v] || 0) + 1; };
  const colRe = /(rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}\b|hsla?\([^)]*\)|oklch\([^)]*\)|oklab\([^)]*\)|color\([^)]*\))/g;
  for (const el of document.querySelectorAll('body *')) {
    if (!el.getClientRects().length) continue;
    for (const pseudo of [null, '::before', '::after']) {
      const cs = getComputedStyle(el, pseudo);
      if (pseudo && (cs.content === 'none' || cs.content === 'normal')) continue;
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const hasText = pseudo ? cs.content !== '""' : [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
      if (hasText) add('color', cs.color);
      add('background-color', cs.backgroundColor);
      for (const s of ['Top','Right','Bottom','Left'])
        if (parseFloat(cs['border'+s+'Width']) > 0 && cs['border'+s+'Style'] !== 'none') add('border-color', cs['border'+s+'Color']);
      if (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) add('outline-color', cs.outlineColor);
      if (!pseudo && el instanceof SVGElement) { add('fill', cs.fill); add('stroke', cs.stroke); }
      for (const prop of ['boxShadow','backgroundImage','textShadow','textDecorationColor']) {
        const v = cs[prop]; if (v && v !== 'none' && (prop !== 'textDecorationColor' || cs.textDecorationLine !== 'none')) (v.match(colRe) || []).forEach(c => add(prop, c));
      }
    }
  }
  return out;
}"""

ROOTVARS_JS = r"""() => {
  const names = new Set();
  const walk = rules => { for (const r of rules) {
    if (r.style && r.selectorText && /(^|,)\s*:root\s*($|,)/.test(r.selectorText)) for (const n of r.style) if (n.startsWith('--')) names.add(n);
    if (r.cssRules) { try { walk(r.cssRules); } catch (e) {} } } };
  for (const s of document.styleSheets) { try { walk(s.cssRules); } catch (e) {} }
  const cs = getComputedStyle(document.documentElement); const o = {};
  for (const n of [...names].sort()) o[n] = cs.getPropertyValue(n).trim();
  return o;
}"""

MOTION_JS = r"""() => {
  const anims = document.getAnimations().filter(a => a.playState === 'running');
  const names = {};
  for (const a of anims) {
    const n = a.animationName ? 'css:' + a.animationName : a.transitionProperty ? 'transition:' + a.transitionProperty : 'waapi';
    names[n] = (names[n] || 0) + 1;
  }
  // infinite loops are paused at t=0 before the hidden-text count, so the count doesn't depend on loop phase
  for (const a of anims) { try { const t = a.effect && a.effect.getComputedTiming(); if (t && !isFinite(t.endTime)) { a.pause(); a.currentTime = 0; } } catch (e) {} }
  const memo = new Map();
  const eff = el => { if (!el || el === document.documentElement) return 1; if (memo.has(el)) return memo.get(el);
    const cs = getComputedStyle(el); let v = parseFloat(cs.opacity); if (cs.visibility === 'hidden') v = 0; v *= eff(el.parentElement); memo.set(el, v); return v; };
  let hidden = 0; const sample = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!el.getClientRects().length) continue;
    if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    if (eff(el) < 0.05) { hidden++; if (sample.length < 20) sample.push(__desc(el)); }
  }
  return {running: anims.length, names, hiddenText: hidden, hiddenSample: sample};
}"""

KB_MARK_JS = r"""() => {
  const sel = 'a[href],button,input:not([type=hidden]),select,textarea,summary,[tabindex],[role=button],[role=tab],[role=link],[role=checkbox],[role=switch],[role=menuitem],[contenteditable=true]';
  const out = []; let i = 0;
  for (const el of document.querySelectorAll(sel)) {
    if (!el.getClientRects().length) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || el.closest('[inert],[aria-hidden=true]') || el.disabled) continue;
    if (el.hasAttribute('tabindex') && el.tabIndex < 0) continue;
    el.setAttribute('data-kb', String(i)); out.push({i, key: __desc(el)}); i++;
  }
  return out;
}"""

KB_STEP_JS = r"""() => {
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return null;
  const cs = getComputedStyle(el);
  const ow = parseFloat(cs.outlineWidth) || 0;
  const oc = cs.outlineColor;
  const outline = cs.outlineStyle !== 'none' && ow > 0 && !/rgba\([^)]*,\s*0\)$/.test(oc);
  const shadow = cs.boxShadow && cs.boxShadow !== 'none';
  return {kb: el.getAttribute('data-kb'), key: __desc(el), ring: !!(outline || shadow), fv: el.matches(':focus-visible')};
}"""

FREEZE_JS = r"""() => {
  // Determinism: finite animations jump to their end state, infinite ones pause at t=0 (real-time CSS
  // animations aren't driven by page.clock). Runs after the motion check has recorded what was running.
  let n = 0;
  for (const a of document.getAnimations()) {
    try {
      const t = a.effect && a.effect.getComputedTiming();
      if (t && isFinite(t.endTime)) a.finish(); else { a.pause(); a.currentTime = 0; }
      n++;
    } catch (e) {}
  }
  return n;
}"""

IMAGES_JS = r"""async () => {
  // Determinism: lazy images can still be in flight after the scroll pass, which collapses layout in one run
  // and not the next. Ask every image to load now, then wait for all of them (max 15 s).
  const imgs = [...document.images];
  for (const i of imgs) { try { if (i.loading === 'lazy') i.loading = 'eager'; } catch (e) {} }
  await Promise.race([
    Promise.all(imgs.map(i => (i.complete && (i.naturalWidth || !i.currentSrc)) ? 0 :
      new Promise(r => { i.addEventListener('load', r, {once: true}); i.addEventListener('error', r, {once: true}); }))),
    new Promise(r => setTimeout(r, 15000))]);
  return imgs.filter(i => !i.complete).length;
}"""

SETTLE_MEDIA_JS = r"""async () => {
  const vids = [...document.querySelectorAll('video')];
  for (const v of vids) { try { v.pause(); v.autoplay = false; } catch (e) {} }
  await Promise.all(vids.map(v => new Promise(res => {
    try { if (v.readyState < 1) return res(); v.currentTime = 0; } catch (e) { return res(); }
    const t = setTimeout(res, 3000);
    if (v.readyState >= 2 && !v.seeking) { clearTimeout(t); return res(); }
    v.addEventListener('seeked', () => { clearTimeout(t); res(); }, {once: true});
    v.addEventListener('loadeddata', () => { clearTimeout(t); res(); }, {once: true});
  })));
  await Promise.all([...document.images].filter(i => i.complete && i.naturalWidth).map(i => i.decode().catch(() => {})));
  return vids.length;
}"""


# ---------------------------------------------------------------- capture
class RouteCapture:
    def __init__(self, route):
        self.route = route
        self.data = {"route": route}


async def new_page(browser, width, height, reduced=True, log=None, root=None):
    root = root or SITE
    ctx = await browser.new_context(viewport={"width": width, "height": height}, device_scale_factor=1,
                                    reduced_motion="reduce" if reduced else "no-preference",
                                    locale="en-US", timezone_id="America/New_York", color_scheme="light",
                                    service_workers="block")
    await ctx.add_init_script(INIT_JS)
    await ctx.route(EXTERNAL, _route_external)
    if root:
        async def gif(route):  # one parameter: Playwright passes (route, request) to two-parameter handlers
            route._v2_root = root
            await _route_gif(route)
        await ctx.route(re.compile(r"^https?://(127\.0\.0\.1|localhost)(:\d+)?/.*\.gif(\?.*)?$", re.I), gif)
    page = await ctx.new_page()
    log = log if log is not None else {}
    log.setdefault("requests", [])
    log.setdefault("console", [])
    log.setdefault("bytes", 0)
    log.setdefault("failed", [])
    pending = []

    def on_req(r):
        log["requests"].append(norm_url(r.url))

    def on_console(m):
        if m.type in ("error", "warning"):
            loc = m.location or {}
            log["console"].append(f"{m.type}: {norm_text(m.text)}" + (f" @{norm_url(loc.get('url',''))}" if loc.get("url") else ""))

    def on_err(e):
        log["console"].append(f"pageerror: {norm_text(str(e))}")

    async def sizes(r):
        try:
            s = await r.sizes()
            log["bytes"] += s.get("responseBodySize", 0) + s.get("responseHeadersSize", 0)
        except Exception:
            pass

    def on_fin(r):
        pending.append(asyncio.ensure_future(sizes(r)))

    def on_fail(r):
        u = norm_url(r.url)
        if "ERR_ABORTED" in (r.failure or ""):
            return  # media loads the browser cancels on pause/seek: not an error
        if not EXTERNAL.match(r.url) or any(h in r.url for h in FONT_HOSTS):
            log["failed"].append(f"{u} {r.failure}")

    def on_resp(resp):
        if resp.status >= 400:
            log["failed"].append(f"{norm_url(resp.url)} HTTP {resp.status}")

    page.on("request", on_req)
    page.on("console", on_console)
    page.on("pageerror", on_err)
    page.on("requestfinished", on_fin)
    page.on("requestfailed", on_fail)
    page.on("response", on_resp)
    page._pending_sizes = pending
    await page.clock.install(time=FIXED_TIME)
    await page.clock.pause_at(FIXED_TIME + datetime.timedelta(seconds=1))
    return ctx, page, log


async def settle(page, scroll=True):
    try:
        await page.evaluate("document.fonts.ready.then(() => 1)")
    except Exception:
        pass
    await page.clock.run_for(5000)
    if scroll:
        vh = await page.evaluate("innerHeight")
        y = 0
        for _ in range(300):
            h = await page.evaluate("document.documentElement.scrollHeight")
            if y > h:
                break
            await page.evaluate(f"window.scrollTo(0,{y})")
            await page.wait_for_timeout(50)
            await page.clock.run_for(400)
            y += int(vh * 0.8)
        await page.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)")
        await page.wait_for_timeout(80)
        await page.clock.run_for(1500)
        await page.evaluate("window.scrollTo(0,0)")
        await page.wait_for_timeout(80)
        await page.clock.run_for(1500)
    try:
        await page.wait_for_load_state("networkidle", timeout=15000)
    except Exception:
        pass
    # all images loaded, then the page height must hold still (real-time waits: page timers are paused)
    try:
        task = asyncio.ensure_future(page.evaluate(IMAGES_JS))
        for _ in range(200):
            if task.done():
                break
            await page.wait_for_timeout(100)
        await asyncio.wait_for(task, 20)
    except Exception:
        pass
    last = -1
    for _ in range(20):
        h = await page.evaluate("document.documentElement.scrollHeight")
        if h == last:
            break
        last = h
        await page.wait_for_timeout(250)
        await page.clock.run_for(200)
    try:
        await page.evaluate(SETTLE_MEDIA_JS)
    except Exception:
        pass
    await page.wait_for_timeout(1500)  # let finite CSS animations (real time) end
    await page.clock.run_for(500)


async def keyboard_pass(page, limit=250):
    interactive = await page.evaluate(KB_MARK_JS)
    await page.evaluate("window.scrollTo(0,0); document.activeElement && document.activeElement.blur && document.activeElement.blur()")
    stops, seen = [], set()
    first = None
    for _ in range(min(limit, len(interactive) + 15)):
        await page.keyboard.press("Tab")
        await page.clock.run_for(50)
        st = await page.evaluate(KB_STEP_JS)
        if st is None:
            if stops:
                break
            continue
        ident = st["kb"] or st["key"]
        if first is None:
            first = ident
        elif ident == first:
            break
        if ident in seen:
            continue
        seen.add(ident)
        stops.append(st)
    reached = {s["kb"] for s in stops if s["kb"] is not None}
    unreachable = [x["key"] for x in interactive if str(x["i"]) not in reached]
    noring = [s["key"] for s in stops if not s["ring"]]
    return {"interactive": len(interactive), "tabStops": len(stops), "unreachable": len(unreachable),
            "unreachableSample": unreachable[:25], "noRing": len(noring), "noRingSample": noring[:25]}


def axe_summary(resp):
    out = {}
    for v in resp.get("violations", []):
        out[v["id"]] = {"impact": v.get("impact"), "count": len(v.get("nodes", [])),
                        "targets": sorted(" ".join(map(str, n.get("target", []))) for n in v.get("nodes", []))}
    return out


async def run_axe(page):
    """axe-core uses timers, so the paused page clock is stepped while it runs."""
    import axe_playwright_python
    src = open(os.path.join(os.path.dirname(axe_playwright_python.__file__), "axe.min.js")).read()
    await page.evaluate(src + "\n;1")
    task = asyncio.ensure_future(page.evaluate(
        "() => axe.run(document, {resultTypes: ['violations']}).then(r => JSON.parse(JSON.stringify(r)))"))
    for _ in range(3000):
        if task.done():
            break
        await page.clock.run_for(100)
        await asyncio.sleep(0.01)
    resp = await asyncio.wait_for(task, 120)
    for k in ("timestamp", "url", "testEnvironment"):
        resp.pop(k, None)
    return resp


async def capture_one(browser, base, route, outdir, keyboard=True, root=None):
    """Capture one route at both widths. Writes <slug>.<w>.png, <slug>.<w>.txt, <slug>.axe.<w>.json, <slug>.json."""
    s = slug(route)
    rec = {"route": route, "widths": {}}
    for (w, h) in WIDTHS:
        log = {}
        ctx, page, log = await new_page(browser, w, h, reduced=True, log=log, root=root)
        try:
            await page.goto(base + "/" + route, wait_until="load", timeout=60000)
            await settle(page)
            txt = await page.evaluate(TEXT_JS)
            sw = await page.evaluate("document.documentElement.scrollWidth")
            motion = await page.evaluate(MOTION_JS)
            await page.evaluate(FREEZE_JS)
            await page.wait_for_timeout(100)
            colors = await page.evaluate(COLORS_JS)
            rootvars = await page.evaluate(ROOTVARS_JS)
            axe = await run_axe(page)
            await page.screenshot(path=os.path.join(outdir, f"{s}.{w}.png"), full_page=True, animations="disabled", caret="hide", timeout=120000)
            kb = await keyboard_pass(page) if (keyboard and w == 1440) else None
            await asyncio.gather(*page._pending_sizes, return_exceptions=True)
        finally:
            await ctx.close()
        open(os.path.join(outdir, f"{s}.{w}.txt"), "w").write(txt["text"] + "\n\n--- attributes ---\n" + txt["attrs"] + "\n\n--- svg text ---\n" + txt["svg"] + "\n")
        json.dump(axe, open(os.path.join(outdir, f"{s}.axe.{w}.json"), "w"), indent=1)
        rec["widths"][str(w)] = {
            "scrollWidth": sw, "text_sha": hashlib.sha1(json.dumps(txt, sort_keys=True).encode()).hexdigest(),
            "console": log["console"], "failed": sorted(set(log["failed"])), "bytes": log["bytes"],
            "requests": sorted(set(log["requests"])),
            "external": sorted({u for u in log["requests"] if EXTERNAL.match(u) and not u.startswith("/")}),
            "axe": axe_summary(axe), "motion": motion, "colors": colors, "rootVars": rootvars, "keyboard": kb,
        }
    json.dump(rec, open(os.path.join(outdir, f"{s}.json"), "w"), indent=1, sort_keys=True)
    return rec


async def capture(routes, outdir, root=None, keyboard=True, concurrency=3, quiet=False):
    root = root or SITE
    from playwright.async_api import async_playwright
    os.makedirs(outdir, exist_ok=True)
    srv = Server(root)
    results = {}
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(channel="chrome", headless=True)
            sem = asyncio.Semaphore(concurrency)

            async def one(r):
                async with sem:
                    if not quiet:
                        print(f"  capturing {r} …", flush=True)
                    results[r] = await capture_one(browser, srv.base, r, outdir, keyboard, root)

            await asyncio.gather(*(one(r) for r in routes))
            await browser.close()
    finally:
        srv.close()
    manifest = {"commit": os.environ.get("V2_SITE_LABEL") or git("rev-parse", "--short", "HEAD"), "branch": git("rev-parse", "--abbrev-ref", "HEAD"),
                "dirty": bool(git("status", "--porcelain", "--", ".", ":!tools", ":!.claude")),
                "root": root, "routes": routes, "at": datetime.datetime.now().isoformat(timespec="seconds")}
    old = {}
    mp = os.path.join(outdir, "manifest.json")
    if os.path.exists(mp):
        try:
            old = json.load(open(mp))
        except Exception:
            pass
    if set(old.get("routes", [])) - set(routes):
        manifest["routes"] = sorted(set(old["routes"]) | set(routes), key=ROUTES.index)
    json.dump(manifest, open(mp, "w"), indent=1)
    return results


def load_capture(d, route):
    p = os.path.join(d, slug(route) + ".json")
    return json.load(open(p)) if os.path.exists(p) else None


# ---------------------------------------------------------------- pixels
PIXEL_TOL = 16  # per-channel difference ignored as image-resampling noise (measured: ≤ 11 between identical runs)


def pixel_diff(a_path, b_path, out_path=None, tol=PIXEL_TOL):
    """Number of pixels whose largest channel difference exceeds `tol`. Size mismatch: the extra area counts."""
    from PIL import Image, ImageChops
    a = Image.open(a_path).convert("RGB")
    b = Image.open(b_path).convert("RGB")
    W, H = max(a.width, b.width), max(a.height, b.height)
    if a.size != b.size:
        pa = Image.new("RGB", (W, H), (255, 0, 255)); pa.paste(a, (0, 0)); a = pa
        pb = Image.new("RGB", (W, H), (0, 255, 0)); pb.paste(b, (0, 0)); b = pb
    d = ImageChops.difference(a, b)
    r, g, bl = d.split()
    m = ImageChops.lighter(ImageChops.lighter(r, g), bl)
    if m.getbbox() is None:
        return 0, (W, H)
    n = sum(m.histogram()[tol + 1:])
    if out_path:
        mask = m.point(lambda v: 255 if v > tol else 0)
        vis = Image.blend(b.convert("RGB"), Image.new("RGB", (W, H), (255, 255, 255)), 0.7)
        vis.paste(Image.new("RGB", (W, H), (230, 0, 60)), (0, 0), mask)
        vis.save(out_path)
    return n, (W, H)


def current_baseline():
    p = os.path.join(BASELINE_DIR, "CURRENT")
    name = open(p).read().strip() if os.path.exists(p) else "m0"
    return os.path.join(BASELINE_DIR, name), name


def load_noise():
    p = os.path.join(BASELINE_DIR, "noise.json")
    return json.load(open(p)) if os.path.exists(p) else {}


# ---------------------------------------------------------------- truth
D = r"[−–—\-‐‑]"  # minus / en / em / hyphen variants
HELD = [
    ("1.2%", r"(?<![\d.])1\.2\s?%"),
    ("8.9%", r"(?<![\d.])8\.9\s?%"),
    ("~8–9%", r"(?<![\d.])8\s?" + D + r"\s?9\s?%"),
    ("7×", r"(?<![\d.])7\s?[×xX](?![a-zA-Z0-9])"),
    ("7.4×", r"(?<![\d.])7\.4\s?[×xX](?![a-zA-Z0-9])"),
    ("24% … up from 3%", r"24\s?%[^\n]{0,120}?up from 3\s?%"),
    ("up from 3%", r"up from 3\s?%"),
    ("34.3%", r"(?<![\d.])34\.3\s?%"),
    ("22.9%", r"(?<![\d.])22\.9\s?%"),
    ("−2.6%", r"(?<![\d.])" + D + r"\s?2\.6(?!\d)\s?%"),
]


def held_hits(text):
    t = (text or "").replace(" ", " ").replace(" ", " ")
    hits = []
    for name, pat in HELD:
        for m in re.finditer(pat, t):
            a, b = max(0, m.start() - 50), min(len(t), m.end() + 50)
            hits.append((name, t[a:b].replace("\n", " ⏎ ")))
    return hits
