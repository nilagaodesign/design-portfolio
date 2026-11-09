#!/usr/bin/env python3
"""The gate: the 9 checks from SHARED-RULES.md, printed as a ✅/⚠️/❌ table.

Usage (from the repo or worktree root):
  python3 tools/gate.py <touched routes…> [--baseline m0] [--reuse DIR] [--no-truth]
     e.g. python3 tools/gate.py '#audience' '#all'      or   python3 tools/gate.py all

It captures all 15 routes of THIS folder's working tree (tools/capture.py, private server), then compares
with the current baseline (next-steps/build/baseline/CURRENT, e.g. m0).

  ✅ pass   ⚠️ pre-existing (present in the baseline, not made worse; doesn't block)   ❌ fail (blocks)

 1 390px       scrollWidth ≤ 390 at 390 on touched routes (⚠️ if over but not worse than baseline)
 2 Reduced     under prefers-reduced-motion, no running animations and no text left invisible
               (⚠️ if not worse than baseline)
 3 Keyboard    touched routes: every visible control is reached by Tab and shows a focus ring
               (not worse than baseline)
 4 axe         no new serious/critical violations vs baseline (count per rule, both widths, touched routes);
               color-contrast may not grow (D7). Pre-existing ones are listed as ⚠️.
 5 Requests    no external URL that the baseline didn't request (all routes); Google Fonts css2 compared per family
 6 Pixels      untouched routes: pixel difference within baseline/noise.json (diff images in .capture/gate/diff)
 7 Console     no console error or failed request that the baseline didn't have (all routes)
 8 Truth       tools/truth-test.py passes (⚠️ while only baseline held strings remain; ❌ for any new one)
 9 Colours     touched routes: no computed colour value outside the original palette (any baseline route, or a
               colour literal in the v0-review CSS), and no :root colour variable changed (D7)
Exit code 1 if any ❌. The table is also saved to .capture/gate/GATE.md for pasting into a status file.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _lib
_lib.ensure_venv()
import argparse, asyncio, datetime, json, re, subprocess

OK, WARN, BAD = "✅", "⚠️", "❌"
COLOR_RE = re.compile(r"^\s*(#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(|oklch\(|oklab\(|color\()")


def worst(states):
    return BAD if BAD in states else WARN if WARN in states else OK


def ext_keys(url):
    """What counts as 'the same request' for check 5. A Google Fonts css2 URL is compared family by family
    (so dropping a family, as W2-04b does, isn't a new request); every other URL is compared exactly."""
    from urllib.parse import urlparse, parse_qs
    u = urlparse(url)
    if u.netloc == "fonts.googleapis.com" and u.path.startswith("/css"):
        fams = parse_qs(u.query).get("family", [])
        return {f"fonts.googleapis.com{u.path} family={f}" for f in fams} or {url}
    return {url}


def colour_key(v):
    """Normalise a colour to (r, g, b, alpha rounded to 3 places); None if it isn't rgb()/rgba()/hex."""
    v = v.strip().lower()
    m = re.match(r"^#([0-9a-f]{3,8})$", v)
    if m:
        h = m.group(1)
        if len(h) in (3, 4):
            h = "".join(ch * 2 for ch in h)
        if len(h) not in (6, 8):
            return None
        a = int(h[6:8], 16) / 255 if len(h) == 8 else 1.0
        return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), round(a, 3))
    m = re.match(r"^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$", v)
    if m:
        a = m.group(4)
        a = 1.0 if a is None else (float(a[:-1]) / 100 if a.endswith("%") else float(a))
        return (round(float(m.group(1))), round(float(m.group(2))), round(float(m.group(3))), round(a, 3))
    return v


def original_palette(base):
    """Every colour the original site renders on any baseline route, plus every colour literal in the
    v0-review CSS (states a capture may not hit, e.g. a demo mid-step)."""
    keys = {colour_key(v) for x in base.values() if x for w in ("1440", "390") for v in colour_values(x["widths"][w]["colors"])}
    css = _lib.git("show", "v0-review:index.html")
    css = css[css.find("<style>"):css.find("</style>")]
    for lit in re.findall(r"#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)", css):
        keys.add(colour_key(lit))
    keys.discard(None)
    return keys


def load_accepted():
    """baseline/accepted.json: [{route, width, rule, targets: [...], reason, by, date}] — written by Main only."""
    p = os.path.join(_lib.BASELINE_DIR, "accepted.json")
    out = {}
    if os.path.exists(p):
        for e in json.load(open(p)):
            out.setdefault((e["route"], str(e["width"]), e["rule"]), set()).update(e["targets"])
    return out


def serious(axe):
    return {k: v for k, v in axe.items() if v.get("impact") in ("serious", "critical")}


def colour_values(colors):
    return {v for prop in colors.values() for v in prop}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("routes", nargs="*")
    ap.add_argument("--baseline")
    ap.add_argument("--reuse", help="use an existing capture folder instead of capturing")
    ap.add_argument("--no-truth", action="store_true")
    ap.add_argument("--out", default=os.path.join(_lib.ROOT, ".capture", "gate"))
    a = ap.parse_args()
    if not a.routes:
        sys.exit("Say which routes the task touched, e.g.: python3 tools/gate.py '#audience' '#all'   (or: all)")
    touched = _lib.parse_routes(a.routes)
    base_dir, base_name = _lib.current_baseline()
    if a.baseline:
        base_dir, base_name = os.path.join(_lib.BASELINE_DIR, a.baseline), a.baseline
    if not os.path.isdir(base_dir):
        sys.exit(f"No baseline at {base_dir}")
    noise = _lib.load_noise()
    cap = a.reuse or a.out
    if not a.reuse:
        print(f"Gate: capturing all 15 routes of {_lib.SITE} …", flush=True)
        asyncio.run(_lib.capture(_lib.ROUTES, cap, quiet=True))
    truth_rc, truth_out = None, ""
    if not a.no_truth:
        print("Gate: running truth test …", flush=True)
        pr = subprocess.run([sys.executable, os.path.join(_lib.TOOLS, "truth-test.py"), "--json", os.path.join(cap, "truth.json")],
                            cwd=_lib.ROOT, capture_output=True, text=True)
        truth_rc, truth_out = pr.returncode, pr.stdout.strip()

    cur = {r: _lib.load_capture(cap, r) for r in _lib.ROUTES}
    base = {r: _lib.load_capture(base_dir, r) for r in _lib.ROUTES}
    rows = []

    # 1 · 390px
    st, det = [], []
    for r in touched:
        c, b = cur[r]["widths"]["390"]["scrollWidth"], base[r]["widths"]["390"]["scrollWidth"] if base[r] else 390
        if c <= 390:
            st.append(OK)
        elif c <= b:
            st.append(WARN); det.append(f"{r} {c}px (baseline {b}, pre-existing)")
        else:
            st.append(BAD); det.append(f"{r} {c}px (baseline {b})")
    rows.append(("1", "390px: scrollWidth ≤ 390", worst(st), "; ".join(det) or "all ≤ 390"))

    # 2 · reduced motion
    st, det = [], []
    for r in touched:
        for w in ("1440", "390"):
            c, b = cur[r]["widths"][w]["motion"], (base[r] or cur[r])["widths"][w]["motion"]
            if c["running"] == 0 and c["hiddenText"] <= b["hiddenText"]:
                st.append(OK)
            elif c["running"] <= b["running"] and c["hiddenText"] <= b["hiddenText"]:
                st.append(WARN); det.append(f"{r}@{w} {c['running']} running ({', '.join(sorted(c['names']))[:80]}), pre-existing")
            else:
                st.append(BAD)
                det.append(f"{r}@{w} running {c['running']} (baseline {b['running']}), hidden text {c['hiddenText']} (baseline {b['hiddenText']}): {', '.join(c['hiddenSample'][:3])}")
    rows.append(("2", "Reduced motion ends in final state", worst(st), "; ".join(det) or "no running animations, nothing left hidden"))

    # 3 · keyboard
    st, det = [], []
    for r in touched:
        c, b = cur[r]["widths"]["1440"]["keyboard"], (base[r] or cur[r])["widths"]["1440"]["keyboard"]
        if c["unreachable"] == 0 and c["noRing"] == 0:
            st.append(OK)
        elif c["unreachable"] <= b["unreachable"] and c["noRing"] <= b["noRing"]:
            st.append(WARN); det.append(f"{r} unreachable {c['unreachable']}, no ring {c['noRing']} (pre-existing)")
        else:
            st.append(BAD)
            det.append(f"{r} unreachable {c['unreachable']} (baseline {b['unreachable']}) e.g. {c['unreachableSample'][:2]}; "
                       f"no ring {c['noRing']} (baseline {b['noRing']}) e.g. {c['noRingSample'][:2]}")
    rows.append(("3", "Keyboard: reachable, visible focus", worst(st), "; ".join(det) or "all reachable with a ring"))

    # 4 · axe. Nodes Main has accepted on record (baseline/accepted.json, e.g. low-contrast nodes a layout fix
    # brought on screen, D7) count as pre-existing. Anything else above the baseline count blocks.
    accepted = load_accepted()
    st, det, pre = [], [], []
    for r in touched:
        for w in ("1440", "390"):
            c = serious(cur[r]["widths"][w]["axe"])
            b = serious((base[r] or cur[r])["widths"][w]["axe"])
            new, ok_acc = {}, []
            for k, v in c.items():
                allow = b.get(k, {}).get("count", 0)
                acc = [t for t in v.get("targets", []) if t in accepted.get((r, w, k), set())]
                if v["count"] > allow and v["count"] <= allow + len(acc):
                    ok_acc.append(f"{k} +{v['count'] - allow} accepted ({', '.join(acc[:3])})")
                elif v["count"] > allow:
                    new[k] = v["count"]
            if new:
                st.append(BAD); det.append(f"{r}@{w} NEW: " + ", ".join(f"{k} {v} (baseline {b.get(k, {}).get('count', 0)})" for k, v in new.items()))
            elif c:
                st.append(WARN); pre.append(f"{r}@{w} " + ", ".join(f"{k} {v['count']}" for k, v in sorted(c.items())) + (" [" + "; ".join(ok_acc) + "]" if ok_acc else ""))
            else:
                st.append(OK)
    rows.append(("4", "axe: no new serious/critical", worst(st),
                 ("; ".join(det) + (" · pre-existing: " if det and pre else "") if det else ("pre-existing: " if pre else "")) + "; ".join(pre) or "0 serious/critical"))

    # 5 · external requests
    det = []
    for r in _lib.ROUTES:
        for w in ("1440", "390"):
            c = set().union(*[ext_keys(u) for u in cur[r]["widths"][w]["external"]])
            b = set().union(*[ext_keys(u) for x in _lib.ROUTES if base[x] for ww in ("1440", "390") for u in base[x]["widths"][ww]["external"]])
            new = sorted(c - b)
            if new:
                det.append(f"{r}@{w}: " + ", ".join(u[:90] for u in new))
    rows.append(("5", "No new external requests", BAD if det else OK, "; ".join(sorted(set(det))) or "none new vs baseline"))

    # 6 · pixels on untouched routes
    st, det = [], []
    os.makedirs(os.path.join(cap, "diff"), exist_ok=True)
    for r in _lib.ROUTES:
        if r in touched or not base[r]:
            continue
        for w in ("1440", "390"):
            s = _lib.slug(r)
            bp, cp = os.path.join(base_dir, f"{s}.{w}.png"), os.path.join(cap, f"{s}.{w}.png")
            n, _ = _lib.pixel_diff(bp, cp)
            floor = noise.get(s, {}).get(w, 0)
            if n > floor:
                dp = os.path.join(cap, "diff", f"{s}.{w}.png")
                _lib.pixel_diff(bp, cp, dp)
                st.append(BAD); det.append(f"{r}@{w} {n}px > noise {floor}px → {os.path.relpath(dp, _lib.ROOT)}")
            else:
                st.append(OK)
    rows.append(("6", "No unintended change (untouched routes)", worst(st) if st else OK, "; ".join(det) or "all within noise floor"))

    # 7 · console
    st, det = [], []
    for r in _lib.ROUTES:
        for w in ("1440", "390"):
            cw = cur[r]["widths"][w]
            bw = (base[r] or cur[r])["widths"][w]
            c = [m for m in cw["console"] if not m.startswith("warning")] + cw.get("failed", [])
            b = set(m for m in bw["console"] if not m.startswith("warning")) | set(bw.get("failed", []))
            new = [m for m in c if m not in b]
            if new:
                st.append(BAD); det.append(f"{r}@{w}: " + "; ".join(m[:120] for m in new[:3]))
            elif c:
                st.append(WARN)
            else:
                st.append(OK)
    pre = sorted({m[:100] for r in _lib.ROUTES for w in ("1440", "390")
                  for m in [x for x in cur[r]["widths"][w]["console"] if not x.startswith("warning")] + cur[r]["widths"][w].get("failed", [])})
    rows.append(("7", "No console errors", worst(st), "; ".join(det) if det else ("pre-existing: " + "; ".join(pre[:3]) if pre else "none")))

    # 8 · truth (held strings already in the baseline are ⚠️ until Content removes them; new ones are ❌)
    if truth_rc is None:
        rows.append(("8", "Truth test", WARN, "skipped (--no-truth)"))
    elif truth_rc == 0:
        rows.append(("8", "Truth test", OK, "0 held strings, 0 registry mismatches"))
    else:
        from collections import Counter
        ck = Counter(json.load(open(os.path.join(cap, "truth.json"))).get("keys", [])) if os.path.exists(os.path.join(cap, "truth.json")) else Counter()
        bp = os.path.join(base_dir, "truth.json")
        bk = Counter(json.load(open(bp)).get("keys", [])) if os.path.exists(bp) else Counter()
        new = [k for k in ck if ck[k] > bk.get(k, 0)]
        if new or not ck:
            rows.append(("8", "Truth test", BAD, "new: " + "; ".join(new[:6]) if new else truth_out[-200:]))
        else:
            held = sorted({k.split(" | ")[0].replace("held ", "") for k in ck})
            rows.append(("8", "Truth test", WARN, f"{sum(ck.values())} pre-existing held-string hits (baseline {sum(bk.values())}): {', '.join(held)}; none new"))

    # 9 · colours (D7). Blocks a colour VALUE the original site never had. A value that is new to this route
    # but already in the original palette (any baseline route, or a literal in the v0-review CSS) is reported, not failed.
    palette = original_palette(base)
    st, det, moved = [], [], []
    for r in touched:
        if not base[r]:
            continue
        for w in ("1440", "390"):
            c, b = cur[r]["widths"][w], base[r]["widths"][w]
            fresh = sorted(colour_values(c["colors"]) - colour_values(b["colors"]))
            new = [v for v in fresh if colour_key(v) not in palette]
            moved += [f"{r}@{w} {v}" for v in fresh if colour_key(v) in palette]
            changed = [f"{k} {b['rootVars'][k]}→{c['rootVars'].get(k, '(removed)')}" for k in b["rootVars"]
                       if COLOR_RE.match(b["rootVars"][k] or "") and c["rootVars"].get(k) != b["rootVars"][k]]
            if new or changed:
                st.append(BAD); det.append(f"{r}@{w} " + ("new colours: " + ", ".join(new[:6]) if new else "") + (" vars: " + ", ".join(changed[:6]) if changed else ""))
            else:
                st.append(OK)
    note = "all computed colours and :root colour vars match baseline"
    if moved and not det:
        note = "no new colour values; already in the original palette but new on this route: " + "; ".join(moved[:4])
    rows.append(("9", "Colours unchanged (D7)", worst(st) if st else OK, "; ".join(det) or note))

    head = (f"Gate · {datetime.datetime.now():%Y-%m-%d %H:%M} · {_lib.git('rev-parse', '--abbrev-ref', 'HEAD')} @ {_lib.git('rev-parse', '--short', 'HEAD')}"
            + (" (+uncommitted)" if _lib.git("status", "--porcelain", "--", ".", ":!tools", ":!.claude") else "")
            + f" · touched: {' '.join(touched)} · baseline {base_name}")
    md = [head, "", "| # | Check | Result | Detail |", "|---|---|---|---|"]
    for n, name, res, d in rows:
        md.append(f"| {n} | {name} | {res} | {d.replace('|', '/')} |")  # never truncated: a cut can hide a failure
    overall = worst([r[2] for r in rows])
    md += ["", f"**Gate: {'❌ FAIL' if overall == BAD else '✅ PASS' + (' (with pre-existing ⚠️)' if overall == WARN else '')}**"]
    text = "\n".join(md)
    os.makedirs(cap, exist_ok=True)
    open(os.path.join(cap, "GATE.md"), "w").write(text + "\n")
    print(text)
    sys.exit(1 if overall == BAD else 0)


if __name__ == "__main__":
    main()
